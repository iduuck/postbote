# Postbote

Provider-agnostic email SDK (TypeScript, ESM-only, pnpm monorepo).
One core (`@postbote/core`), provider adapters as separate packages, cross-cutting concerns as middleware plugins.

## Repo Map

| Path | Contents |
|---|---|
| `packages/core` | Message model, `Adapter` contract, `PostboteError`, `normalizeMessage` (CRLF protection), `formatAddress`, middleware pipeline, `createPostbote` |
| `packages/adapter-contract` | Contract test suite (`runAdapterContractTests`) — every adapter must pass it |
| `packages/adapter-resend` | Native Resend SDK adapter (SDK injectable via `client?` option) |
| `packages/adapter-resend-http` | fetch-based adapter, 0 SDK dependencies, edge-compatible |
| `packages/adapter-postmark` | Postmark native SDK adapter (`client?` injectable) |
| `packages/adapter-postmark-http` | fetch-based Postmark adapter, 0 SDK deps, edge-compatible |
| `packages/adapter-sendgrid` | SendGrid native `@sendgrid/mail` SDK adapter (`client?` injectable) |
| `packages/adapter-sendgrid-http` | fetch-based SendGrid adapter, 0 SDK deps, edge-compatible |
| `packages/plugin-failover` | stub (Phase 6) |
| `packages/testing` | Consumer test kit — `createTestAdapter`, `TestInbox`, error simulation, Vitest/Jest matchers (`./matchers` subpath) |
| `examples/` | (empty — planned) |
| `plans/` | Detailed plans & ADRs — **gitignored**, read locally! (especially before starting any phase) |

## Commands

| Command | Effect |
|---|---|
| `pnpm install` | Install (includes Resend SDK, msw) |
| `pnpm build` | Turbo — builds all packages (tsdown) |
| `pnpm test` | Turbo — `vitest run` across all packages |
| `pnpm typecheck` | Turbo — `tsc --noEmit` across all packages |
| `pnpm lint` / `pnpm lint:fix` | Biome — **run before every commit** |
| `pnpm --filter @postbote/core test` | Single-package test |
| `pnpm --filter @postbote/core test:coverage` | Coverage (threshold: ≥95 %) |
| `pnpm changeset` | Create a new changeset |
| `pnpm version && pnpm release` | Changesets publish |

**Mandatory scripts to run before committing:** `pnpm test`, `pnpm typecheck`, `pnpm lint` and changeset creation.

## Non-negotiable conventions

- **ESM-only**, Node ≥ 20.19; `platform: 'neutral'` — no `node:` imports, no `Buffer`
- **Core knows NO providers**; new cross-cutting features → plugin package
- **All errors are `PostboteError`** with `code` + `retryable`; type guard via `isPostboteError` (brand symbol), never `instanceof`
- `PostboteError.cause`: response status/body only, **never** request headers/API keys
- **CRLF validation** in core (`normalizeMessage`) — email header injection protection
- **Adapter structure**: `adapter.ts`, `map.ts` (+ snapshot tests), `errors.ts` (mapping table), `contract.test.ts` (msw)
- Each adapter exports `resendHttp(options)` / `resend(options)` — factory returning `Adapter`
- `contract.test.ts` uses `runAdapterContractTests` from `@postbote/adapter-contract` + msw server
- No `console.*` in library code, no telemetry
- Adapters always testable via `interceptor` (msw or injected clients)

## Common pitfalls

- **plugins array: outer → inner** (first element wraps all others).
- `next()` may be called multiple times (failover) — middleware must handle that.
- **tsdown** builds ESM + d.ts; `tsc` is **only** typecheck (`noEmit`).
- `plans/` is gitignored — on a fresh checkout **ALWAYS read plans/** before writing code.
- Contract suite has `skip: ["recipientRejected", "timeout"]` option for adapters that don't support certain errors.
