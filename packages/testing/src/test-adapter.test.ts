import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createTestAdapter, type TestAdapter } from "./test-adapter.js";

const minimalMessage = {
  from: { email: "alice@test.com", name: "Alice" },
  to: [{ email: "bob@test.com", name: "Bob" }],
  subject: "Hello",
  text: "World",
};

describe("TestAdapter", () => {
  let adapter: TestAdapter;

  beforeEach(() => {
    adapter = createTestAdapter();
  });

  afterEach(() => {
    adapter.reset();
  });

  describe("successful send", () => {
    it("lands email in inbox", async () => {
      await adapter.send(minimalMessage);
      expect(adapter.inbox.count()).toBe(1);
    });

    it("generates deterministic messageId: test-1, test-2, …", async () => {
      const r1 = await adapter.send(minimalMessage);
      const r2 = await adapter.send(minimalMessage);
      expect(r1.messageId).toBe("test-1");
      expect(r2.messageId).toBe("test-2");
    });

    it("includes provider in SendResult", async () => {
      const result = await adapter.send(minimalMessage);
      expect(result.provider).toBe("test");
    });

    it("uses configured name as provider", async () => {
      const a = createTestAdapter({ name: "primary" });
      const result = await a.send(minimalMessage);
      expect(result.provider).toBe("primary");
      expect(result.messageId).toBe("primary-1");
    });

    it("records sentAt date", async () => {
      await adapter.send(minimalMessage);
      const email = adapter.inbox.last();
      expect(email.sentAt).toBeInstanceOf(Date);
    });

    it("records attempt number", async () => {
      await adapter.send(minimalMessage);
      expect(adapter.inbox.last().attempt).toBe(1);
      await adapter.send(minimalMessage);
      expect(adapter.inbox.last().attempt).toBe(2);
    });
  });

  describe("calls", () => {
    it("records all send invocations", async () => {
      await adapter.send(minimalMessage);
      expect(adapter.calls).toHaveLength(1);
    });

    it("includes failed sends", async () => {
      adapter.failNext("PROVIDER_UNAVAILABLE");
      try {
        await adapter.send(minimalMessage);
      } catch {
        // expected
      }
      expect(adapter.calls).toHaveLength(1);
      expect(adapter.calls[0]?.error).toBeDefined();
    });
  });

  describe("failNext", () => {
    it("throws PROVIDER_UNAVAILABLE by default", async () => {
      adapter.failNext();
      await expect(adapter.send(minimalMessage)).rejects.toMatchObject({
        code: "PROVIDER_UNAVAILABLE",
        retryable: true,
      });
    });

    it("accepts ErrorCode shortcut", async () => {
      adapter.failNext("AUTH");
      await expect(adapter.send(minimalMessage)).rejects.toMatchObject({
        code: "AUTH",
        retryable: false,
      });
    });

    it("accepts PostboteError directly", async () => {
      const { PostboteError } = await import("@postbote/core");
      adapter.failNext(
        new PostboteError("custom", { code: "TIMEOUT", provider: "x" }),
      );
      await expect(adapter.send(minimalMessage)).rejects.toMatchObject({
        code: "TIMEOUT",
      });
    });

    it("succeeds after configured failures (times: 1 by default)", async () => {
      adapter.failNext("PROVIDER_UNAVAILABLE");
      await expect(adapter.send(minimalMessage)).rejects.toThrow();
      await expect(adapter.send(minimalMessage)).resolves.toBeDefined();
    });

    it("supports multiple failures with times option", async () => {
      adapter.failNext("PROVIDER_UNAVAILABLE", { times: 2 });
      await expect(adapter.send(minimalMessage)).rejects.toThrow();
      await expect(adapter.send(minimalMessage)).rejects.toThrow();
      await expect(adapter.send(minimalMessage)).resolves.toBeDefined();
    });

    it("queues multiple failNext calls in order", async () => {
      adapter.failNext("AUTH");
      adapter.failNext("TIMEOUT");
      await expect(adapter.send(minimalMessage)).rejects.toMatchObject({
        code: "AUTH",
      });
      await expect(adapter.send(minimalMessage)).rejects.toMatchObject({
        code: "TIMEOUT",
      });
      await expect(adapter.send(minimalMessage)).resolves.toBeDefined();
    });
  });

  describe("failAlways", () => {
    it("throws on every send", async () => {
      adapter.failAlways("RATE_LIMITED");
      await expect(adapter.send(minimalMessage)).rejects.toMatchObject({
        code: "RATE_LIMITED",
      });
      await expect(adapter.send(minimalMessage)).rejects.toMatchObject({
        code: "RATE_LIMITED",
      });
    });

    it("stops after reset", async () => {
      adapter.failAlways("RATE_LIMITED");
      await expect(adapter.send(minimalMessage)).rejects.toThrow();
      adapter.reset();
      await expect(adapter.send(minimalMessage)).resolves.toBeDefined();
    });
  });

  describe("failIf", () => {
    it("selectively fails based on predicate", async () => {
      adapter.failIf((msg) =>
        msg.to[0]?.email.endsWith("@blocked.test")
          ? ("RECIPIENT_REJECTED" as const)
          : undefined,
      );

      const blocked = {
        ...minimalMessage,
        to: [{ email: "user@blocked.test" }],
      };
      await expect(adapter.send(blocked)).rejects.toMatchObject({
        code: "RECIPIENT_REJECTED",
      });
      await expect(adapter.send(minimalMessage)).resolves.toBeDefined();
    });
  });

  describe("priority: failNext > failIf > failAlways", () => {
    it("failNext takes priority over failIf", async () => {
      adapter.failNext("TIMEOUT");
      adapter.failIf(() => "RECIPIENT_REJECTED");
      await expect(adapter.send(minimalMessage)).rejects.toMatchObject({
        code: "TIMEOUT",
      });
    });

    it("failNext takes priority over failAlways", async () => {
      adapter.failNext("TIMEOUT");
      adapter.failAlways("RATE_LIMITED");
      await expect(adapter.send(minimalMessage)).rejects.toMatchObject({
        code: "TIMEOUT",
      });
    });

    it("failIf takes priority over failAlways", async () => {
      adapter.failIf(() => "RECIPIENT_REJECTED");
      adapter.failAlways("RATE_LIMITED");
      await expect(adapter.send(minimalMessage)).rejects.toMatchObject({
        code: "RECIPIENT_REJECTED",
      });
    });
  });

  describe("failed sends not in inbox", () => {
    it("does not store failed sends in inbox", async () => {
      adapter.failNext("AUTH");
      try {
        await adapter.send(minimalMessage);
      } catch {
        // expected
      }
      expect(adapter.inbox.count()).toBe(0);
    });
  });

  describe("reset", () => {
    it("clears inbox", async () => {
      await adapter.send(minimalMessage);
      adapter.reset();
      expect(adapter.inbox.count()).toBe(0);
    });

    it("clears calls", async () => {
      await adapter.send(minimalMessage);
      adapter.reset();
      expect(adapter.calls).toHaveLength(0);
    });

    it("clears fail simulations", async () => {
      adapter.failAlways("AUTH");
      adapter.reset();
      await expect(adapter.send(minimalMessage)).resolves.toBeDefined();
    });

    it("resets counter", async () => {
      await adapter.send(minimalMessage);
      adapter.reset();
      const result = await adapter.send(minimalMessage);
      expect(result.messageId).toBe("test-1");
    });
  });

  describe("latencyMs", () => {
    it("delays send by configured milliseconds", async () => {
      vi.useFakeTimers();
      const slow = createTestAdapter({ latencyMs: 100 });

      const sendPromise = slow.send(minimalMessage);
      await vi.advanceTimersByTimeAsync(99);
      expect(slow.inbox.count()).toBe(0);
      await vi.advanceTimersByTimeAsync(1);
      await sendPromise;
      expect(slow.inbox.count()).toBe(1);

      vi.useRealTimers();
    });
  });

  describe("mutation safety", () => {
    it("does not mutate input message", async () => {
      const msg = {
        from: { email: "alice@test.com" },
        to: [{ email: "bob@test.com" }],
        subject: "Safe",
        text: "body",
      };
      const _originalSubject = msg.subject;
      await adapter.send(msg);
      msg.subject = "Mutated";
      expect(adapter.inbox.last().subject).toBe("Safe");
    });

    it("inbox entries are copies — mutation does not affect inbox", async () => {
      await adapter.send(minimalMessage);
      const email = adapter.inbox.last();
      email.subject = "Hacked";
      expect(adapter.inbox.last().subject).toBe("Hello");
    });
  });

  describe("AbortSignal", () => {
    it("throws ABORTED when signal is already aborted", async () => {
      const controller = new AbortController();
      controller.abort();
      await expect(
        adapter.send(minimalMessage, { signal: controller.signal }),
      ).rejects.toMatchObject({
        code: "ABORTED",
      });
    });

    it("does not count aborted send in inbox", async () => {
      const controller = new AbortController();
      controller.abort();
      try {
        await adapter.send(minimalMessage, { signal: controller.signal });
      } catch {
        // expected
      }
      expect(adapter.inbox.count()).toBe(0);
    });
  });
});
