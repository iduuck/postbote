# @postbote/adapter-contract

Contract test suite for Postbote adapters. Ensures every adapter follows the same behavioural contract — error codes, retryability, message ID handling, abort signals, and API key safety.

## Install

```bash
pnpm add -D @postbote/adapter-contract
```

Requires `vitest` (peer dependency).

## Usage

A contract test file per adapter typically sets up an [msw](https://mswjs.io) server, then calls `runAdapterContractTests`:

```ts
import { runAdapterContractTests } from "@postbote/adapter-contract";

runAdapterContractTests({
  name: "my-adapter",
  createAdapter: () => myAdapter({ apiKey: "test_xxx" }),
  interceptor: {
    success(messageId) { /* configure msw to return success */ },
    failure(kind) { /* configure msw to return the error for `kind` */ },
    reset() { /* reset msw state */ },
  },
  skip: ["recipientRejected"], // optional
  secret: "test_xxx",          // optional — exact string checked for leaks
});
```

## Failure Kinds

| Kind | Expected `code` | Retryable |
|---|---|---|
| `auth` | `AUTH` | ❌ |
| `rateLimited` | `RATE_LIMITED` | ✅ |
| `unavailable` | `PROVIDER_UNAVAILABLE` | ✅ |
| `timeout` | `TIMEOUT` | ✅ |
| `invalidMessage` | `INVALID_MESSAGE` | ❌ |
| `recipientRejected` | `RECIPIENT_REJECTED` | ❌ |
| `networkError` | `PROVIDER_UNAVAILABLE` | ✅ |

## `secret` field

Each adapter test supplies the credential it passes to the adapter factory via the `secret` field. The suite serialises the error and searches for the exact string — a far more robust check than pattern matching. Postmark tokens (`pma_…`, UUIDs), SendGrid keys (`SG.…`), and Resend keys (`re_…`) are all caught.

## `skip` option

Adapters that cannot generate a specific failure at the API level should list it in `skip`:

- **SendGrid**: no synchronous recipient rejection → `skip: ["recipientRejected"]`
- **Native SDK adapters**: timeouts are hard to simulate via msw → `skip: ["timeout"]`
