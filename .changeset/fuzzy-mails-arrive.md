---
"@postbote/core": minor
---

Add adapter and plugin authoring APIs.

- Add `defineAdapter` and `httpStatusToErrorCode` to centralize adapter validation, abort handling, provider attribution, missing message IDs, and unknown-error mapping.
- Add the non-retryable `CANCELLED` error code for policy cancellation.
- Add typed plugin objects with input transforms and a single `wrapSend` capability.
- Infer plugin input extensions and send return types from preserved plugin tuples without allowing middleware functions to widen either type.
