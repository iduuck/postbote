import {
  createPostbote,
  defineAdapter,
  type EmailMessageInput,
  type Middleware,
  type PluginInputExt,
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

function extPlugin<TExt extends Record<string, unknown>>(): PluginObject<TExt> {
  return { name: "ext" } as PluginObject<TExt>;
}

interface InterfaceExtension {
  template?: string;
}

type SendInput<P> = Parameters<
  P extends { send: (...args: infer A) => unknown }
    ? (...args: A) => unknown
    : never
>[0];

const noopMiddleware: Middleware = (_ctx, next) => next();

describe("plugin types", () => {
  it("without plugins send() accepts EmailMessageInput", () => {
    const pb = createPostbote({ adapter });
    assertType<Promise<SendResult>>(pb.send(base));
  });

  it("with PluginObject extension, send input includes ext fields", () => {
    const pb = createPostbote({
      adapter,
      plugins: [extPlugin<{ body?: string }>()],
    });
    type Input = SendInput<typeof pb>;
    expectTypeOf<Input>().toMatchTypeOf<
      EmailMessageInput & { body?: string }
    >();
  });

  it("html and text remain available alongside extension", () => {
    const pb = createPostbote({
      adapter,
      plugins: [extPlugin<{ body?: string }>()],
    });
    type Input = SendInput<typeof pb>;
    expectTypeOf<EmailMessageInput>().toMatchTypeOf<Input>();
  });

  it("pre-typed PluginObject[] array degrades to base input", () => {
    const plugins: PluginObject[] = [extPlugin()];
    const pb = createPostbote({ adapter, plugins });
    type Input = SendInput<typeof pb>;
    expectTypeOf<Input>().toEqualTypeOf<EmailMessageInput>();
  });

  it("two ext plugins merge via intersection", () => {
    const p1 = extPlugin<{ a: number }>();
    const p2 = extPlugin<{ b: string }>();
    const pb = createPostbote({ adapter, plugins: [p1, p2] });
    const msg: EmailMessageInput & { a: number; b: string } = {
      ...base,
      a: 1,
      b: "x",
    };
    assertType(pb.send(msg));
  });

  it("PluginInputExt resolves correctly", () => {
    type Res = PluginInputExt<[PluginObject<{ body?: string }>]>;
    expectTypeOf<Res>().toMatchTypeOf<{ body?: string }>();
  });

  it("preserves extensions declared as interfaces", () => {
    type Res = PluginInputExt<[PluginObject<InterfaceExtension>]>;
    expectTypeOf<Res>().toEqualTypeOf<InterfaceExtension>();
  });

  it("bare Middleware in tuple does not change send return type", () => {
    const pb = createPostbote({ adapter, plugins: [noopMiddleware] });
    assertType<Promise<SendResult>>(pb.send(base));
  });

  it("mixed tuple of Middleware and PluginObject does not change send return type", () => {
    const pb = createPostbote({
      adapter,
      plugins: [noopMiddleware, extPlugin<{ body?: string }>()],
    });
    type Input = SendInput<typeof pb>;
    expectTypeOf<Input>().toMatchTypeOf<
      EmailMessageInput & { body?: string }
    >();
    assertType<Promise<SendResult>>(pb.send(base));
  });

  it("Middleware[] array degrades to base send return", () => {
    const plugins: Middleware[] = [noopMiddleware];
    const pb = createPostbote({ adapter, plugins });
    assertType<Promise<SendResult>>(pb.send(base));
  });
});
