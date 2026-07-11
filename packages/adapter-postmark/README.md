# @postbote/adapter-postmark

`serverToken` is optional when `POSTMARK_SERVER_TOKEN` is available. The explicit option takes precedence; an injected client does not require a token.

Postbote adapter for [Postmark](https://postmarkapp.com) — native `postmark` SDK.

## Installation

```bash
pnpm add @postbote/adapter-postmark
```

## Usage

```ts
import { postmark } from "@postbote/adapter-postmark";
import { createPostbote } from "@postbote/core";

const postbote = createPostbote({
  adapter: postmark({ serverToken: "..." }),
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
| `client` | `ServerClient` | — | Existing Postmark SDK instance (injectable) |
| `messageStream` | `string` | `outbound` | Postmark message stream |
| `timeoutMs` | `number` | — | Request timeout (passed to SDK) |

## Client Injection

Pass a pre-configured SDK instance for testing or custom setup:

```ts
import { ServerClient } from "postmark";
import { postmark } from "@postbote/adapter-postmark";

const client = new ServerClient("...");
const adapter = postmark({ client });
```

## Mapping

See `@postbote/adapter-postmark-http` — payload structure is identical.

## Error Mapping

| Condition | Code |
|---|---|
| ErrorCode 10 (bad token) | `AUTH` |
| ErrorCode 300 (invalid request) | `INVALID_MESSAGE` |
| ErrorCode 406 (inactive recipient) | `RECIPIENT_REJECTED` |
| ErrorCode 300 + recipient mention in message | `RECIPIENT_REJECTED` |
| Rate limit | `RATE_LIMITED` |
| SDK / network error | `PROVIDER_UNAVAILABLE` |
| Timeout | `TIMEOUT` |

## Contract

Passes the full `@postbote/adapter-contract` suite (no `skip` for `recipientRejected`).

## HTTP variant

For a fetch-based, zero-dependency version (edge-compatible), see [`@postbote/adapter-postmark-http`](../adapter-postmark-http).

## License

MIT — see [LICENSE.md](LICENSE.md).
