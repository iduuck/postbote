# @postbote/adapter-sendgrid

## 1.0.0

### Minor Changes

- 1731a4a: Initial release of @postbote/adapter-sendgrid — native @sendgrid/mail SDK adapter, client-injectable

  - Uses `@sendgrid/mail` SDK with injectable `client?` option
  - Error mapping via SDK ResponseError (HTTP status based)
  - Message ID from `X-Message-Id` response header
  - Full error mapping: AUTH, INVALID_MESSAGE, RATE_LIMITED, PROVIDER_UNAVAILABLE, TIMEOUT
  - Contract suite skips recipientRejected (SendGrid has no synchronous recipient rejection)

### Patch Changes

- Updated dependencies [0be62a1]
- Updated dependencies [84c87a5]
  - @postbote/core@1.0.0
