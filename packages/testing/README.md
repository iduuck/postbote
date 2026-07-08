# @postbote/testing

Consumer test kit for Postbote — test your email-sending code without sending real emails.

## Installation

```bash
pnpm add -D @postbote/testing
```

## Quickstart

```ts
import { createPostbote } from "@postbote/core";
import { createTestAdapter } from "@postbote/testing";
import type { Adapter } from "@postbote/core";

// App code — adapter is injected
function makeMailer(adapter: Adapter) {
  return createPostbote({ adapter });
}

// Test
const adapter = createTestAdapter();
const mailer = makeMailer(adapter);

beforeEach(() => adapter.reset());

it("sends a welcome email", async () => {
  await mailer.send({
    from: "noreply@acme.com",
    to: "user@example.com",
    subject: "Welcome!",
    text: "Hello User",
  });

  expect(adapter.inbox.count()).toBe(1);
  expect(adapter.inbox.last().subject).toBe("Welcome!");
  expect(adapter.inbox.last().from.email).toBe("noreply@acme.com");
  expect(adapter.inbox.last().to[0].email).toBe("user@example.com");
});
```

## API

### `createTestAdapter(options?)`

| Option | Type | Default | Description |
|---|---|---|---|
| `name` | `string` | `"test"` | Adapter name (used as `provider` in `SendResult` and messageId prefix) |
| `latencyMs` | `number` | `0` | Artificial delay per send |

### Error Simulation

```ts
// Throw on next N sends (default: `PROVIDER_UNAVAILABLE`, 1 time)
adapter.failNext();
adapter.failNext("AUTH");
adapter.failNext("TIMEOUT", { times: 2 });

// Throw on every send until reset()
adapter.failAlways("RATE_LIMITED");

// Throw based on message content
adapter.failIf((msg) =>
  msg.to[0].email.endsWith("@blocked.test")
    ? "RECIPIENT_REJECTED"
    : undefined,
);

// Clear all simulations + inbox + counter
adapter.reset();
```

Priority: `failNext` queue → `failIf` predicate → `failAlways`.

Error codes are converted to `PostboteError` with correct `retryable` defaults.

### TestInbox

```ts
adapter.inbox.count();         // number of emails
adapter.inbox.all();           // all recorded emails (defensive copy)
adapter.inbox.last();          // most recent (throws if empty)
adapter.inbox.first();         // first (throws if empty)
adapter.inbox.at(0);           // by index (throws if out of range)

adapter.inbox.to("bob@test.com");       // to/cc/bcc match (case-insensitive)
adapter.inbox.from("alice@test.com");   // sender match
adapter.inbox.withSubject("Welcome");   // exact string or RegExp
adapter.inbox.find((e) => e.subject.startsWith("Hi"));

adapter.inbox.clear();
```

### SendCall

```ts
adapter.calls;  // all send() invocations (including failed ones)
// { message: EmailMessage, error?: PostboteError }[]
```

## Matchers

Optional Vitest matchers for a more fluent assertion style:

```ts
// vitest.setup.ts (or vitest.config.ts → setupFiles)
import "@postbote/testing/matchers";

// Tests
expect(adapter).toHaveSentEmail();
expect(adapter).toHaveSentEmail(2);             // exactly 2 emails
expect(adapter).toHaveSentEmailTo("bob@test.com");
expect(adapter).toHaveSentEmailMatching({
  to: "bob@test.com",
  subject: /^Welcome/,
  html: expect.stringContaining("Hello"),
});
```

| Matcher | Description |
|---|---|
| `toHaveSentEmail()` | Inbox is not empty |
| `toHaveSentEmail(n)` | Exactly n emails |
| `toHaveSentEmailTo(email)` | At least one email to address (to/cc/bcc) |
| `toHaveSentEmailMatching(query)` | At least one email matches all fields |

Negation works with `.not` for all matchers.

### `EmailQuery`

| Field | Type | Matches against |
|---|---|---|
| `to` | `string \| RegExp` | to/cc/bcc email |
| `from` | `string \| RegExp` | sender email |
| `subject` | `string \| RegExp` | subject |
| `html` | `string \| RegExp` | HTML body |
| `text` | `string \| RegExp` | text body |
| `tags` | `Record<string, string>` | tag subset |

## Design

- **No SMTP server, no HTML rendering** — intentionally lightweight
- Failed sends are NOT added to inbox (but are recorded in `calls`)
- Inbox entries are defensive copies (mutating input doesn't affect inbox)
- Deterministic `messageId`: `test-1`, `test-2`, …
- TestAdapter is a standard `Adapter` — works as failover fallback

## License

MIT — see [LICENSE.md](LICENSE.md).
