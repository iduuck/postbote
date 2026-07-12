# @postbote/plugin-redirect

Redirects every message to safe staging recipients while removing `cc` and `bcc`.

```ts
import { redirect } from "@postbote/plugin-redirect";
createPostbote({ adapter, plugins: [redirect({ to: "staging@example.com", subjectPrefix: "[staging] " })] });
```

Original recipients are preserved in `X-Original-To`, `X-Original-Cc`, and `X-Original-Bcc` by default. Put redirect outside failover so every attempt sees the same transformed message. Combine with `@postbote/plugin-dry-run` to prevent staging delivery entirely.
