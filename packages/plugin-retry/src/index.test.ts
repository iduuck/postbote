import { createPostbote, PostboteError } from "@postbote/core";
import { createTestAdapter } from "@postbote/testing";
import { describe, expect, it, vi } from "vitest";
import { retry } from "./index.js";

const input = {
  from: "from@example.com",
  to: "to@example.com",
  subject: "Subject",
  text: "Text",
};

describe("retry", () => {
  it("retries retryable failures and returns the eventual result", async () => {
    const adapter = createTestAdapter();
    adapter.failNext("PROVIDER_UNAVAILABLE", { times: 2 });
    const postbote = createPostbote({
      adapter,
      plugins: [retry({ backoff: { initialMs: 0, jitter: false } })],
    });
    await expect(postbote.send(input)).resolves.toMatchObject({
      provider: "test",
    });
    expect(adapter.calls).toHaveLength(3);
  });

  it("does not retry permanent failures", async () => {
    const adapter = createTestAdapter();
    adapter.failAlways("AUTH");
    const postbote = createPostbote({ adapter, plugins: [retry()] });
    await expect(postbote.send(input)).rejects.toMatchObject({ code: "AUTH" });
    expect(adapter.calls).toHaveLength(1);
  });

  it("preserves the final original error", async () => {
    const adapter = createTestAdapter();
    const error = new PostboteError("down", {
      code: "TIMEOUT",
      provider: "test",
    });
    adapter.failAlways(error);
    const postbote = createPostbote({
      adapter,
      plugins: [retry({ maxAttempts: 2, backoff: { initialMs: 0 } })],
    });
    await expect(postbote.send(input)).rejects.toBe(error);
    expect(adapter.calls).toHaveLength(2);
  });

  it("uses retry-after and safely observes retries", async () => {
    const adapter = createTestAdapter();
    adapter.failNext(
      new PostboteError("slow", {
        code: "RATE_LIMITED",
        provider: "test",
        retryAfterMs: 1,
      }),
    );
    const onRetry = vi.fn(() => {
      throw new Error("observer");
    });
    const postbote = createPostbote({
      adapter,
      plugins: [retry({ onRetry, backoff: { initialMs: 0, jitter: false } })],
    });
    await expect(postbote.send(input)).resolves.toBeDefined();
    expect(onRetry).toHaveBeenCalledWith(
      expect.objectContaining({ attempt: 1, delayMs: 1 }),
    );
  });

  it("stops waiting immediately when aborted", async () => {
    const adapter = createTestAdapter();
    adapter.failAlways("TIMEOUT");
    const postbote = createPostbote({
      adapter,
      plugins: [retry({ backoff: { initialMs: 1_000, jitter: false } })],
    });
    const controller = new AbortController();
    const promise = postbote.send(input, { signal: controller.signal });
    await Promise.resolve();
    controller.abort();
    await expect(promise).rejects.toMatchObject({ code: "ABORTED" });
    expect(adapter.calls).toHaveLength(1);
  });
});
