import { describe, expect, it, vi } from "vitest";
import { defineAdapter, httpStatusToErrorCode } from "./define-adapter.js";
import { PostboteError } from "./errors.js";
import type { EmailMessage, Adapter } from "./types.js";

const validMessage: EmailMessage = {
  from: { email: "from@test.dev" },
  to: [{ email: "to@test.dev" }],
  subject: "test",
  html: "<p>hi</p>",
};

describe("defineAdapter", () => {
  it("returns an Adapter with the given name", () => {
    const adapter = defineAdapter({
      name: "my-provider",
      async send(msg, ctx) {
        return { messageId: "abc" };
      },
    });
    expect(adapter.name).toBe("my-provider");
    expect(typeof adapter.send).toBe("function");
  });

  it("throws TypeError on invalid name (uppercase)", () => {
    expect(() =>
      defineAdapter({ name: "MyProvider", async send() {
        return { messageId: "x" };
      } }),
    ).toThrow(TypeError);
  });

  it("throws TypeError on invalid name (spaces)", () => {
    expect(() =>
      defineAdapter({ name: "my provider", async send() {
        return { messageId: "x" };
      } }),
    ).toThrow(TypeError);
  });

  it("throws TypeError on invalid name (underscore)", () => {
    expect(() =>
      defineAdapter({ name: "my_provider", async send() {
        return { messageId: "x" };
      } }),
    ).toThrow(TypeError);
  });

  it("sets provider automatically in success result", async () => {
    const adapter = defineAdapter({
      name: "my-provider",
      async send() {
        return { messageId: "abc", raw: { ok: true } };
      },
    });
    const result = await adapter.send(validMessage);
    expect(result.provider).toBe("my-provider");
    expect(result.messageId).toBe("abc");
    expect(result.raw).toEqual({ ok: true });
  });

  it("passes signal to spec.send ctx", async () => {
    const spy = vi.fn();
    const adapter = defineAdapter({
      name: "test",
      async send(_msg, ctx) {
        spy(ctx.signal);
        return { messageId: "x" };
      },
    });
    const ctrl = new AbortController();
    await adapter.send(validMessage, { signal: ctrl.signal });
    expect(spy).toHaveBeenCalledWith(ctrl.signal);
  });

  it("throws ABORTED when signal is already aborted (spec.send never called)", async () => {
    const spy = vi.fn();
    const adapter = defineAdapter({
      name: "test",
      async send() {
        spy();
        return { messageId: "x" };
      },
    });
    const ctrl = new AbortController();
    ctrl.abort();

    await expect(adapter.send(validMessage, { signal: ctrl.signal })).rejects.toThrow(PostboteError);
    expect(spy).not.toHaveBeenCalled();
  });

  it("throws UNKNOWN for empty messageId", async () => {
    const adapter = defineAdapter({
      name: "test",
      async send() {
        return { messageId: "" };
      },
    });
    const err = await adapter.send(validMessage).catch((e) => e);
    expect(err).toBeInstanceOf(PostboteError);
    expect(err.code).toBe("UNKNOWN");
  });

  it("passes PostboteError from spec.send unchanged", async () => {
    const inner = new PostboteError("auth fail", {
      code: "AUTH",
      provider: "test",
    });
    const adapter = defineAdapter({
      name: "test",
      async send() {
        throw inner;
      },
    });
    await expect(adapter.send(validMessage)).rejects.toBe(inner);
  });

  it("wraps raw error as UNKNOWN when no mapUnknownError", async () => {
    const adapter = defineAdapter({
      name: "test",
      async send() {
        throw new Error("network gone");
      },
    });
    const err = await adapter.send(validMessage).catch((e) => e);
    expect(err).toBeInstanceOf(PostboteError);
    expect(err.code).toBe("UNKNOWN");
    expect(err.provider).toBe("test");
  });

  it("uses mapUnknownError returning ErrorCode", async () => {
    const adapter = defineAdapter({
      name: "test",
      async send() {
        throw new Error("timeout");
      },
      mapUnknownError() {
        return "TIMEOUT" as const;
      },
    });
    const err = await adapter.send(validMessage).catch((e) => e);
    expect(err).toBeInstanceOf(PostboteError);
    expect(err.code).toBe("TIMEOUT");
    expect(err.retryable).toBe(true);
  });

  it("uses mapUnknownError returning PostboteError", async () => {
    const mapped = new PostboteError("custom", {
      code: "PROVIDER_UNAVAILABLE",
      provider: "test",
    });
    const adapter = defineAdapter({
      name: "test",
      async send() {
        throw new Error("fail");
      },
      mapUnknownError() {
        return mapped;
      },
    });
    await expect(adapter.send(validMessage)).rejects.toBe(mapped);
  });
});

describe("httpStatusToErrorCode", () => {
  it.each([
    [401, "AUTH"],
    [403, "AUTH"],
    [408, "TIMEOUT"],
    [413, "INVALID_MESSAGE"],
    [422, "INVALID_MESSAGE"],
    [429, "RATE_LIMITED"],
    [500, "PROVIDER_UNAVAILABLE"],
    [502, "PROVIDER_UNAVAILABLE"],
    [503, "PROVIDER_UNAVAILABLE"],
    [200, "UNKNOWN"],
    [300, "UNKNOWN"],
    [418, "UNKNOWN"],
  ])("status %i → %s", (status, expected) => {
    expect(httpStatusToErrorCode(status)).toBe(expected);
  });
});