---
"@postbote/core": minor
"@postbote/plugin-failover": minor
"@postbote/testing": minor
"@postbote/adapter-resend": patch
"@postbote/adapter-resend-http": patch
"@postbote/adapter-postmark": patch
"@postbote/adapter-postmark-http": patch
"@postbote/adapter-sendgrid": patch
"@postbote/adapter-sendgrid-http": patch
---

Preserve literal adapter names in `SendResult.provider`. `createPostbote()` now returns the primary provider name and, when using failover, the union of the primary and fallback provider names.
