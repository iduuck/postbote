---
"@postbote/core": minor
---

Initial release of @postbote/core — types, errors, normalize, pipeline, and createPostbote

- Error system: PostboteError with brand-symbol, 8 error codes (incl. ABORTED), retryable defaults, cause passthrough
- Address parsing: `"Name <email>"`, plain email, Address objects with validation
- Message normalization: from/to/cc/bcc/replyTo/subject/content validation with CRLF injection protection
- Pipeline: koa-style onion middleware with AbortSignal support, multi-attempt tracking
- encodeAttachment: base64 encoding with chunked string construction for large payloads
- Shallow-copy of headers/tags/attachments in normalizeMessage to prevent mutation side-effects
