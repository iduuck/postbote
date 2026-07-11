# @postbote/plugin-retry

Retries sends on the current adapter with exponential backoff. `maxAttempts`
includes the initial send and defaults to three.

```ts
import { createPostbote } from "@postbote/core";
import { retry } from "@postbote/plugin-retry";

const postbote = createPostbote({
  adapter,
  plugins: [
    retry({
      maxAttempts: 3,
      backoff: { initialMs: 200, factor: 2, maxMs: 10_000 },
    }),
  ],
});
```

## Semantics

1. An error is retried only when `retryIf(error, ctx)` returns `true`. By
   default this is `error.retryable`, so permanent errors such as `AUTH`,
   `INVALID_MESSAGE`, `ABORTED`, and `CANCELLED` are rethrown unchanged.
2. A retry waits using exponential backoff. The default is full jitter, so the
   delay is a random value between zero and the calculated delay.
3. When a rate-limited error includes `retryAfterMs`, the default behavior uses
   the larger of that value and the calculated backoff delay.
4. `onRetry` runs before the wait. Errors thrown by this observer are ignored
   and cannot interrupt delivery.
5. Waiting observes the send's `AbortSignal`. Aborting during a delay rejects
   immediately with an `ABORTED` `PostboteError`; no further adapter call is
   made.

When all attempts fail, retry throws the final original error unchanged. There
is intentionally no `RetryExhaustedError`: the provider error retains the most
useful code, retryability, and cause, while `ctx.attempts` records every send
attempt.

## Plugin Ordering

Plugins are ordered outer to inner.

```ts
// Recommended: retry a provider before moving to the fallback provider.
plugins: [failover({ fallbacks: [postmark] }), retry({ maxAttempts: 3 })]

// Retry the complete failover chain after it has been exhausted.
plugins: [retry({ maxAttempts: 3 }), failover({ fallbacks: [postmark] })]
```

`FailoverExhaustedError` is retryable, so the second composition deliberately
retries the entire provider chain.

## API

| Option | Type | Default | Description |
|---|---|---|---|
| `maxAttempts` | `number` | `3` | Total attempts, including the first send |
| `retryIf` | `(error, ctx) => boolean` | `(error) => error.retryable` | Determines whether an error is retried |
| `backoff` | object or `(attempt, error) => number` | exponential backoff | Delay curve |
| `backoff.initialMs` | `number` | `200` | Initial calculated delay |
| `backoff.factor` | `number` | `2` | Multiplier for each retry |
| `backoff.maxMs` | `number` | `10_000` | Maximum calculated delay |
| `backoff.jitter` | `boolean` | `true` | Uses full jitter when enabled |
| `respectRetryAfter` | `boolean` | `true` | Honors rate-limit `retryAfterMs` values |
| `onRetry` | `(info) => void` | - | Called before each retry; throwing is ignored |

## License

MIT.
