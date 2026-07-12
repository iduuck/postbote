import { createPostbote, type Middleware } from "@postbote/core";
import { createTestAdapter } from "@postbote/testing";
import { describe, expect, it, vi } from "vitest";
import { dryRun } from "./index.js";

const message = {
  from: "from@example.com",
  to: "to@example.com",
  subject: "Test",
  text: "Hello",
};
describe("dryRun", () => {
  it("short-circuits the adapter and records attempts", async () => {
    const adapter = createTestAdapter();
    let attempts = 0;
    const capture: Middleware = async (ctx, next) => {
      const result = await next();
      attempts = ctx.attempts.length;
      return result;
    };
    const pb = createPostbote({
      adapter,
      plugins: [capture, dryRun()] as const,
    });
    await expect(pb.send(message)).resolves.toMatchObject({
      messageId: "dry-run-1",
      provider: "dry-run",
      raw: { dryRun: true },
    });
    expect(adapter.inbox.count()).toBe(0);
    expect(attempts).toBe(1);
  });
  it("is transparent when disabled", async () => {
    const adapter = createTestAdapter();
    const pb = createPostbote({
      adapter,
      plugins: [dryRun({ enabled: false })],
    });
    await pb.send(message);
    expect(adapter.inbox.count()).toBe(1);
  });
  it("passes normalized messages to an observer and ignores observer errors", async () => {
    const onSend = vi.fn(() => {
      throw new Error("observer");
    });
    const pb = createPostbote({
      adapter: createTestAdapter(),
      plugins: [dryRun({ onSend })],
    });
    await pb.send(message);
    expect(onSend).toHaveBeenCalledWith(
      expect.objectContaining({ to: [{ email: "to@example.com" }] }),
    );
  });
});
