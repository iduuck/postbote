---
"@postbote/adapter-postmark-http": minor
---

Initial release of @postbote/adapter-postmark-http — fetch-based Postmark adapter, edge-compatible, zero SDK dependencies

- HTTP POST to `{baseUrl}/email` with `X-Postmark-Server-Token` auth
- Comma-separated recipient fields (To/Cc/Bcc) with >50 recipient guard
- messageStream support (default: `outbound`)
- Full error mapping: AUTH, INVALID_MESSAGE, RECIPIENT_REJECTED, RATE_LIMITED, PROVIDER_UNAVAILABLE, TIMEOUT
- Passes full adapter contract suite (recipientRejected + timeout supported)
