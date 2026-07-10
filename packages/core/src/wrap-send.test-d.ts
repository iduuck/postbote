import {
  createPostbote,
  defineAdapter,
  type EmailMessageInput,
  type Middleware,
  type PluginObject,
  type SendResult,
} from "@postbote/core";
import { assertType, describe, expectTypeOf, it } from "vitest";

const adapter = defineAdapter({
  name: "test",
  send: () => Promise.resolve({ messageId: "1" }),
});
const base = {
  from: "f@t.com",
  to: "t@t.com",
  subject: "s",
  html: "<p>hi</p>",
};

describe("wrapSend types", () => {
  it("without plugins, send() returns Promise<SendResult>", () => {
    const pb = createPostbote({ adapter });
    assertType<Promise<SendResult>>(pb.send(base));
  });

  it("uses a wrapper's declared return type", () => {
    type Wrapped = Promise<{ wrapped: SendResult }>;
    const wrapper = {
      name: "wrapper",
      wrapSend: async (run: () => Promise<SendResult>) => ({
        wrapped: await run(),
      }),
    } as PluginObject<{}, Wrapped>;
    const pb = createPostbote({ adapter, plugins: [wrapper] });

    expectTypeOf<ReturnType<typeof pb.send>>().toEqualTypeOf<Wrapped>();
  });

  it("Middleware[] degrades to the default return type", () => {
    const middleware: Middleware = (_ctx, next) => next();
    const plugins: Middleware[] = [middleware];
    const pb = createPostbote({ adapter, plugins });

    expectTypeOf<ReturnType<typeof pb.send>>().toEqualTypeOf<
      Promise<SendResult>
    >();
  });

  it("combines input extensions with a wrapper", () => {
    type Wrapped = Promise<{ wrapped: SendResult }>;
    const extension = { name: "extension" } as PluginObject<{
      template: string;
    }>;
    const wrapper = { name: "wrapper" } as PluginObject<{}, Wrapped>;
    const pb = createPostbote({ adapter, plugins: [extension, wrapper] });
    const message: EmailMessageInput & { template: string } = {
      ...base,
      template: "welcome",
    };

    expectTypeOf<ReturnType<typeof pb.send>>().toEqualTypeOf<Wrapped>();
    assertType<Wrapped>(pb.send(message));
  });

  it("does not expose wrapper fields without a wrapper", () => {
    const pb = createPostbote({ adapter });
    const result = null as unknown as Awaited<ReturnType<typeof pb.send>>;

    // @ts-expect-error SendResult has no wrapper-specific field
    result.wrapped;
  });
});
