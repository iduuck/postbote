# @postbote/plugin-rate-limit

Client-side token-bucket throttling for outbound sends.

```ts
import { rateLimit } from "@postbote/plugin-rate-limit";
createPostbote({ adapter, plugins: [rateLimit({ tokens: 10, intervalMs: 1_000 })] });
```

The default `wait` mode queues up to 100 sends for up to 30 seconds; `reject` immediately throws a retryable `RATE_LIMITED` error. Place it outside failover to limit logical sends, or inside failover to limit each provider attempt. Use `@postbote/plugin-retry` to react to provider-side 429 responses.
