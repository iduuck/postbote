# @postbote/core

## 1.0.0

### Minor Changes

- 0be62a1: Add adapter and plugin authoring APIs.

  - Add `defineAdapter` and `httpStatusToErrorCode` to centralize adapter validation, abort handling, provider attribution, missing message IDs, and unknown-error mapping.
  - Add the non-retryable `CANCELLED` error code for policy cancellation.
  - Add typed plugin objects with input transforms and a single `wrapSend` capability.
  - Infer plugin input extensions and send return types from preserved plugin tuples without allowing middleware functions to widen either type.

- 84c87a5: Initial release of @postbote/core — types, errors, normalize, pipeline, and createPostbote

  - Error system: PostboteError with brand-symbol, 8 error codes (incl. ABORTED), retryable defaults, cause passthrough
  - Address parsing: `"Name <email>"`, plain email, Address objects with validation
  - Message normalization: from/to/cc/bcc/replyTo/subject/content validation with CRLF injection protection
  - Pipeline: koa-style onion middleware with AbortSignal support, multi-attempt tracking
  - encodeAttachment: base64 encoding with chunked string construction for large payloads
  - Shallow-copy of headers/tags/attachments in normalizeMessage to prevent mutation side-effects
