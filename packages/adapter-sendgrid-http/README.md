# @postbote/adapter-sendgrid-http

Postbote adapter for [SendGrid](https://sendgrid.com) — HTTP via `fetch`, zero SDK dependencies, edge-compatible.

## Installation

```bash
pnpm add @postbote/adapter-sendgrid-http
```

## Usage

```ts
import { sendgridHttp } from "@postbote/adapter-sendgrid-http";
import { createPostbote } from "@postbote/core";

const postbote = createPostbote({
  adapter: sendgridHttp({ apiKey: "SG...." }),
});

const result = await postbote.send({
  from: "Acme <onboarding@acme.com>",
  to: "user@example.com",
  subject: "Welcome",
  text: "Hello!",
});
```

## Options

| Option | Type | Default | Description |
|---|---|---|---|
| `apiKey` | `string` | — | SendGrid API key |
| `baseUrl` | `string` | `https://api.sendgrid.com` | API base URL |
| `timeoutMs` | `number` | `30000` | Request timeout |
| `fetch` | `typeof fetch` | `globalThis.fetch` | Custom fetch implementation |

## Mapping

| `EmailMessage` | SendGrid v3 payload | Notes |
|---|---|---|
| `to` / `cc` / `bcc` | `personalizations[0].to/cc/bcc` | `[{ email, name? }]` — single personalization |
| `from` | `from` | `{ email, name? }` |
| `replyTo` | `reply_to` | `{ email, name? }` |
| `subject` | `subject` | |
| `text` / `html` | `content[]` | `[{ type: 'text/plain', value }, { type: 'text/html', value }]` — **plain before html** (API requirement) |
| `headers` | `headers` | Object 1:1 |
| `attachments` | `attachments` | `[{ content (base64), filename, type? }]` |
| `tags` | `custom_args` | Object 1:1 (values must be strings) |

## Error Mapping

| Condition | Code |
|---|---|
| HTTP 401 / 403 | `AUTH` |
| HTTP 400 (body `errors[].field`) | `INVALID_MESSAGE` |
| HTTP 413 | `INVALID_MESSAGE` |
| HTTP 429 | `RATE_LIMITED` |
| HTTP 5xx / network error | `PROVIDER_UNAVAILABLE` |
| Timeout | `TIMEOUT` |

> SendGrid has no synchronous recipient-rejected error — contract test skips `recipientRejected`.

### Message ID

SendGrid responds `202 Accepted` with an empty body. The message ID is read from the `X-Message-Id` response header.

## Native SDK variant

For the version using the official `@sendgrid/mail` SDK, see [`@postbote/adapter-sendgrid`](../adapter-sendgrid).

## License

MIT — see [LICENSE.md](LICENSE.md).
