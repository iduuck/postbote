import { describe, it, expect, afterEach } from "vitest";
import { Result } from "better-result";
import { PostboteError, createPostbote } from "@postbote/core";
import { createTestAdapter, type TestAdapter } from "@postbote/testing";
import { betterResult } from "./index.js";

const adapter: TestAdapter = createTestAdapter({ name: "test" });

describe("betterResult plugin", () => {
  afterEach(() => {
    adapter.reset();
  });

  it("returns Ok with SendResult on success", async () => {
    const pb = createPostbote({ adapter, plugins: [betterResult()] });
    const result = await pb.send({
      from: "f@t.com",
      to: "t@t.com",
      subject: "S",
      html: "<p>hi</p>",
    });
    expect(Result.isOk(result)).toBe(true);
    if (Result.isOk(result)) {
      expect(result.value).toHaveProperty("messageId");
      expect(result.value.provider).toBe("test");
    }
  });

  it("returns Err with PostboteError on adapter failure", async () => {
    adapter.failAlways("PROVIDER_UNAVAILABLE");
    const pb = createPostbote({ adapter, plugins: [betterResult()] });
    const result = await pb.send({
      from: "f@t.com",
      to: "t@t.com",
      subject: "S",
      html: "<p>hi</p>",
    });
    expect(Result.isError(result)).toBe(true);
    if (Result.isError(result)) {
      expect(result.error).toBeInstanceOf(PostboteError);
      expect(result.error.code).toBe("PROVIDER_UNAVAILABLE");
      expect(result.error.retryable).toBe(true);
    }
  });

  it("returns Err on validation error instead of throwing", async () => {
    const pb = createPostbote({ adapter, plugins: [betterResult()] });
    const result = await pb.send({} as Parameters<typeof pb.send>[0]);
    expect(Result.isError(result)).toBe(true);
    if (Result.isError(result)) {
      expect(result.error).toBeInstanceOf(PostboteError);
    }
  });

  it("returns Err on abort signal", async () => {
    const pb = createPostbote({ adapter, plugins: [betterResult()] });
    const ac = new AbortController();
    ac.abort();
    const result = await pb.send(
      { from: "f@t.com", to: "t@t.com", subject: "S", html: "<p>hi</p>" },
      { signal: ac.signal },
    );
    expect(Result.isError(result)).toBe(true);
    if (Result.isError(result)) {
      expect(result.error.code).toBe("ABORTED");
    }
  });

  it("result.match works with both branches", async () => {
    adapter.failAlways("RATE_LIMITED");
    const pb = createPostbote({ adapter, plugins: [betterResult()] });
    const result = await pb.send({
      from: "f@t.com",
      to: "t@t.com",
      subject: "S",
      html: "<p>hi</p>",
    });
    const msg = result.match({
      ok: (r) => `sent: ${r.messageId}`,
      err: (e) => `error: ${e.code}`,
    });
    expect(msg).toBe("error: RATE_LIMITED");
  });
});
