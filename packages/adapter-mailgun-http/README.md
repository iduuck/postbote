# @postbote/adapter-mailgun-http

Edge-compatible Mailgun adapter using `fetch`, with no SDK dependency.

## Installation

```bash
pnpm add @postbote/core @postbote/adapter-mailgun-http
```

## Usage

```ts
import { createPostbote } from "@postbote/core";
import { mailgunHttp } from "@postbote/adapter-mailgun-http";

const postbote = createPostbote({
  adapter: mailgunHttp({
    apiKey: "key-...",
    domain: "mg.example.com",
  }),
});
```

`apiKey` falls back to `MAILGUN_API_KEY`; an explicit option takes priority.

## Options

| Option | Default | Description |
| --- | --- | --- |
| `apiKey` | `MAILGUN_API_KEY` | Mailgun API key |
| `domain` | - | Required Mailgun sending domain |
| `baseUrl` | `https://api.mailgun.net` | API base URL; use `https://api.eu.mailgun.net` for EU accounts |
| `timeoutMs` | `30000` | Request timeout |
| `fetch` | `globalThis.fetch` | Custom fetch implementation |

## Mapping

Addresses and headers are sent as Mailgun multipart fields. Attachments use the Mailgun `attachment` field. Postbote attachment strings are decoded from base64 before upload. Mailgun supports tag values but not tag keys, so every Postbote tag value becomes an `o:tag` field.

## Error Mapping

| Condition | Code |
| --- | --- |
| HTTP 401 / 403 | `AUTH` |
| HTTP 400 recipient error | `RECIPIENT_REJECTED` |
| HTTP 429 | `RATE_LIMITED` |
| HTTP 5xx / network error | `PROVIDER_UNAVAILABLE` |
| Timeout | `TIMEOUT` |

The adapter parses `Retry-After` for rate-limited requests.

## License

MIT - see [LICENSE.md](LICENSE.md).
