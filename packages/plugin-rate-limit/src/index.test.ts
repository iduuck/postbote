import { createPostbote } from "@postbote/core";
import { createTestAdapter } from "@postbote/testing";
import { describe, expect, it, vi } from "vitest";
import { rateLimit } from "./index.js";

const message = {
  from: "from@example.com",
  to: "to@example.com",
  subject: "Test",
  text: "Hello",
};
describe("rateLimit", () => {
  it("allows its burst immediately", async () => {
    const adapter = createTestAdapter();
    const pb = createPostbote({
      adapter,
      plugins: [rateLimit({ tokens: 2, intervalMs: 1_000 })],
    });
    await Promise.all([pb.send(message), pb.send(message)]);
    expect(adapter.inbox.count()).toBe(2);
  });
  it("rejects when configured to reject", async () => {
    const pb = createPostbote({
      adapter: createTestAdapter(),
      plugins: [rateLimit({ tokens: 1, intervalMs: 1_000, mode: "reject" })],
    });
    await pb.send(message);
    await expect(pb.send(message)).rejects.toMatchObject({
      code: "RATE_LIMITED",
      provider: "plugin-rate-limit",
    });
  });
  it("waits for a refill", async () => {
    vi.useFakeTimers();
    const adapter = createTestAdapter();
    const pb = createPostbote({
      adapter,
      plugins: [rateLimit({ tokens: 1, intervalMs: 1_000 })],
    });
    await pb.send(message);
    const second = pb.send(message);
    await vi.advanceTimersByTimeAsync(1_000);
    await second;
    expect(adapter.inbox.count()).toBe(2);
    vi.useRealTimers();
  });
  it("aborts while waiting", async () => {
    const pb = createPostbote({
      adapter: createTestAdapter(),
      plugins: [rateLimit({ tokens: 1, intervalMs: 60_000 })],
    });
    await pb.send(message);
    const controller = new AbortController();
    const pending = pb.send(message, { signal: controller.signal });
    controller.abort();
    await expect(pending).rejects.toMatchObject({ code: "ABORTED" });
  });
});
