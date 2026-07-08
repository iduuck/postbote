# @postbote/adapter-resend-http

Postbote adapter for [Resend](https://resend.com) — HTTP via `fetch`, zero SDK dependencies, edge-compatible.

## Installation

```bash
pnpm add @postbote/adapter-resend-http
```

## Usage

```ts
import { resendHttp } from "@postbote/adapter-resend-http";
import { createPostbote } from "@postbote/core";

const postbote = createPostbote({
  adapter: resendHttp({ apiKey: "re_..." }),
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
| `apiKey` | `string` | — | Resend API key |
| `baseUrl` | `string` | `https://api.resend.com` | API base URL |
| `timeoutMs` | `number` | `30000` | Request timeout |
| `fetch` | `typeof fetch` | `globalThis.fetch` | Custom fetch implementation |

## Error Mapping

| Condition | Code |
|---|---|
| HTTP 401 | `AUTH` |
| HTTP 422 (validation error) | `INVALID_MESSAGE` |
| HTTP 403 / 404 (contact not found) | `RECIPIENT_REJECTED` |
| HTTP 429 | `RATE_LIMITED` |
| HTTP 5xx / network error | `PROVIDER_UNAVAILABLE` |
| Timeout | `TIMEOUT` |

## Contract

Passes the full `@postbote/adapter-contract` suite.

## Native SDK variant

For the version using the official Resend SDK, see [`@postbote/adapter-resend`](../adapter-resend).

## License

MIT — see [LICENSE.md](LICENSE.md).
