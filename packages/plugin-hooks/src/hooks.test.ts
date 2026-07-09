import { describe, expect, it, vi } from "vitest";
import { hooks } from "./index.js";
import { PostboteError, createPostbote } from "@postbote/core";
import { createTestAdapter } from "@postbote/testing";

describe("hooks", () => {
  it("calls beforeSend before the adapter", async () => {
    const order: string[] = [];
    const pb = createPostbote({
      adapter: createTestAdapter(),
      plugins: [
        hooks({
          beforeSend: async () => {
            order.push("before");
          },
        }),
      ],
    });
    await pb.send({ from: "f@t.com", to: "t@t.com", subject: "s", html: "<p>hi</p>" });
    expect(order).toEqual(["before"]);
  });

  it("cancel throws CANCELLED and adapter is never called", async () => {
    const pb = createPostbote({
      adapter: createTestAdapter(),
      plugins: [
        hooks({
          beforeSend: async (_ctx, { cancel }) => {
            cancel("blocked by policy");
          },
        }),
      ],
    });
    await expect(
      pb.send({ from: "f@t.com", to: "t@t.com", subject: "s", html: "<p>hi</p>" }),
    ).rejects.toMatchObject({ code: "CANCELLED", retryable: false });
  });

  it("beforeSend mutation of ctx.message reaches the adapter", async () => {
    const pb = createPostbote({
      adapter: createTestAdapter(),
      plugins: [
        hooks({
          beforeSend: async (ctx) => {
            ctx.message.subject = "mutated";
          },
        }),
      ],
    });
    const result = await pb.send({
      from: "f@t.com",
      to: "t@t.com",
      subject: "original",
      html: "<p>hi</p>",
    });
    expect(result.messageId).toBeTruthy();
  });

  it("throwing beforeSend normalizes to PostboteError", async () => {
    const pb = createPostbote({
      adapter: createTestAdapter(),
      plugins: [
        hooks({
          beforeSend: async () => {
            throw new Error("oops");
          },
        }),
      ],
    });
    const err = await pb
      .send({ from: "f@t.com", to: "t@t.com", subject: "s", html: "<p>hi</p>" })
      .catch((e) => e);
    expect(err).toBeInstanceOf(PostboteError);
    expect(err.code).toBe("UNKNOWN");
  });

  it("afterSend receives the result and errors are swallowed", async () => {
    const afterSpy = vi.fn();
    const pb = createPostbote({
      adapter: createTestAdapter(),
      plugins: [
        hooks({
          afterSend: async (_ctx, result) => {
            afterSpy(result);
            throw new Error("afterSend error");
          },
        }),
      ],
    });
    const result = await pb.send({
      from: "f@t.com",
      to: "t@t.com",
      subject: "s",
      html: "<p>hi</p>",
    });
    expect(result.messageId).toBeTruthy();
    expect(afterSpy).toHaveBeenCalled();
  });

  it("onError receives the error and errors are swallowed", async () => {
    const onErrorSpy = vi.fn();
    const badAdapter = createTestAdapter({ name: "bad" });
    badAdapter.failAlways("PROVIDER_UNAVAILABLE");
    const pb = createPostbote({
      adapter: badAdapter,
      plugins: [
        hooks({
          onError: async (_ctx, err) => {
            onErrorSpy(err);
            throw new Error("onError error");
          },
        }),
      ],
    });
    await expect(
      pb.send({ from: "f@t.com", to: "t@t.com", subject: "s", html: "<p>hi</p>" }),
    ).rejects.toMatchObject({ code: "PROVIDER_UNAVAILABLE" });
    expect(onErrorSpy).toHaveBeenCalled();
  });

  it("all hooks are optional", async () => {
    const pb = createPostbote({
      adapter: createTestAdapter(),
      plugins: [hooks({})],
    });
    const result = await pb.send({
      from: "f@t.com",
      to: "t@t.com",
      subject: "s",
      html: "<p>hi</p>",
    });
    expect(result.messageId).toBeTruthy();
  });
});