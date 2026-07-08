import { describe, expect, it } from "vitest";
import {
  toHaveSentEmail,
  toHaveSentEmailMatching,
  toHaveSentEmailTo,
} from "./matchers.js";
import { createTestAdapter, type TestAdapter } from "./test-adapter.js";

function adapterWithEmails(...subjects: string[]): TestAdapter {
  const a = createTestAdapter();
  for (const subject of subjects) {
    a.send({
      from: { email: "alice@test.com" },
      to: [{ email: "bob@test.com" }],
      subject,
      text: "body",
    });
  }
  return a;
}

const ctx = { isNot: false };

describe("toHaveSentEmail", () => {
  it("passes when inbox has emails", () => {
    const adapter = adapterWithEmails("Hello");
    const result = toHaveSentEmail.call(ctx, adapter);
    expect(result.pass).toBe(true);
  });

  it("fails when inbox is empty", () => {
    const adapter = createTestAdapter();
    const result = toHaveSentEmail.call(ctx, adapter);
    expect(result.pass).toBe(false);
    expect(result.message()).toContain("empty");
  });

  it("passes when count matches", () => {
    const adapter = adapterWithEmails("A", "B");
    const result = toHaveSentEmail.call(ctx, adapter, 2);
    expect(result.pass).toBe(true);
  });

  it("fails when count does not match", () => {
    const adapter = adapterWithEmails("A");
    const result = toHaveSentEmail.call(ctx, adapter, 3);
    expect(result.pass).toBe(false);
    expect(result.message()).toContain("1");
  });

  it("negation: fails when inbox has emails", () => {
    const adapter = adapterWithEmails("Hello");
    const result = toHaveSentEmail.call({ isNot: true }, adapter);
    expect(result.pass).toBe(true);
  });
});

describe("toHaveSentEmailTo", () => {
  it("passes when email was sent to address", () => {
    const adapter = adapterWithEmails("Hello");
    const result = toHaveSentEmailTo.call(ctx, adapter, "bob@test.com");
    expect(result.pass).toBe(true);
  });

  it("fails when no email sent to address", () => {
    const adapter = adapterWithEmails("Hello");
    const result = toHaveSentEmailTo.call(ctx, adapter, "nobody@test.com");
    expect(result.pass).toBe(false);
    expect(result.message()).toContain("nobody@test.com");
  });

  it("negation: fails when email was sent to address", () => {
    const adapter = adapterWithEmails("Hello");
    const result = toHaveSentEmailTo.call(
      { isNot: true },
      adapter,
      "bob@test.com",
    );
    expect(result.pass).toBe(true);
  });
});

describe("toHaveSentEmailMatching", () => {
  it("passes when email matches to", () => {
    const adapter = adapterWithEmails("Welcome");
    const result = toHaveSentEmailMatching.call(ctx, adapter, {
      to: "bob@test.com",
    });
    expect(result.pass).toBe(true);
  });

  it("passes when email matches from", () => {
    const adapter = adapterWithEmails("Welcome");
    const result = toHaveSentEmailMatching.call(ctx, adapter, {
      from: "alice@test.com",
    });
    expect(result.pass).toBe(true);
  });

  it("passes when email matches subject (string)", () => {
    const adapter = adapterWithEmails("Welcome");
    const result = toHaveSentEmailMatching.call(ctx, adapter, {
      subject: "Welcome",
    });
    expect(result.pass).toBe(true);
  });

  it("passes when email matches subject (regex)", () => {
    const adapter = adapterWithEmails("Your order #123");
    const result = toHaveSentEmailMatching.call(ctx, adapter, {
      subject: /order/,
    });
    expect(result.pass).toBe(true);
  });

  it("passes when email matches html", async () => {
    const adapter = createTestAdapter();
    await adapter.send({
      from: { email: "alice@test.com" },
      to: [{ email: "bob@test.com" }],
      subject: "Rich",
      html: "<p>Hello <strong>World</strong></p>",
    });
    const result = toHaveSentEmailMatching.call(ctx, adapter, {
      html: /Hello/,
    });
    expect(result.pass).toBe(true);
  });

  it("passes when email matches text", async () => {
    const adapter = createTestAdapter();
    await adapter.send({
      from: { email: "alice@test.com" },
      to: [{ email: "bob@test.com" }],
      subject: "Plain",
      text: "Hello World",
    });
    const result = toHaveSentEmailMatching.call(ctx, adapter, {
      text: /World/,
    });
    expect(result.pass).toBe(true);
  });

  it("passes when email matches tags", async () => {
    const adapter = createTestAdapter();
    await adapter.send({
      from: { email: "alice@test.com" },
      to: [{ email: "bob@test.com" }],
      subject: "Tagged",
      text: "body",
      tags: { category: "onboarding", environment: "test" },
    });
    const result = toHaveSentEmailMatching.call(ctx, adapter, {
      tags: { category: "onboarding" },
    });
    expect(result.pass).toBe(true);
  });

  it("fails when no email matches", () => {
    const adapter = adapterWithEmails("Welcome");
    const result = toHaveSentEmailMatching.call(ctx, adapter, {
      subject: "Goodbye",
    });
    expect(result.pass).toBe(false);
    expect(result.message()).toContain("Welcome");
  });

  it("combines multiple query fields", () => {
    const adapter = adapterWithEmails("Welcome");
    const result = toHaveSentEmailMatching.call(ctx, adapter, {
      to: "bob@test.com",
      from: "alice@test.com",
      subject: "Welcome",
    });
    expect(result.pass).toBe(true);
  });

  it("fails when combined query does not match", () => {
    const adapter = adapterWithEmails("Welcome");
    const result = toHaveSentEmailMatching.call(ctx, adapter, {
      to: "bob@test.com",
      subject: "Goodbye",
    });
    expect(result.pass).toBe(false);
  });

  it("negation: fails when email matches", () => {
    const adapter = adapterWithEmails("Welcome");
    const result = toHaveSentEmailMatching.call({ isNot: true }, adapter, {
      subject: "Welcome",
    });
    expect(result.pass).toBe(true);
  });
});
