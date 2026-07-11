# @postbote/adapter-postmark-http

`serverToken` is optional when `POSTMARK_SERVER_TOKEN` is available. The explicit option takes precedence; construction throws if neither is set.

Postbote adapter for [Postmark](https://postmarkapp.com) — HTTP via `fetch`, zero SDK dependencies, edge-compatible.

## Installation

```bash
pnpm add @postbote/adapter-postmark-http
```

## Usage

```ts
import { postmarkHttp } from "@postbote/adapter-postmark-http";
import { createPostbote } from "@postbote/core";

const postbote = createPostbote({
  adapter: postmarkHttp({ serverToken: "..." }),
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
| `serverToken` | `string` | — | Postmark server API token |
| `baseUrl` | `string` | `https://api.postmarkapp.com` | API base URL |
| `timeoutMs` | `number` | `30000` | Request timeout |
| `fetch` | `typeof fetch` | `globalThis.fetch` | Custom fetch implementation |
| `messageStream` | `string` | `outbound` | Postmark message stream |

## Mapping

| `EmailMessage` | Postmark payload | Notes |
|---|---|---|
| `from` | `From` | `"Name <email>"` string |
| `to` / `cc` / `bcc` | `To` / `Cc` / `Bcc` | **comma-separated string** (max 50 recipients — throws `INVALID_MESSAGE` if exceeded) |
| `replyTo` | `ReplyTo` | String |
| `subject` | `Subject` | |
| `html` / `text` | `HtmlBody` / `TextBody` | |
| `headers` | `Headers` | `[{ Name, Value }]` |
| `attachments` | `Attachments` | `[{ Name, Content (base64), ContentType }]` — ContentType defaults to `application/octet-stream` |
| `tags` | `Metadata` | Object 1:1; if a `tag` key exists, also set as Postmark's native `Tag` field |

## Error Mapping

| Condition | Code |
|---|---|
| HTTP 401 / ErrorCode 10 (bad token) | `AUTH` |
| HTTP 422 + ErrorCode 300 (invalid request) | `INVALID_MESSAGE` |
| HTTP 422 + ErrorCode 406 (inactive recipient) | `RECIPIENT_REJECTED` |
| HTTP 422 + ErrorCode 300 + recipient mention in message | `RECIPIENT_REJECTED` |
| HTTP 429 | `RATE_LIMITED` |
| HTTP 5xx / network error | `PROVIDER_UNAVAILABLE` |
| Timeout | `TIMEOUT` |

## Contract

Passes the full `@postbote/adapter-contract` suite (no `skip` for `recipientRejected`).

## Native SDK variant

For the version using the official Postmark SDK, see [`@postbote/adapter-postmark`](../adapter-postmark).

## License

MIT — see [LICENSE.md](LICENSE.md).
