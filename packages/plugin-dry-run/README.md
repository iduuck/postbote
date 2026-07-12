# @postbote/plugin-dry-run

Short-circuits sends for staging, CI, and local development without calling an adapter.

```ts
import { dryRun } from "@postbote/plugin-dry-run";
createPostbote({ adapter, plugins: [dryRun({ enabled: env.MAIL_DRY_RUN === "1" })] });
```

When enabled (the default), results use `dry-run-<n>` IDs, provider `dry-run`, and `raw: { dryRun: true }`. `onSend` receives the normalized message; observer errors are ignored. Put dry-run outside observability plugins when dry sends should not be logged as provider sends.

For tests, use `@postbote/testing` instead.
