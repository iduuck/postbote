import { createPostbote, PostboteError } from "@postbote/core";
import { failover } from "@postbote/plugin-failover";
import { createTestAdapter } from "@postbote/testing";
import { describe, expect, it, vi } from "vitest";
import { logger } from "./index.js";

describe("logger", () => {
  it("emits send:start and send:success on success", async () => {
    const events: unknown[] = [];
    const pb = createPostbote({
      adapter: createTestAdapter({ name: "test" }),
      plugins: [
        logger({
          onEvent: (e) => events.push(e),
        }),
      ],
    });
    await pb.send({
      from: "f@t.com",
      to: "t@t.com",
      subject: "s",
      html: "<p>hi</p>",
    });
    expect(events.length).toBe(2);
    expect(events[0]).toMatchObject({ type: "send:start", provider: "test" });
    expect(events[1]).toMatchObject({ type: "send:success", provider: "test" });
  });

  it("emits send:error and attempt:error on failure", async () => {
    const events: unknown[] = [];
    const badAdapter = createTestAdapter({ name: "bad" });
    badAdapter.failAlways("PROVIDER_UNAVAILABLE");
    const pb = createPostbote({
      adapter: badAdapter,
      plugins: [
        logger({
          onEvent: (e) => events.push(e),
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
    ).rejects.toThrow();
    expect(events.length).toBe(3);
    expect(events[0]).toMatchObject({ type: "send:start" });
    expect(events[1]).toMatchObject({
      type: "send:error",
      error: { code: "PROVIDER_UNAVAILABLE" },
    });
    expect(events[2]).toMatchObject({ type: "attempt:error", adapter: "bad" });
  });

  it("emits attempt:error when failover occurs", async () => {
    const events: unknown[] = [];
    const badAdapter = createTestAdapter({ name: "primary" });
    const fallbackAdapter = createTestAdapter({ name: "fallback" });
    badAdapter.failNext("PROVIDER_UNAVAILABLE");

    const pb = createPostbote({
      adapter: badAdapter,
      plugins: [
        logger({
          onEvent: (e) => events.push(e),
        }),
        failover({ fallbacks: [fallbackAdapter] }),
      ],
    });
    const result = await pb.send({
      from: "f@t.com",
      to: "t@t.com",
      subject: "s",
      html: "<p>hi</p>",
    });
    expect(result.messageId).toBeTruthy();
    const attemptErrors = events.filter((e: any) => e.type === "attempt:error");
    expect(attemptErrors).toHaveLength(1);
    expect(attemptErrors[0]).toMatchObject({ adapter: "primary" });
  });

  it("respects capture option with full", async () => {
    const events: unknown[] = [];
    const pb = createPostbote({
      adapter: createTestAdapter({ name: "test" }),
      plugins: [
        logger({
          onEvent: (e) => events.push(e),
          capture: "full",
        }),
      ],
    });
    await pb.send({
      from: "f@t.com",
      to: "t@t.com",
      subject: "s",
      html: "<p>hi</p>",
    });
    const startEvent = events[0] as any;
    expect(startEvent.to).toEqual(["t@t.com"]);
  });

  it("swallows onEvent errors", async () => {
    const pb = createPostbote({
      adapter: createTestAdapter({ name: "test" }),
      plugins: [
        logger({
          onEvent: () => {
            throw new Error("logging crash");
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
  });
});
