# @postbote/core

Provider-agnostisches E-Mail-SDK — Typdefinitionen, Fehlerbehandlung, Adressnormalisierung und Middleware-Pipeline.

## Installation

```bash
pnpm add @postbote/core
```

## Verwendung

```ts
import { createPostbote } from "@postbote/core";
import type { Adapter, SendResult } from "@postbote/core";

const myAdapter: Adapter = {
  name: "custom",
  async send(message) {
    // an Adapter implementieren
    return { messageId: "...", provider: "custom" };
  },
};

const postbote = createPostbote({ adapter: myAdapter });

const result = await postbote.send({
  from: "Sender <sender@example.com>",
  to: "recipient@example.com",
  subject: "Hello",
  text: "World",
});
```

## API

- **`createPostbote(config)`** — Erzeugt eine Postbote-Instanz mit Adapter + optionalen Middleware-Plugins
- **`Postbote.send(input, options?)`** — Normalisiert und sendet eine E-Mail; unterstützt `options.signal` (AbortSignal)
- **`parseAddress(input)`** — Parst `"Name <email>"` oder `"email"` zu `Address`
- **`normalizeMessage(input)`** — Validiert und normalisiert `EmailMessageInput` zu `EmailMessage`
- **`PostboteError`** — Markierte Fehlerklasse mit `code`, `provider`, `retryable`
- **`compose(middlewares)`** — Koa-artige Middleware-Komposition (Onion-Modell)

## Error Codes

- `ABORTED` — Sendvorgang via AbortSignal abgebrochen
- `AUTH` — Authentifizierungsfehler
- `INVALID_MESSAGE` — Validierungsfehler
- `RECIPIENT_REJECTED` — Empfänger abgewiesen
- `RATE_LIMITED` — Rate-Limit erreicht (retryable)
- `PROVIDER_UNAVAILABLE` — Provider nicht erreichbar (retryable)
- `TIMEOUT` — Zeitüberschreitung (retryable)
- `UNKNOWN` — Sonstiger Fehler

## Sicherheit

`normalizeMessage` validiert alle benutzerdefinierten Eingaben gegen CRLF-Injection (`\r`, `\n` in Subject, Header-Namen/Werten und Absender-/Empfängernamen).

## Adapters

| Provider | Native SDK | HTTP (edge-ready) |
|---|---|---|
| Resend | [`@postbote/adapter-resend`](../adapter-resend) | [`@postbote/adapter-resend-http`](../adapter-resend-http) |
| Postmark | [`@postbote/adapter-postmark`](../adapter-postmark) | [`@postbote/adapter-postmark-http`](../adapter-postmark-http) |
| SendGrid | [`@postbote/adapter-sendgrid`](../adapter-sendgrid) | [`@postbote/adapter-sendgrid-http`](../adapter-sendgrid-http) |

## Write your own adapter

Use the [contract test suite](../adapter-contract/README.md) to ensure your adapter follows the same behavioural contract as all official adapters — every adapter must pass it.

`defineAdapter` is the recommended path. It validates the provider name, handles pre-aborted signals, adds the provider to results, rejects missing message IDs, and normalizes unknown errors.

```ts
import {
  defineAdapter,
  httpStatusToErrorCode,
  PostboteError,
} from "@postbote/core";

export const myProvider = (apiKey: string) =>
  defineAdapter({
    name: "my-provider",
    mapUnknownError: () => "PROVIDER_UNAVAILABLE",
    async send(message, { signal }) {
      const response = await fetch("https://api.example.com/send", {
        method: "POST",
        headers: { Authorization: `Bearer ${apiKey}` },
        body: JSON.stringify(message),
        signal,
      });
      const body = await response.json().catch(() => undefined);

      if (!response.ok) {
        throw new PostboteError(response.statusText, {
          code: httpStatusToErrorCode(response.status),
          provider: "my-provider",
          cause: { status: response.status, body },
        });
      }

      return { messageId: body.id, raw: body };
    },
  });
```

You can also implement the structural `Adapter` interface directly when a custom wrapper is not appropriate. Both approaches must pass the contract suite.

## License

MIT — see [LICENSE.md](LICENSE.md).
