import { createPostbote } from "@postbote/core";
import { createTestAdapter } from "@postbote/testing";
import { describe, expect, it } from "vitest";
import { redirect } from "./index.js";

const message = {
  from: "from@example.com",
  to: "to@example.com",
  cc: "cc@example.com",
  bcc: "bcc@example.com",
  subject: "Test",
  text: "Hello",
};
describe("redirect", () => {
  it("replaces recipients, removes cc and bcc, and preserves originals", async () => {
    const adapter = createTestAdapter();
    const pb = createPostbote({
      adapter,
      plugins: [
        redirect({ to: "staging@example.com", subjectPrefix: "[staging] " }),
      ],
    });
    await pb.send(message);
    expect(adapter.inbox.last()).toMatchObject({
      to: [{ email: "staging@example.com" }],
      cc: undefined,
      bcc: undefined,
      subject: "[staging] Test",
      headers: {
        "X-Original-To": "to@example.com",
        "X-Original-Cc": "cc@example.com",
        "X-Original-Bcc": "bcc@example.com",
      },
    });
  });
  it("does not preserve headers when disabled or mutate input", async () => {
    const adapter = createTestAdapter();
    const pb = createPostbote({
      adapter,
      plugins: [
        redirect({ to: "staging@example.com", preserveHeaders: false }),
      ],
    });
    await pb.send(message);
    expect(adapter.inbox.last()?.headers).toBeUndefined();
    expect(message.to).toBe("to@example.com");
  });
  it("validates redirect targets eagerly", () => {
    expect(() => redirect({ to: "invalid" })).toThrow();
  });
});
