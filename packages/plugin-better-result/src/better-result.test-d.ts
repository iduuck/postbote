import { describe, it, expectTypeOf } from "vitest";
import type { SendResult, PostboteError } from "@postbote/core";
import type { Result } from "better-result";

describe("betterResult types", () => {
  it("send returns Promise<Result<SendResult, PostboteError>>", async () => {
    const { createPostbote, defineAdapter } = await import("@postbote/core");
    const { betterResult } = await import("./index.js");
    const adapter = defineAdapter({
      name: "t",
      send: () => Promise.resolve({ messageId: "1" }),
    });
    const pb = createPostbote({ adapter, plugins: [betterResult()] });
    type S = Awaited<ReturnType<typeof pb.send>>;
    expectTypeOf<Result<SendResult, PostboteError>>().toMatchTypeOf<S>();
  });

  it("without plugin, send returns Promise<SendResult>", async () => {
    const { createPostbote, defineAdapter } = await import("@postbote/core");
    const adapter = defineAdapter({
      name: "t",
      send: () => Promise.resolve({ messageId: "1" }),
    });
    const pb = createPostbote({ adapter });
    type S = Awaited<ReturnType<typeof pb.send>>;
    expectTypeOf<SendResult>().toMatchTypeOf<S>();
  });
});
