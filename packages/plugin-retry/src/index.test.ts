import {
  createPostbote,
  type Middleware,
  PostboteError,
  type SendContext,
} from "@postbote/core";
import { failover } from "@postbote/plugin-failover";
import { createTestAdapter } from "@postbote/testing";
import { afterEach, describe, expect, it, vi } from "vitest";
import { retry } from "./index.js";

const input = {
  from: "from@example.com",
  to: "to@example.com",
  subject: "Subject",
  text: "Text",
};

function retryableError(provider = "test"): PostboteError {
  return new PostboteError("down", {
    code: "PROVIDER_UNAVAILABLE",
    provider,
  });
}

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe("retry", () => {
  it("retries retryable failures and records every attempt", async () => {
    const adapter = createTestAdapter();
    adapter.failNext(retryableError(), { times: 2 });
    let context: SendContext | undefined;
    const capture: Middleware = async (ctx, next) => {
      context = ctx;
      return next();
    };
    const postbote = createPostbote({
      adapter,
      plugins: [capture, retry({ backoff: { initialMs: 0, jitter: false } })],
    });

    await expect(postbote.send(input)).resolves.toMatchObject({
      provider: "test",
    });
    expect(adapter.calls).toHaveLength(3);
    expect(context?.attempts).toHaveLength(3);
  });

  it("does not retry permanent errors", async () => {
    const adapter = createTestAdapter();
    const error = new PostboteError("bad key", {
      code: "AUTH",
      provider: "test",
    });
    adapter.failAlways(error);
    const postbote = createPostbote({ adapter, plugins: [retry()] });

    await expect(postbote.send(input)).rejects.toBe(error);
    expect(adapter.calls).toHaveLength(1);
  });

  it("throws the final original error when attempts are exhausted", async () => {
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

  it("uses capped exponential backoff without jitter", async () => {
    vi.useFakeTimers();
    const adapter = createTestAdapter();
    adapter.failNext(retryableError(), { times: 3 });
    const onRetry = vi.fn();
    const postbote = createPostbote({
      adapter,
      plugins: [
        retry({
          maxAttempts: 4,
          backoff: { initialMs: 200, factor: 2, maxMs: 500, jitter: false },
          onRetry,
        }),
      ],
    });

    const sent = postbote.send(input);
    await vi.runAllTimersAsync();
    await sent;

    expect(onRetry.mock.calls.map(([info]) => info.delayMs)).toEqual([
      200, 400, 500,
    ]);
  });

  it("uses full jitter within the calculated range", async () => {
    vi.useFakeTimers();
    const delays: number[] = [];
    const sends = Array.from({ length: 20 }, () => {
      const adapter = createTestAdapter();
      adapter.failNext(retryableError());
      const postbote = createPostbote({
        adapter,
        plugins: [retry({ onRetry: (info) => delays.push(info.delayMs) })],
      });
      return postbote.send(input);
    });

    await vi.runAllTimersAsync();
    await Promise.all(sends);

    expect(delays).toHaveLength(20);
    expect(delays.every((delay) => delay >= 0 && delay <= 200)).toBe(true);
  });

  it("uses a custom backoff function", async () => {
    const adapter = createTestAdapter();
    const error = retryableError();
    adapter.failNext(error);
    const backoff = vi.fn(() => 0);
    const postbote = createPostbote({ adapter, plugins: [retry({ backoff })] });

    await expect(postbote.send(input)).resolves.toBeDefined();
    expect(backoff).toHaveBeenCalledWith(1, error);
  });

  it("honors retry-after unless disabled", async () => {
    vi.useFakeTimers();
    const error = new PostboteError("slow", {
      code: "RATE_LIMITED",
      provider: "test",
      retryAfterMs: 7_000,
    });
    const adapter = createTestAdapter();
    adapter.failNext(error);
    const onRetry = vi.fn();
    const postbote = createPostbote({
      adapter,
      plugins: [
        retry({
          backoff: { initialMs: 200, jitter: false },
          onRetry,
        }),
      ],
    });

    const sent = postbote.send(input);
    await vi.runAllTimersAsync();
    await sent;
    expect(onRetry).toHaveBeenCalledWith({
      attempt: 1,
      delayMs: 7_000,
      error,
    });

    adapter.failNext(error);
    const withoutRetryAfter = vi.fn();
    const ignored = createPostbote({
      adapter,
      plugins: [
        retry({
          backoff: { initialMs: 200, jitter: false },
          respectRetryAfter: false,
          onRetry: withoutRetryAfter,
        }),
      ],
    });
    const ignoredSend = ignored.send(input);
    await vi.runAllTimersAsync();
    await ignoredSend;
    expect(withoutRetryAfter).toHaveBeenCalledWith({
      attempt: 1,
      delayMs: 200,
      error,
    });
  });

  it("ignores errors thrown by onRetry", async () => {
    const adapter = createTestAdapter();
    adapter.failNext(retryableError());
    const postbote = createPostbote({
      adapter,
      plugins: [
        retry({
          backoff: { initialMs: 0, jitter: false },
          onRetry: () => {
            throw new Error("observer");
          },
        }),
      ],
    });

    await expect(postbote.send(input)).resolves.toBeDefined();
  });

  it("stops waiting immediately when aborted and clears the timer", async () => {
    vi.useFakeTimers();
    const adapter = createTestAdapter();
    adapter.failAlways(retryableError());
    const postbote = createPostbote({
      adapter,
      plugins: [retry({ backoff: { initialMs: 1_000, jitter: false } })],
    });
    const controller = new AbortController();
    const sent = postbote.send(input, { signal: controller.signal });

    await vi.advanceTimersByTimeAsync(0);
    controller.abort();

    await expect(sent).rejects.toMatchObject({ code: "ABORTED" });
    expect(adapter.calls).toHaveLength(1);
    expect(vi.getTimerCount()).toBe(0);
  });

  it("retries each adapter before failover when retry is inner", async () => {
    const primary = createTestAdapter({ name: "primary" });
    const fallback = createTestAdapter({ name: "fallback" });
    primary.failAlways(retryableError("primary"));
    const postbote = createPostbote({
      adapter: primary,
      plugins: [
        failover({ fallbacks: [fallback] }),
        retry({ maxAttempts: 2, backoff: { initialMs: 0, jitter: false } }),
      ],
    });

    await expect(postbote.send(input)).resolves.toMatchObject({
      provider: "fallback",
    });
    expect(primary.calls).toHaveLength(2);
    expect(fallback.calls).toHaveLength(1);
  });

  it("retries the entire failover chain when retry is outer", async () => {
    const primary = createTestAdapter({ name: "primary" });
    const fallback = createTestAdapter({ name: "fallback" });
    primary.failAlways(retryableError("primary"));
    fallback.failNext(retryableError("fallback"));
    const postbote = createPostbote({
      adapter: primary,
      plugins: [
        retry({ maxAttempts: 2, backoff: { initialMs: 0, jitter: false } }),
        failover({ fallbacks: [fallback] }),
      ],
    });

    await expect(postbote.send(input)).resolves.toMatchObject({
      provider: "fallback",
    });
    expect(primary.calls).toHaveLength(2);
    expect(fallback.calls).toHaveLength(2);
  });

  it("keeps parallel send attempt counters independent", async () => {
    const adapter = createTestAdapter();
    adapter.failNext(retryableError(), { times: 2 });
    const postbote = createPostbote({
      adapter,
      plugins: [retry({ backoff: { initialMs: 0, jitter: false } })],
    });

    await expect(
      Promise.all([postbote.send(input), postbote.send(input)]),
    ).resolves.toHaveLength(2);
    expect(adapter.calls).toHaveLength(4);
  });

  it("validates maxAttempts when creating the middleware", () => {
    expect(() => retry({ maxAttempts: 0 })).toThrow(TypeError);
    expect(() => retry({ maxAttempts: 1.5 })).toThrow(
      "maxAttempts must be a positive integer",
    );
  });
});
