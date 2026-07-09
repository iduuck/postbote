// @size-limit configuration
//
// Excluded packages (native SDK adapters + adapter-contract):
//   Their bundle size is dominated by SDK dependencies (resend, postmark,
//   @sendgrid/mail, adapter-contract), making per-package budgets meaningless.
//
// Budget rationale:
//   core              < 5 kB — lean message pipeline
//   *-http adapters   < 3 kB — fetch-only, zero SDK deps
//   plugin-failover   < 3 kB — middleware, no provider coupling
//   testing           < 5 kB — test kit (heavier by nature)

module.exports = [
  {
    name: "@postbote/core",
    path: "packages/core/dist/index.js",
    limit: "5 kB",
  },
  {
    name: "@postbote/adapter-resend-http",
    path: "packages/adapter-resend-http/dist/index.js",
    limit: "3 kB",
  },
  {
    name: "@postbote/adapter-postmark-http",
    path: "packages/adapter-postmark-http/dist/index.js",
    limit: "3 kB",
  },
  {
    name: "@postbote/adapter-sendgrid-http",
    path: "packages/adapter-sendgrid-http/dist/index.js",
    limit: "3 kB",
  },
  {
    name: "@postbote/plugin-failover",
    path: "packages/plugin-failover/dist/index.js",
    limit: "3 kB",
  },
  {
    name: "@postbote/testing",
    path: "packages/testing/dist/index.js",
    limit: "5 kB",
  },
];
