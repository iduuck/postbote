---
"@postbote/adapter-contract": minor
"@postbote/adapter-smtp": minor
"@postbote/core": minor
"@postbote/adapter-resend-http": patch
"@postbote/adapter-postmark-http": patch
"@postbote/adapter-sendgrid-http": patch
"@postbote/plugin-failover": patch
"@postbote/plugin-retry": minor
---

Add a Node.js SMTP adapter with pooled Nodemailer transport support, lifecycle management, and local SMTP contract coverage.

Add retry-after metadata to Postbote errors and parse rate-limit response headers in HTTP adapters.

Add retry and failover composition coverage, including retrying each provider or an entire fallback chain.

Allow adapters with client-generated message IDs to opt out of strict interceptor ID equality in contract tests.
