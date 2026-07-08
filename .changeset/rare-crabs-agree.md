---
"@postbote/adapter-sendgrid": minor
---

Initial release of @postbote/adapter-sendgrid — native @sendgrid/mail SDK adapter, client-injectable

- Uses `@sendgrid/mail` SDK with injectable `client?` option
- Error mapping via SDK ResponseError (HTTP status based)
- Message ID from `X-Message-Id` response header
- Full error mapping: AUTH, INVALID_MESSAGE, RATE_LIMITED, PROVIDER_UNAVAILABLE, TIMEOUT
- Contract suite skips recipientRejected (SendGrid has no synchronous recipient rejection)
