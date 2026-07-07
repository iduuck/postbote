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
