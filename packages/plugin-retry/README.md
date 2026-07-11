# @postbote/plugin-retry

Retries retryable sends on the current adapter with exponential backoff. `maxAttempts` includes the initial send and defaults to three.

Use `[failover(...), retry(...)]` to retry each provider before failing over. Reversing that order retries the entire failover chain.
