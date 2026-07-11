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
| `packages/adapter-mailgun-http` | fetch-based Mailgun adapter, 0 SDK dependencies, edge-compatible |
| `packages/adapter-postmark` | Postmark native SDK adapter (`client?` injectable) |
| `packages/adapter-postmark-http` | fetch-based Postmark adapter, 0 SDK deps, edge-compatible |
| `packages/adapter-sendgrid` | SendGrid native `@sendgrid/mail` SDK adapter (`client?` injectable) |
| `packages/adapter-sendgrid-http` | fetch-based SendGrid adapter, 0 SDK deps, edge-compatible |
| `packages/adapter-smtp` | Node-only Nodemailer SMTP adapter for any SMTP provider, pooled by default |
| `packages/plugin-failover` | Middleware-plugin — automatisches Failover auf Fallback-Adapter bei Provider-Ausfällen (`failover()`, `FailoverExhaustedError`) |
| `packages/plugin-retry` | Middleware-plugin — Wiederholungen auf demselben Adapter mit Exponential Backoff, Jitter und abortierbaren Delays (`retry()`) |
| `packages/plugin-hooks` | Lifecycle hooks, validated message payload transforms, and policy cancellation via `CANCELLED` |
| `packages/plugin-logger` | Structured, JSON-safe send and attempt lifecycle events |
| `packages/plugin-otel` | OpenTelemetry client spans and attempt events per logical send |
| `packages/plugin-react-email` | Input-transform plugin rendering `ReactElement` bodies to HTML/text |
| `packages/plugin-better-result` | `wrapSend` plugin returning `Result<SendResult, PostboteError>` |
| `packages/testing` | Consumer test kit — `createTestAdapter`, `TestInbox`, error simulation, Vitest/Jest matchers (`./matchers` subpath) |
| `examples/` | Executable observability, React Email, and better-result examples |
| `apps/docs` | English Fumadocs/Next.js documentation site, served at `/`; MDX lives in `content/docs` |
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
| `pnpm --filter @postbote/plugin-failover test` | Single-package test |
| `pnpm --filter @postbote/core test:coverage` | Coverage (threshold: ≥95 %) |
| `pnpm --filter @postbote/docs dev` | Run the Fumadocs site locally at `http://localhost:3000` |
| `pnpm --filter @postbote/docs build` | Build the Vercel-ready documentation site |
| `pnpm changeset` | Create a new changeset |
| `pnpm version && pnpm release` | Changesets publish |
| `node scripts/quality.mjs` | Quality gates: `publint` + `attw` (type consistency) + `size-limit` (bundle budgets) |
| `node scripts/smoke.mjs` | Smoke test: ESM import + CJS `require(esm)` against packed tarballs |
| `node scripts/ts-compat.mjs` | TS compatibility: public types compile against TS 5.5 + latest |

**Mandatory scripts to run before committing:** `pnpm test`, `pnpm typecheck`, `pnpm lint`, `node scripts/quality.mjs`, `node scripts/smoke.mjs`, `node scripts/ts-compat.mjs` and changeset creation.

**IMPORTANT:** Before a commit that touches CI gates (`.github/`, `scripts/`), run all three script-based gates **locally** first (`quality`, `smoke`, `ts-compat`). These scripts have historically shipped with trivial bugs that 100 % fail in CI — always verify before pushing.

## Non-negotiable conventions

- **ESM-only**, Node ≥ 20.19; `platform: 'neutral'` — no `node:` imports, no `Buffer`
- **Core knows NO providers**; new cross-cutting features → plugin package
- **All errors are `PostboteError`** with `code` + `retryable`; type guard via `isPostboteError` (brand symbol), never `instanceof`
- `PostboteError.cause`: response status/body only, **never** request headers/API keys
- **CRLF validation** in core (`normalizeMessage`) — email header injection protection
- **Adapter structure**: `adapter.ts`, `map.ts` (+ snapshot tests), `errors.ts` (mapping table), `contract.test.ts` (msw)
- Each adapter exports `resendHttp(options)` / `resend(options)` — factory returning `Adapter`
- `contract.test.ts` uses `runAdapterContractTests` from `@postbote/adapter-contract` + msw server
- Adapter factories should use core `defineAdapter`; provider code returns only `messageId`/`raw`
- Input-transform plugins return `PluginObject<TInputExt>` and remove extension-only fields before normalization
- At most one plugin may define `wrapSend`; it wraps transforms, normalization, and the middleware pipeline
- No `console.*` in library code, no telemetry
- Adapters always testable via `interceptor` (msw or injected clients)

## Common pitfalls

- **plugins array: outer → inner** (first element wraps all others).
- Preserve plugin tuples inline or with `as const`; widening to `Middleware[]` intentionally drops type extensions.
- `next()` may be called multiple times (failover) — middleware must handle that.
- **tsdown** builds ESM + d.ts; `tsc` is **only** typecheck (`noEmit`).
- `plans/` is gitignored — on a fresh checkout **ALWAYS read plans/** before writing code.
- Contract suite has `skip: ["recipientRejected", "timeout"]` option for adapters that don't support certain errors.
