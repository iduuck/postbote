# @postbote/adapter-resend

`apiKey` is optional when `RESEND_API_KEY` is available. The explicit option takes precedence; an injected client does not require a key.

Postbote adapter for [Resend](https://resend.com) — native `resend` SDK.

## Installation

```bash
pnpm add @postbote/adapter-resend
```

## Usage

```ts
import { resend } from "@postbote/adapter-resend";
import { createPostbote } from "@postbote/core";

const postbote = createPostbote({
  adapter: resend({ apiKey: "re_..." }),
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
| `client` | `Resend` | — | Existing Resend SDK instance (injectable) |

## Client Injection

Pass a pre-configured SDK instance for testing or custom setup:

```ts
import { Resend } from "resend";
import { resend } from "@postbote/adapter-resend";

const client = new Resend("re_...");
const adapter = resend({ client });
```

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

## HTTP variant

For a fetch-based, zero-dependency version (edge-compatible), see [`@postbote/adapter-resend-http`](../adapter-resend-http).

## License

MIT — see [LICENSE.md](LICENSE.md).
