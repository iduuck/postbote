# @postbote/core

Provider-agnostic transactional email core for TypeScript: message types, error handling, address normalization, and the middleware pipeline.

## Installation

```bash
pnpm add @postbote/core
```

## Usage

```ts
import { createPostbote } from "@postbote/core";
import type { Adapter, SendResult } from "@postbote/core";

const myAdapter: Adapter = {
  name: "custom",
  async send(message) {
    // Implement the provider-specific delivery call here.
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

- **`createPostbote(config)`** - Creates a Postbote instance from an adapter and optional plugins.
- **`Postbote.send(input, options?)`** - Normalizes and sends an email. Supports `options.signal` (`AbortSignal`).
- **`parseAddress(input)`** - Parses `"Name <email>"` or `"email"` into an `Address`.
- **`normalizeMessage(input)`** - Validates and normalizes `EmailMessageInput` into `EmailMessage`.
- **`PostboteError`** - Branded error with `code`, `provider`, and `retryable`.
- **`compose(middlewares)`** - Koa-style middleware composition.

## Error Codes

- `ABORTED` - Send was aborted through an `AbortSignal`.
- `AUTH` - Provider authentication failed.
- `CANCELLED` - A plugin cancelled the send.
- `INVALID_MESSAGE` - Message validation or rendering failed.
- `RECIPIENT_REJECTED` - Provider rejected a recipient.
- `RATE_LIMITED` - Provider rate limit reached (retryable).
- `PROVIDER_UNAVAILABLE` - Provider or network unavailable (retryable).
- `TIMEOUT` - Request timed out (retryable).
- `UNKNOWN` - An unmapped failure occurred.

## Security

`normalizeMessage` validates user-controlled input against CRLF injection: `\r` and `\n` are rejected in subjects, header names and values, and sender or recipient display names.

## Adapters

| Provider | Native SDK | HTTP (edge-ready) |
|---|---|---|
| Resend | [`@postbote/adapter-resend`](../adapter-resend) | [`@postbote/adapter-resend-http`](../adapter-resend-http) |
| Postmark | [`@postbote/adapter-postmark`](../adapter-postmark) | [`@postbote/adapter-postmark-http`](../adapter-postmark-http) |
| SendGrid | [`@postbote/adapter-sendgrid`](../adapter-sendgrid) | [`@postbote/adapter-sendgrid-http`](../adapter-sendgrid-http) |

## Write your own adapter

Use the [contract test suite](../adapter-contract/README.md) to ensure your adapter follows the same behavioral contract as official adapters. Every adapter should pass it.

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

MIT - see [LICENSE.md](LICENSE.md).
