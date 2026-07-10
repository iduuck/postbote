# @postbote/plugin-failover

## 1.0.0

### Minor Changes

- a59d714: Initial release of @postbote/plugin-failover — automatic failover to fallback adapters when the primary provider fails

  - `failover({ fallbacks, shouldFailover?, onFailover? })` → Middleware
  - Chain iterates `[ctx.adapter, ...fallbacks]`, swaps adapter and retries on retryable errors
  - `FailoverExhaustedError` (PostboteError, code `PROVIDER_UNAVAILABLE`) when all adapters exhausted
  - `shouldFailover` defaults to `(e) => e.retryable`; non-retryable errors (AUTH, INVALID_MESSAGE, RECIPIENT_REJECTED) propagate immediately
  - `onFailover` hook for logging/alerting; errors in hook are caught and logged via `console.warn`
  - Stateful per-send (no sticky failover); `ctx.attempts` accumulates full attempt log

### Patch Changes

- Updated dependencies [0be62a1]
- Updated dependencies [84c87a5]
  - @postbote/core@1.0.0
