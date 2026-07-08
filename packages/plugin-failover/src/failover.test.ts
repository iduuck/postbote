import {
  createPostbote,
  type Middleware,
  PostboteError,
  type SendContext,
  type SendResult,
} from "@postbote/core";
import { createTestAdapter } from "@postbote/testing";
import { describe, expect, it, vi } from "vitest";
import { FailoverExhaustedError, failover } from "./index.js";

const dummyInput = {
  from: "f@t.com",
  to: "t@t.com",
  subject: "Hello",
  text: "World",
};

const dummyInput2 = {
  from: "f@t.com",
  to: "u@t.com",
  subject: "Second",
  text: "Body",
};

// -------------------------------------------------------------------
// failover.test.ts — core failover behavior
// -------------------------------------------------------------------
describe("failover", () => {
  it("sends via primary adapter when it succeeds", async () => {
    const primary = createTestAdapter({ name: "primary" });
    const fallback = createTestAdapter({ name: "fallback" });
    const pb = createPostbote({
      adapter: primary,
      plugins: [failover({ fallbacks: [fallback] })],
    });

    const result = await pb.send(dummyInput);

    expect(result.provider).toBe("primary");
    expect(primary.inbox.count()).toBe(1);
    expect(fallback.inbox.count()).toBe(0);
  });

  it("uses fallback when primary throws retryable error", async () => {
    const primary = createTestAdapter({ name: "primary" });
    const fallback = createTestAdapter({ name: "fallback" });
    primary.failAlways(
      new PostboteError("unavailable", {
        code: "PROVIDER_UNAVAILABLE",
        provider: "primary",
      }),
    );
    const pb = createPostbote({
      adapter: primary,
      plugins: [failover({ fallbacks: [fallback] })],
    });

    const result = await pb.send(dummyInput);

    expect(result.provider).toBe("fallback");
    expect(fallback.inbox.count()).toBe(1);
  });

  it("re-throws non-retryable error (AUTH) without failover", async () => {
    const primary = createTestAdapter({ name: "primary" });
    const fallback = createTestAdapter({ name: "fallback" });
    primary.failAlways(
      new PostboteError("bad key", { code: "AUTH", provider: "primary" }),
    );
    const pb = createPostbote({
      adapter: primary,
      plugins: [failover({ fallbacks: [fallback] })],
    });

    await expect(pb.send(dummyInput)).rejects.toThrow(
      expect.objectContaining({ code: "AUTH", provider: "primary" }),
    );
    expect(fallback.inbox.count()).toBe(0);
  });

  it("re-throws RECIPIENT_REJECTED without failover", async () => {
    const primary = createTestAdapter({ name: "primary" });
    const fallback = createTestAdapter({ name: "fallback" });
    primary.failAlways(
      new PostboteError("rejected", {
        code: "RECIPIENT_REJECTED",
        provider: "primary",
      }),
    );
    const pb = createPostbote({
      adapter: primary,
      plugins: [failover({ fallbacks: [fallback] })],
    });

    await expect(pb.send(dummyInput)).rejects.toThrow(
      expect.objectContaining({ code: "RECIPIENT_REJECTED" }),
    );
    expect(fallback.inbox.count()).toBe(0);
  });

  it("skips to third adapter when first two fail", async () => {
    const a1 = createTestAdapter({ name: "a1" });
    const a2 = createTestAdapter({ name: "a2" });
    const a3 = createTestAdapter({ name: "a3" });
    a1.failAlways(
      new PostboteError("down", {
        code: "PROVIDER_UNAVAILABLE",
        provider: "a1",
      }),
    );
    a2.failAlways(
      new PostboteError("down", {
        code: "PROVIDER_UNAVAILABLE",
        provider: "a2",
      }),
    );
    const pb = createPostbote({
      adapter: a1,
      plugins: [failover({ fallbacks: [a2, a3] })],
    });

    const result = await pb.send(dummyInput);

    expect(result.provider).toBe("a3");
    expect(a3.inbox.count()).toBe(1);
  });

  it("accumulates all attempts in ctx.attempts", async () => {
    const a1 = createTestAdapter({ name: "a1" });
    const a2 = createTestAdapter({ name: "a2" });
    const a3 = createTestAdapter({ name: "a3" });
    a1.failAlways(
      new PostboteError("down", {
        code: "PROVIDER_UNAVAILABLE",
        provider: "a1",
      }),
    );
    a2.failAlways(
      new PostboteError("down", {
        code: "PROVIDER_UNAVAILABLE",
        provider: "a2",
      }),
    );

    let captured: SendContext | undefined;
    const captureMw: Middleware = async (ctx, next) => {
      captured = ctx;
      return next();
    };

    const pb = createPostbote({
      adapter: a1,
      plugins: [captureMw, failover({ fallbacks: [a2, a3] })],
    });

    await pb.send(dummyInput);

    expect(captured?.attempts).toHaveLength(3);
    expect(captured?.attempts[0]?.adapter).toBe("a1");
    expect(captured?.attempts[0]?.error?.code).toBe("PROVIDER_UNAVAILABLE");
    expect(captured?.attempts[1]?.adapter).toBe("a2");
    expect(captured?.attempts[1]?.error?.code).toBe("PROVIDER_UNAVAILABLE");
    expect(captured?.attempts[2]?.adapter).toBe("a3");
    expect(captured?.attempts[2]?.error).toBeUndefined();
  });

  it("throws FailoverExhaustedError when all adapters fail", async () => {
    const a1 = createTestAdapter({ name: "a1" });
    const a2 = createTestAdapter({ name: "a2" });
    a1.failAlways(
      new PostboteError("down", {
        code: "PROVIDER_UNAVAILABLE",
        provider: "a1",
      }),
    );
    a2.failAlways(
      new PostboteError("down", {
        code: "PROVIDER_UNAVAILABLE",
        provider: "a2",
      }),
    );
    const pb = createPostbote({
      adapter: a1,
      plugins: [failover({ fallbacks: [a2] })],
    });

    const err = await pb.send(dummyInput).catch((e) => e);

    expect(err).toBeInstanceOf(FailoverExhaustedError);
    expect(err.code).toBe("PROVIDER_UNAVAILABLE");
    expect(err.retryable).toBe(true);
    expect(err.provider).toBe("failover");
    expect(err.attempts).toHaveLength(2);
    expect(err.attempts[0]?.adapter).toBe("a1");
    expect(err.attempts[1]?.adapter).toBe("a2");
    expect(err.cause).toBeDefined();
    expect((err.cause as PostboteError).code).toBe("PROVIDER_UNAVAILABLE");
  });

  it("is not sticky — next send goes through primary again", async () => {
    const primary = createTestAdapter({ name: "primary" });
    const fallback = createTestAdapter({ name: "fallback" });
    const failErr = new PostboteError("down", {
      code: "PROVIDER_UNAVAILABLE",
      provider: "primary",
    });
    primary.failNext(failErr, { times: 1 });
    const pb = createPostbote({
      adapter: primary,
      plugins: [failover({ fallbacks: [fallback] })],
    });

    const r1 = await pb.send(dummyInput);
    expect(r1.provider).toBe("fallback");

    const r2 = await pb.send(dummyInput2);
    expect(r2.provider).toBe("primary");
    expect(primary.inbox.count()).toBe(1);
    expect(fallback.inbox.count()).toBe(1);
  });
});

// -------------------------------------------------------------------
// options.test.ts — shouldFailover & onFailover behavior
// -------------------------------------------------------------------
describe("failover options", () => {
  it("shouldFailover: () => true failovers even AUTH", async () => {
    const primary = createTestAdapter({ name: "primary" });
    const fallback = createTestAdapter({ name: "fallback" });
    primary.failAlways(
      new PostboteError("bad key", { code: "AUTH", provider: "primary" }),
    );
    const pb = createPostbote({
      adapter: primary,
      plugins: [
        failover({
          fallbacks: [fallback],
          shouldFailover: () => true,
        }),
      ],
    });

    const result = await pb.send(dummyInput);

    expect(result.provider).toBe("fallback");
    expect(fallback.inbox.count()).toBe(1);
  });

  it("shouldFailover: () => false never failovers", async () => {
    const primary = createTestAdapter({ name: "primary" });
    const fallback = createTestAdapter({ name: "fallback" });
    primary.failAlways(
      new PostboteError("down", {
        code: "PROVIDER_UNAVAILABLE",
        provider: "primary",
      }),
    );
    const pb = createPostbote({
      adapter: primary,
      plugins: [
        failover({
          fallbacks: [fallback],
          shouldFailover: () => false,
        }),
      ],
    });

    await expect(pb.send(dummyInput)).rejects.toThrow(
      expect.objectContaining({ code: "PROVIDER_UNAVAILABLE" }),
    );
    expect(fallback.inbox.count()).toBe(0);
  });

  it("shouldFailover receives error and ctx", async () => {
    const primary = createTestAdapter({ name: "primary" });
    const fallback = createTestAdapter({ name: "fallback" });
    primary.failAlways(
      new PostboteError("down", {
        code: "PROVIDER_UNAVAILABLE",
        provider: "primary",
      }),
    );

    const spy = vi.fn().mockReturnValue(true);
    const pb = createPostbote({
      adapter: primary,
      plugins: [
        failover({
          fallbacks: [fallback],
          shouldFailover: spy,
        }),
      ],
    });

    await pb.send(dummyInput);

    expect(spy).toHaveBeenCalledOnce();
    const [error, ctx] = spy.mock.calls[0] as [PostboteError, SendContext];
    expect(error.code).toBe("PROVIDER_UNAVAILABLE");
    expect(ctx).toHaveProperty("message");
    expect(ctx).toHaveProperty("adapter");
  });

  it("onFailover fires with correct info on each switch", async () => {
    const a1 = createTestAdapter({ name: "a1" });
    const a2 = createTestAdapter({ name: "a2" });
    const a3 = createTestAdapter({ name: "a3" });
    a1.failAlways(
      new PostboteError("down", {
        code: "PROVIDER_UNAVAILABLE",
        provider: "a1",
      }),
    );
    a2.failAlways(
      new PostboteError("down", {
        code: "PROVIDER_UNAVAILABLE",
        provider: "a2",
      }),
    );

    const onFailover = vi.fn();
    const pb = createPostbote({
      adapter: a1,
      plugins: [failover({ fallbacks: [a2, a3], onFailover })],
    });

    await pb.send(dummyInput);

    expect(onFailover).toHaveBeenCalledTimes(2);
    expect(onFailover.mock.calls[0]?.[0]).toMatchObject({
      from: "a1",
      to: "a2",
      attempt: 1,
    });
    expect(onFailover.mock.calls[1]?.[0]).toMatchObject({
      from: "a2",
      to: "a3",
      attempt: 2,
    });
  });

  it("onFailover not fired on the last exhausting error", async () => {
    const a1 = createTestAdapter({ name: "a1" });
    a1.failAlways(
      new PostboteError("down", {
        code: "PROVIDER_UNAVAILABLE",
        provider: "a1",
      }),
    );
    const onFailover = vi.fn();
    const pb = createPostbote({
      adapter: a1,
      plugins: [failover({ fallbacks: [], onFailover })],
    });

    await pb.send(dummyInput).catch(() => {});

    expect(onFailover).not.toHaveBeenCalled();
  });

  it("onFailover throwing does not break the send", async () => {
    const primary = createTestAdapter({ name: "primary" });
    const fallback = createTestAdapter({ name: "fallback" });
    primary.failAlways(
      new PostboteError("down", {
        code: "PROVIDER_UNAVAILABLE",
        provider: "primary",
      }),
    );
    const pb = createPostbote({
      adapter: primary,
      plugins: [
        failover({
          fallbacks: [fallback],
          onFailover: () => {
            throw new Error("hook crashed");
          },
        }),
      ],
    });

    const result = await pb.send(dummyInput);

    expect(result.provider).toBe("fallback");
  });
});

// -------------------------------------------------------------------
// integration.test.ts — pipeline composition
// -------------------------------------------------------------------
describe("failover integration", () => {
  it("outer plugin sees exactly one call despite failover", async () => {
    const primary = createTestAdapter({ name: "primary" });
    const fallback = createTestAdapter({ name: "fallback" });
    primary.failAlways(
      new PostboteError("down", {
        code: "PROVIDER_UNAVAILABLE",
        provider: "primary",
      }),
    );

    const outerSpy = vi.fn(
      async (_ctx: SendContext, next: () => Promise<SendResult>) => next(),
    );

    const pb = createPostbote({
      adapter: primary,
      plugins: [outerSpy, failover({ fallbacks: [fallback] })],
    });

    await pb.send(dummyInput);

    expect(outerSpy).toHaveBeenCalledTimes(1);
  });

  it("inner plugin (behind failover) runs per attempt", async () => {
    const primary = createTestAdapter({ name: "primary" });
    const fallback = createTestAdapter({ name: "fallback" });
    primary.failAlways(
      new PostboteError("down", {
        code: "PROVIDER_UNAVAILABLE",
        provider: "primary",
      }),
    );

    const innerSpy = vi.fn(
      async (_ctx: SendContext, next: () => Promise<SendResult>) => next(),
    );

    const pb = createPostbote({
      adapter: primary,
      // failover is outermost, innerSpy is innermost (runs per next() call)
      plugins: [failover({ fallbacks: [fallback] }), innerSpy],
    });

    await pb.send(dummyInput);

    // Called twice: once for primary (fails), once for fallback (succeeds)
    expect(innerSpy).toHaveBeenCalledTimes(2);
  });

  it("empty fallbacks with retryable error throws FailoverExhaustedError", async () => {
    const primary = createTestAdapter({ name: "primary" });
    primary.failAlways(
      new PostboteError("down", {
        code: "PROVIDER_UNAVAILABLE",
        provider: "primary",
      }),
    );
    const pb = createPostbote({
      adapter: primary,
      plugins: [failover({ fallbacks: [] })],
    });

    const err = await pb.send(dummyInput).catch((e) => e);

    expect(err).toBeInstanceOf(FailoverExhaustedError);
    expect(err.attempts).toHaveLength(1);
  });

  it("empty fallbacks with non-retryable error re-throws directly", async () => {
    const primary = createTestAdapter({ name: "primary" });
    primary.failAlways(
      new PostboteError("bad key", { code: "AUTH", provider: "primary" }),
    );
    const pb = createPostbote({
      adapter: primary,
      plugins: [failover({ fallbacks: [] })],
    });

    await expect(pb.send(dummyInput)).rejects.toThrow(
      expect.objectContaining({ code: "AUTH", provider: "primary" }),
    );
  });
});
