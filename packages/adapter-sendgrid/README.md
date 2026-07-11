# @postbote/adapter-sendgrid

`apiKey` is optional when `SENDGRID_API_KEY` is available. The explicit option takes precedence; an injected client does not require a key.

Postbote adapter for [SendGrid](https://sendgrid.com) — native `@sendgrid/mail` SDK.

## Installation

```bash
pnpm add @postbote/adapter-sendgrid
```

## Usage

```ts
import { sendgrid } from "@postbote/adapter-sendgrid";
import { createPostbote } from "@postbote/core";

const postbote = createPostbote({
  adapter: sendgrid({ apiKey: "SG...." }),
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
| `client` | `MailService` | — | Existing `@sendgrid/mail` instance (injectable) |

## Client Injection

Pass a pre-configured SDK instance for testing or custom setup:

```ts
import sgMail from "@sendgrid/mail";
import { sendgrid } from "@postbote/adapter-sendgrid";

sgMail.setApiKey("SG....");
const adapter = sendgrid({ client: sgMail });
```

## Mapping

See `@postbote/adapter-sendgrid-http` — payload structure is similar (SDK handles personalizations).

## Error Mapping

| Condition | Code |
|---|---|
| HTTP 401 / 403 | `AUTH` |
| HTTP 400 (body `errors[].field`) | `INVALID_MESSAGE` |
| HTTP 413 | `INVALID_MESSAGE` |
| HTTP 429 | `RATE_LIMITED` |
| HTTP 5xx / SDK error | `PROVIDER_UNAVAILABLE` |
| Timeout | `TIMEOUT` |

> SendGrid has no synchronous recipient-rejected error — contract test skips `recipientRejected`.

### Message ID

Read from the `X-Message-Id` response header returned by the SDK.

## HTTP variant

For a fetch-based, zero-dependency version (edge-compatible), see [`@postbote/adapter-sendgrid-http`](../adapter-sendgrid-http).

## License

MIT — see [LICENSE.md](LICENSE.md).
