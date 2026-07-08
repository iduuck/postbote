import type { RecordedEmail, TestInbox } from "./inbox.js";
import type { TestAdapter } from "./test-adapter.js";

export interface EmailQuery {
  to?: string | RegExp;
  from?: string | RegExp;
  subject?: string | RegExp;
  html?: string | RegExp;
  text?: string | RegExp;
  tags?: Record<string, string>;
}

function matchField(
  value: string | undefined,
  pattern: string | RegExp | undefined,
): boolean {
  if (pattern === undefined) return true;
  if (value === undefined) return false;
  if (typeof pattern === "string") return value === pattern;
  return pattern.test(value);
}

function matchTags(
  emailTags: Record<string, string> | undefined,
  query: Record<string, string> | undefined,
): boolean {
  if (query === undefined) return true;
  if (emailTags === undefined) return false;
  for (const key of Object.keys(query)) {
    if (emailTags[key] !== query[key]) return false;
  }
  return true;
}

function emailMatches(email: RecordedEmail, query: EmailQuery): boolean {
  if (query.to !== undefined) {
    const lower =
      typeof query.to === "string" ? query.to.toLowerCase() : query.to;
    const matchesRecipient =
      email.to.some((a) =>
        typeof lower === "string"
          ? a.email.toLowerCase() === lower
          : lower.test(a.email),
      ) ||
      email.cc?.some((a) =>
        typeof lower === "string"
          ? a.email.toLowerCase() === lower
          : lower.test(a.email),
      ) ||
      email.bcc?.some((a) =>
        typeof lower === "string"
          ? a.email.toLowerCase() === lower
          : lower.test(a.email),
      );
    if (!matchesRecipient) return false;
  }
  if (!matchField(email.from.email, query.from)) return false;
  if (!matchField(email.subject, query.subject)) return false;
  if (!matchField(email.html, query.html)) return false;
  if (!matchField(email.text, query.text)) return false;
  if (!matchTags(email.tags, query.tags)) return false;
  return true;
}

function inboxSubjects(inbox: TestInbox): string {
  return inbox
    .all()
    .map((e) => `  - "${e.subject}"`)
    .join("\n");
}

interface MatcherContext {
  isNot: boolean;
  equals?: (a: unknown, b: unknown) => boolean;
  utils?: {
    printReceived?: (obj: unknown) => string;
    printExpected?: (obj: unknown) => string;
  };
}

export type MatcherResult = { pass: boolean; message: () => string };

export function toHaveSentEmail(
  this: MatcherContext,
  adapter: TestAdapter,
  expectedCount?: number,
): MatcherResult {
  const count = adapter.inbox.count();

  if (expectedCount !== undefined) {
    const pass = count === expectedCount;
    return {
      pass,
      message: () => {
        if (this.isNot) {
          return `Expected adapter not to have sent exactly ${expectedCount} email(s), but it did`;
        }
        return `Expected adapter to have sent ${expectedCount} email(s), but it sent ${count}\n${inboxSubjects(adapter.inbox)}`;
      },
    };
  }

  const pass = count > 0;
  return {
    pass,
    message: () => {
      if (this.isNot) {
        return "Expected adapter not to have sent any emails, but it did";
      }
      return "Expected adapter to have sent at least one email, but inbox is empty";
    },
  };
}

export function toHaveSentEmailTo(
  this: MatcherContext,
  adapter: TestAdapter,
  email: string,
): MatcherResult {
  const matching = adapter.inbox.to(email);
  const pass = matching.length > 0;

  return {
    pass,
    message: () => {
      if (this.isNot) {
        return `Expected adapter not to have sent any email to "${email}", but it sent ${matching.length}`;
      }
      return `Expected adapter to have sent an email to "${email}", but none found\nInbox subjects:\n${inboxSubjects(adapter.inbox)}`;
    },
  };
}

export function toHaveSentEmailMatching(
  this: MatcherContext,
  adapter: TestAdapter,
  query: EmailQuery,
): MatcherResult {
  const all = adapter.inbox.all();
  const matching = all.filter((e) => emailMatches(e, query));
  const pass = matching.length > 0;

  return {
    pass,
    message: () => {
      if (this.isNot) {
        return `Expected adapter not to have sent any email matching the query, but ${matching.length} did`;
      }
      return `Expected adapter to have sent an email matching the query, but none found\nInbox subjects:\n${inboxSubjects(adapter.inbox)}`;
    },
  };
}
