---
"@postbote/adapter-postmark": minor
---

Initial release of @postbote/adapter-postmark — native Postmark SDK adapter, client-injectable

- Uses `postmark.ServerClient` with injectable `client?` option
- SDK ErrorCode-based error mapping (10→AUTH, 300→INVALID_MESSAGE/RECIPIENT_REJECTED, 406→RECIPIENT_REJECTED)
- messageStream support (default: `outbound`)
- Passes full adapter contract suite (recipientRejected + timeout supported)
