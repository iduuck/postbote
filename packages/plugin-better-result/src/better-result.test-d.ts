import {
  createPostbote,
  defineAdapter,
  type PostboteError,
  type SendResult,
} from "@postbote/core";
import { reactEmail } from "@postbote/plugin-react-email";
import { Result } from "better-result";
import React from "react";
import { describe, expectTypeOf, it } from "vitest";
import { betterResult } from "./index.js";

const adapter = defineAdapter({
  name: "t",
  send: () => Promise.resolve({ messageId: "1" }),
});

describe("betterResult types", () => {
  it("send returns Promise<Result<SendResult, PostboteError>>", async () => {
    const pb = createPostbote({ adapter, plugins: [betterResult()] });
    expectTypeOf<ReturnType<typeof pb.send>>().toEqualTypeOf<
      Promise<Result<SendResult, PostboteError>>
    >();

    type Value = Awaited<ReturnType<typeof pb.send>>;
    expectTypeOf<Value>().toMatchTypeOf<Result<SendResult, PostboteError>>();
  });

  it("without plugin, send returns Promise<SendResult>", async () => {
    const pb = createPostbote({ adapter });
    expectTypeOf<ReturnType<typeof pb.send>>().toEqualTypeOf<
      Promise<SendResult>
    >();
  });

  it("narrows Result values and errors", () => {
    const result = null as unknown as Result<SendResult, PostboteError>;

    // @ts-expect-error value is only available after Result.isOk() narrowing
    result.value;

    if (Result.isOk(result)) {
      expectTypeOf(result.value).toEqualTypeOf<SendResult>();
    } else {
      expectTypeOf(result.error).toEqualTypeOf<PostboteError>();
    }
  });

  it("combines React Email and better-result in both tuple orders", () => {
    const first = createPostbote({
      adapter,
      plugins: [reactEmail(), betterResult()],
    });
    const second = createPostbote({
      adapter,
      plugins: [betterResult(), reactEmail()],
    });
    const message = {
      from: "f@t.com",
      to: "t@t.com",
      subject: "s",
      body: React.createElement("h1"),
    };

    expectTypeOf<ReturnType<typeof first.send>>().toEqualTypeOf<
      Promise<Result<SendResult, PostboteError>>
    >();
    expectTypeOf<ReturnType<typeof second.send>>().toEqualTypeOf<
      Promise<Result<SendResult, PostboteError>>
    >();
    first.send(message);
    second.send(message);
  });
});
