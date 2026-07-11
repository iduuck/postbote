# @postbote/adapter-smtp

Node.js SMTP adapter for Postbote, built on [Nodemailer](https://nodemailer.com).

> This adapter requires Node.js TCP sockets. It does **not** run on Edge runtimes such as Cloudflare Workers or Vercel Edge.

## Installation

```bash
pnpm add @postbote/adapter-smtp
```

## Usage

```ts
import { smtp } from "@postbote/adapter-smtp";
import { createPostbote } from "@postbote/core";

const adapter = smtp({
  host: "smtp.example.com",
  port: 587,
  auth: { user: "username", pass: "password" },
});

const postbote = createPostbote({ adapter });
await postbote.send({
  from: "Acme <hello@example.com>",
  to: "user@example.com",
  subject: "Welcome",
  text: "Hello!",
});

await adapter.close();
```

Use `url` instead of individual connection fields when convenient:

```ts
smtp({ url: "smtps://user:pass@mail.example.com:465" });
```

## Options

| Option | Default | Description |
| --- | --- | --- |
| `url` | - | SMTP connection URL |
| `host` | - | SMTP host when not using `url` |
| `port` | `587` | SMTP port |
| `secure` | `port === 465` | Use implicit TLS |
| `auth` | - | `{ user, pass }` credentials |
| `pool` | `true` | Reuse SMTP connections |
| `maxConnections` | `5` | Maximum pooled connections |
| `timeoutMs` | `30_000` | Connection, greeting, and socket timeout |
| `transport` | - | Existing Nodemailer transport for testing or custom setup |

## Lifecycle

Pooling is enabled by default. Call `await adapter.close()` during application shutdown so pooled sockets do not keep the process alive.

## Mapping

Addresses are passed to Nodemailer as `{ name?, address }` objects. Nodemailer handles display-name quoting and RFC 2047 subject encoding. `Uint8Array` attachments become Node.js buffers; string attachments are sent as base64 content.

SMTP has no native tag concept. Each Postbote tag becomes an `X-Postbote-Tag-<key>` header.

## Error Mapping

| SMTP condition | Postbote code |
| --- | --- |
| 530, 534, 535 | `AUTH` |
| 550, 551, 553 | `RECIPIENT_REJECTED` |
| 552, rejected 554 | `INVALID_MESSAGE` |
| 421, 451 or network socket errors | `PROVIDER_UNAVAILABLE` |
| 450, 452 | `RATE_LIMITED` |
| Connection, greeting, or socket timeout | `TIMEOUT` |
| Other failures | `UNKNOWN` |

SMTP 4xx responses are transient and therefore retryable. SMTP 5xx responses are permanent, except the documented availability conditions.

If an SMTP server accepts only some recipients, the adapter throws `RECIPIENT_REJECTED` with the rejected addresses rather than reporting a silent partial success.

Nodemailer does not support `AbortSignal`. An already-aborted signal prevents sending; an in-flight abort rejects the caller but may not stop a message already accepted by the SMTP server.

## License

MIT - see [LICENSE.md](LICENSE.md).
