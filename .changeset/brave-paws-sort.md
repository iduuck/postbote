---
"@postbote/adapter-sendgrid-http": minor
---

Initial release of @postbote/adapter-sendgrid-http — fetch-based SendGrid adapter, edge-compatible, zero SDK dependencies

- HTTP POST to `{baseUrl}/v3/mail/send` with Bearer token auth
- SendGrid v3 payload structure (personalizations, content array with plain→html ordering)
- Message ID from `X-Message-Id` response header
- Full error mapping: AUTH, INVALID_MESSAGE, RATE_LIMITED, PROVIDER_UNAVAILABLE, TIMEOUT
- Contract suite skips recipientRejected (SendGrid has no synchronous recipient rejection)
