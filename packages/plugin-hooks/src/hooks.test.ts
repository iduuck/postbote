import {
  createPostbote,
  PostboteError,
  type SendContext,
} from "@postbote/core";
import { failover } from "@postbote/plugin-failover";
import { createTestAdapter } from "@postbote/testing";
import { describe, expect, it, vi } from "vitest";
import { hooks } from "./index.js";

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
    await pb.send({
      from: "f@t.com",
      to: "t@t.com",
      subject: "s",
      html: "<p>hi</p>",
    });
    expect(order).toEqual(["before"]);
  });

  it("transforms the normalized message before beforeSend and the adapter", async () => {
    const adapter = createTestAdapter();
    const seenSubjects: string[] = [];
    const pb = createPostbote({
      adapter,
      plugins: [
        hooks({
          transformMessage: (message) => ({
            ...message,
            subject: "Welcome",
            headers: { ...message.headers, "X-Campaign": "onboarding" },
            tags: { ...message.tags, campaign: "onboarding" },
          }),
          beforeSend: (ctx) => {
            seenSubjects.push(ctx.message.subject);
          },
        }),
      ],
    });

    await pb.send({
      from: "f@t.com",
      to: "t@t.com",
      subject: "Original",
      html: "<p>hi</p>",
    });

    expect(seenSubjects).toEqual(["Welcome"]);
    expect(adapter.inbox.last()).toMatchObject({
      subject: "Welcome",
      headers: { "X-Campaign": "onboarding" },
      tags: { campaign: "onboarding" },
    });
  });

  it("validates transformed payloads before the adapter", async () => {
    const adapter = createTestAdapter();
    const pb = createPostbote({
      adapter,
      plugins: [
        hooks({
          transformMessage: (message) => ({
            ...message,
            subject: "Unsafe\r\nBcc: attacker@example.com",
          }),
        }),
      ],
    });

    await expect(
      pb.send({
        from: "f@t.com",
        to: "t@t.com",
        subject: "Original",
        html: "<p>hi</p>",
      }),
    ).rejects.toMatchObject({ code: "INVALID_MESSAGE" });
    expect(adapter.calls).toHaveLength(0);
  });

  it("normalizes errors thrown by transformMessage", async () => {
    const pb = createPostbote({
      adapter: createTestAdapter(),
      plugins: [
        hooks({
          transformMessage: () => {
            throw new Error("template lookup failed");
          },
        }),
      ],
    });

    await expect(
      pb.send({
        from: "f@t.com",
        to: "t@t.com",
        subject: "Original",
        html: "<p>hi</p>",
      }),
    ).rejects.toMatchObject({ code: "UNKNOWN", provider: "plugin-hooks" });
  });

  it("cancel throws CANCELLED and adapter is never called", async () => {
    const adapter = createTestAdapter();
    const pb = createPostbote({
      adapter,
      plugins: [
        hooks({
          beforeSend: async (_ctx, { cancel }) => {
            cancel("blocked by policy");
          },
        }),
      ],
    });
    await expect(
      pb.send({
        from: "f@t.com",
        to: "t@t.com",
        subject: "s",
        html: "<p>hi</p>",
      }),
    ).rejects.toMatchObject({ code: "CANCELLED", retryable: false });
    expect(adapter.calls).toHaveLength(0);
  });

  it("does not fail over after a policy cancellation", async () => {
    const primary = createTestAdapter({ name: "primary" });
    const fallback = createTestAdapter({ name: "fallback" });
    const pb = createPostbote({
      adapter: primary,
      plugins: [
        hooks({
          beforeSend: (_ctx, { cancel }) => cancel("blocked by policy"),
        }),
        failover({ fallbacks: [fallback] }),
      ],
    });

    await expect(
      pb.send({
        from: "f@t.com",
        to: "t@t.com",
        subject: "s",
        html: "<p>hi</p>",
      }),
    ).rejects.toMatchObject({ code: "CANCELLED" });
    expect(primary.calls).toHaveLength(0);
    expect(fallback.calls).toHaveLength(0);
  });

  it("beforeSend mutation of ctx.message reaches the adapter", async () => {
    const adapter = createTestAdapter();
    const pb = createPostbote({
      adapter,
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
    expect(adapter.inbox.last().subject).toBe("mutated");
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
      pb.send({
        from: "f@t.com",
        to: "t@t.com",
        subject: "s",
        html: "<p>hi</p>",
      }),
    ).rejects.toMatchObject({ code: "PROVIDER_UNAVAILABLE" });
    expect(onErrorSpy).toHaveBeenCalled();
  });

  it("all hooks are optional", async () => {
    const adapter = createTestAdapter();
    const pb = createPostbote({
      adapter,
      plugins: [hooks({})],
    });
    const result = await pb.send({
      from: "f@t.com",
      to: "t@t.com",
      subject: "s",
      html: "<p>hi</p>",
    });
    expect(result.messageId).toBeTruthy();

    adapter.failAlways("PROVIDER_UNAVAILABLE");
    await expect(
      pb.send({
        from: "f@t.com",
        to: "t@t.com",
        subject: "s",
        html: "<p>hi</p>",
      }),
    ).rejects.toMatchObject({ code: "PROVIDER_UNAVAILABLE" });
  });

  it("normalizes raw errors from next", async () => {
    const adapter = createTestAdapter();
    const ctx: SendContext = {
      adapter,
      attempts: [],
      message: {
        from: { email: "f@t.com" },
        to: [{ email: "t@t.com" }],
        subject: "s",
        html: "<p>hi</p>",
      },
    };

    await expect(
      hooks({})(ctx, async () => {
        throw new Error("raw error");
      }),
    ).rejects.toMatchObject({ code: "UNKNOWN", provider: "plugin-hooks" });
  });
});
