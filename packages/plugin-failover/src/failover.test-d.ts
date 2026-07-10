import { createPostbote, type SendResult } from "@postbote/core";
import { createTestAdapter } from "@postbote/testing";
import { describe, expectTypeOf, it } from "vitest";
import { failover } from "./index.js";

const message = {
  from: "sender@example.com",
  to: "recipient@example.com",
  subject: "Hello",
};

describe("failover provider types", () => {
  it("preserves the primary adapter provider", () => {
    const postbote = createPostbote({
      adapter: createTestAdapter({ name: "resend" }),
    });

    expectTypeOf<ReturnType<typeof postbote.send>>().toEqualTypeOf<
      Promise<SendResult<"resend">>
    >();
  });

  it("unions the primary and fallback provider names", () => {
    const postbote = createPostbote({
      adapter: createTestAdapter({ name: "resend" }),
      plugins: [
        failover({
          fallbacks: [createTestAdapter({ name: "postmark" })],
        }),
      ],
    });

    expectTypeOf<Awaited<ReturnType<typeof postbote.send>>>().toEqualTypeOf<
      SendResult<"resend" | "postmark">
    >();
    expectTypeOf(postbote.send(message)).toEqualTypeOf<
      Promise<SendResult<"resend" | "postmark">>
    >();
  });
});
