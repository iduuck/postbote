# Contributing

## Setup

```bash
git clone <repo>
cd postbote
pnpm install
```

## Development

```bash
pnpm build          # build all packages (tsdown)
pnpm test           # run all tests (vitest)
pnpm typecheck      # type-check all packages (tsc --noEmit)
pnpm lint           # lint all packages (biome)
pnpm lint:fix       # auto-fix lint issues
```

Run a single package:

```bash
pnpm --filter @postbote/core test
pnpm --filter @postbote/core test:coverage
pnpm --filter @postbote/plugin-failover test
```

## Before committing

1. Run `pnpm test && pnpm typecheck && pnpm lint`
2. Create a changeset: `pnpm changeset`
   - Select affected packages
   - Choose bump type (major/minor/patch)
   - Write a summary for the changelog

Every PR that changes behavior must include a changeset. The CI job `changesets/action` checks for it.

## Adding a new adapter

1. Create a new package under `packages/adapter-<provider>`
2. Follow the adapter structure: `adapter.ts`, `map.ts` (+ snapshot tests), `errors.ts`, `contract.test.ts`
3. Use `runAdapterContractTests` from `@postbote/adapter-contract`
4. Provide both native SDK (`adapter-<provider>`) and HTTP (`adapter-<provider>-http`) variants
5. Add package entry to the root README table
6. Create a changeset

Community adapters follow the same contract but live as `postbote-adapter-<provider>` (unscoped).

## Adding a new plugin

1. Create a new package under `packages/plugin-<name>`
2. Implement the middleware signature: `(ctx, next) => Promise<void>`
3. Export a factory function (e.g. `failover(options)`)
4. Add package entry to the root README table
5. Create a changeset

## Code conventions

- ESM-only, no `node:*` imports, no `Buffer`
- All errors are `PostboteError` with `code` + `retryable`
- No `console.*` in library code, no telemetry
- `sideEffects: false` (except `testing` register file)
- Biome for formatting/linting, tsdown for builds
- TSDoc on all public exports

## Reporting issues

- **Bug reports**: include a minimal reproduction, Node version, adapter used
- **Feature requests**: explain the use case — not just what, but why
- **Security issues**: see [SECURITY.md](./SECURITY.md) — do not file a public issue

## License

By contributing, you agree that your contributions will be licensed under the MIT License.
