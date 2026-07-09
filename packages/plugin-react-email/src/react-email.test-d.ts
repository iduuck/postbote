import { describe, it, assertType, expectTypeOf } from "vitest";
import { createPostbote } from "@postbote/core";
import { createTestAdapter } from "@postbote/testing";
import { reactEmail, type ReactEmailExt } from "./index.js";
import React from "react";
import type { ReactElement } from "react";

const adapter = createTestAdapter({ name: "test" });

type SendInput<P> = Parameters<P extends { send: (...args: infer A) => unknown } ? (...args: A) => unknown : never>[0];

function bodyStr<T>(_x: T): void {}

describe("reactEmail types", () => {
  it("plugins: [reactEmail()] enables body: ReactElement", () => {
    const pb = createPostbote({ adapter, plugins: [reactEmail()] });
    type Input = Parameters<typeof pb.send>[0];
    type Base = { from: string; to: string; subject: string; html: string };
    // Input extends Base + body: ReactElement | undefined
    assertType<Input>(null as unknown as Base & { body: ReactElement });
  });

  it("body: string is not allowed", () => {
    const pb = createPostbote({ adapter, plugins: [reactEmail()] });
    // @ts-expect-error body must be ReactElement, not string
    pb.send({ from: "f", to: "t", subject: "s", html: "<p>hi</p>", body: "<h1>hi</h1>" });
  });

  it("body with html is allowed simultaneously", () => {
    const pb = createPostbote({ adapter, plugins: [reactEmail()] });
    const msg = { from: "f@t.com" as const, to: "t@t.com" as const, subject: "s", html: "<p>fallback</p>", body: React.createElement("h1") as ReactElement };
    assertType(pb.send(msg));
  });

  it("without plugin, body is not allowed", () => {
    const pb = createPostbote({ adapter });
    // @ts-expect-error body does not exist without reactEmail plugin
    pb.send({ from: "f", to: "t", subject: "s", html: "<p>hi</p>", body: React.createElement("h1") });
  });

  it("ReactEmailExt describes body as ReactElement", () => {
    assertType<ReactElement | undefined>(null as unknown as ReactEmailExt["body"]);
  });
});
