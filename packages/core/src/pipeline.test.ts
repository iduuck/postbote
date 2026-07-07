import { describe, expect, it, vi } from "vitest";
import { PostboteError } from "./errors.js";
import type { SendAttempt } from "./pipeline.js";
import { compose } from "./pipeline.js";
import type { Adapter, EmailMessage, SendResult } from "./types.js";

function fakeAdapter(name: string, fail = false): Adapter {
  return {
    name,
    async send(_msg: EmailMessage): Promise<SendResult> {
      if (fail) throw new Error(`${name} failed`);
      return { messageId: `${name}-id`, provider: name };
    },
  };
}

const dummyMessage: EmailMessage = {
  from: { email: "f@t.com" },
  to: [{ email: "t@t.com" }],
  subject: "test",
  text: "body",
};

describe("compose", () => {
  it("calls adapter directly with empty middleware", async () => {
    const adapter = fakeAdapter("direct");
    const pipeline = compose([]);
    const result = await pipeline({
      message: dummyMessage,
      adapter,
      attempts: [],
    });
    expect(result.messageId).toBe("direct-id");
  });

  it("executes middleware in correct order (onion model)", async () => {
    const order: string[] = [];
    const mw1 = async (ctx: any, next: any) => {
      order.push("a-before");
      const res = await next();
      order.push("a-after");
      return res;
    };
    const mw2 = async (ctx: any, next: any) => {
      order.push("b-before");
      const res = await next();
      order.push("b-after");
      return res;
    };
    const adapter = fakeAdapter("test");
    const pipeline = compose([mw1, mw2]);
    await pipeline({ message: dummyMessage, adapter, attempts: [] });
    expect(order).toEqual(["a-before", "b-before", "b-after", "a-after"]);
  });

  it("allows middleware to replace ctx.message", async () => {
    const mw = async (ctx: any, next: any) => {
      ctx.message = { ...ctx.message, subject: "REPLACED" };
      return next();
    };
    const adapter = {
      name: "spy",
      async send(msg: EmailMessage) {
        return { messageId: msg.subject, provider: "spy" };
      },
    };
    const pipeline = compose([mw]);
    const result = await pipeline({
      message: dummyMessage,
      adapter,
      attempts: [],
    });
    expect(result.messageId).toBe("REPLACED");
  });

  it("allows middleware to swap adapter and call next() again (failover basis)", async () => {
    const primary = fakeAdapter("primary", true);
    const fallback = fakeAdapter("fallback");
    const order: string[] = [];

    const failoverMw = async (ctx: any, next: any) => {
      ctx.adapter = primary;
      try {
        return await next();
      } catch {
        ctx.adapter = fallback;
        order.push("failover-to-fallback");
        return next();
      }
    };

    const pipeline = compose([failoverMw]);
    const result = await pipeline({
      message: dummyMessage,
      adapter: primary,
      attempts: [],
    });
    expect(result.messageId).toBe("fallback-id");
    expect(result.provider).toBe("fallback");
    expect(order).toContain("failover-to-fallback");
  });

  it("records successful attempt in ctx.attempts", async () => {
    const adapter = fakeAdapter("recorder");
    const pipeline = compose([]);
    const attempts: SendAttempt[] = [];
    const ctx = { message: dummyMessage, adapter, attempts };
    await pipeline(ctx);
    expect(ctx.attempts).toHaveLength(1);
    expect(ctx.attempts[0]).toEqual({ adapter: "recorder" });
  });

  it("records failed attempt with error in ctx.attempts", async () => {
    const adapter = fakeAdapter("failer", true);
    const pipeline = compose([]);
    const attempts: SendAttempt[] = [];
    const ctx = { message: dummyMessage, adapter, attempts };
    await expect(pipeline(ctx)).rejects.toThrow(PostboteError);
    expect(ctx.attempts).toHaveLength(1);
    expect(ctx.attempts[0]!.adapter).toBe("failer");
    expect(ctx.attempts[0]!.error).toBeDefined();
    expect(ctx.attempts[0]!.error!.code).toBe("UNKNOWN");
  });

  it("records multiple attempts with correct order on retry", async () => {
    const primary = fakeAdapter("p1", true);
    const fallback = fakeAdapter("p2");
    const failoverMw = async (ctx: any, next: any) => {
      ctx.adapter = primary;
      try {
        return await next();
      } catch {
        ctx.adapter = fallback;
        return next();
      }
    };
    const pipeline = compose([failoverMw]);
    const attempts: SendAttempt[] = [];
    const ctx = { message: dummyMessage, adapter: primary, attempts };
    await pipeline(ctx);
    expect(ctx.attempts).toHaveLength(2);
    expect(ctx.attempts[0]!.adapter).toBe("p1");
    expect(ctx.attempts[0]!.error).toBeDefined();
    expect(ctx.attempts[1]!.adapter).toBe("p2");
    expect(ctx.attempts[1]!.error).toBeUndefined();
  });

  it("normalizes raw adapter error to PostboteError with UNKNOWN", async () => {
    const adapter = fakeAdapter("thrower", true);
    const pipeline = compose([]);
    await expect(
      pipeline({ message: dummyMessage, adapter, attempts: [] }),
    ).rejects.toThrow(PostboteError);
  });

  it("allows middleware to short-circuit without calling next()", async () => {
    const mw = async (_ctx: any, _next: any) => {
      return { messageId: "short-circuit", provider: "mw" };
    };
    const adapter = fakeAdapter("never-called");
    const pipeline = compose([mw]);
    const result = await pipeline({
      message: dummyMessage,
      adapter,
      attempts: [],
    });
    expect(result.messageId).toBe("short-circuit");
  });
});
