# @postbote/adapter-postmark

## 1.0.0

### Minor Changes

- 1731a4a: Initial release of @postbote/adapter-postmark — native Postmark SDK adapter, client-injectable

  - Uses `postmark.ServerClient` with injectable `client?` option
  - SDK ErrorCode-based error mapping (10→AUTH, 300→INVALID_MESSAGE/RECIPIENT_REJECTED, 406→RECIPIENT_REJECTED)
  - messageStream support (default: `outbound`)
  - Passes full adapter contract suite (recipientRejected + timeout supported)

### Patch Changes

- Updated dependencies [0be62a1]
- Updated dependencies [84c87a5]
  - @postbote/core@1.0.0
