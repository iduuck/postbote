# @postbote/plugin-failover

Automatically switch to fallback adapters when a provider is unavailable.

```ts
import { createPostbote } from "@postbote/core";
import { resend } from "@postbote/adapter-resend";
import { postmark } from "@postbote/adapter-postmark";
import { failover } from "@postbote/plugin-failover";

const postbote = createPostbote({
  registry: [
    resend({ apiKey: env.RESEND_KEY }),
    postmark({ serverToken: env.POSTMARK_TOKEN }),
  ],
  adapter: "resend",
  plugins: [
    failover({
      fallbacks: ["postmark"],
      onFailover: ({ from, to, error }) =>
        logger.warn(`failover ${from} → ${to}: ${error.code}`),
    }),
  ],
});
```

## Semantics

1. **Adapter chain** is `[ctx.adapter, ...fallbacks]`. The primary adapter from the Postbote configuration is always attempted first.
2. **For each adapter**, failover assigns `ctx.adapter = adapter` and calls `await next()`. On success, it returns the result immediately.
3. **On an error**, `shouldFailover(error, ctx)` decides whether to continue:
   - `false` for errors such as `INVALID_MESSAGE`, `RECIPIENT_REJECTED`, or `AUTH` rethrows the original error immediately.
   - `true` calls `onFailover` and tries the next adapter.
4. **When the chain is exhausted**, `FailoverExhaustedError` includes the complete `attempts` record.
5. **Failover does not retry an adapter.** Add retry behavior separately when your application needs it.

## Plugin Ordering

The `plugins` array is ordered **outer to inner**.

- Keep `failover` **as far inside as possible** (usually last) so outer plugins such as logging and metrics observe one logical send and its final outcome.
- A plugin **after** failover (further inside) runs for every `next()` call and therefore for every adapter attempt. It must be idempotent.

```ts
// Recommended: failover stays inside observability plugins.
plugins: [logging, metrics, failover({ fallbacks: [...] })]

// Use this only when a plugin must run for each adapter attempt.
plugins: [failover({ fallbacks: [...] }), perAttemptPlugin]
```

### Retry Composition

```ts
// Recommended: retry each provider before switching to a fallback.
plugins: [failover({ fallbacks: [postmark] }), retry({ maxAttempts: 3 })]

// Retry the complete failover chain after every provider has failed.
plugins: [retry({ maxAttempts: 3 }), failover({ fallbacks: [postmark] })]
```

`FailoverExhaustedError` is retryable, so the second composition deliberately
retries the complete chain.

## API

### `failover(options)`

| Option | Type | Default | Description |
|---|---|---|---|
| `fallbacks` | `(Adapter \| string)[]` | - | Fallback adapters or registry keys in priority order |
| `shouldFailover?` | `(error, ctx) => boolean` | `(e) => e.retryable` | Decides whether an error should try the next adapter |
| `onFailover?` | `(info) => void` | - | Called before each switch. Throwing callbacks do not interrupt delivery. |

### `FailoverExhaustedError`

```ts
class FailoverExhaustedError extends PostboteError {
  readonly attempts: readonly SendAttempt[];
  // code: "PROVIDER_UNAVAILABLE", retryable: true, provider: "failover"
}
```

## License

MIT - see [LICENSE.md](LICENSE.md).
