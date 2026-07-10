import { createPostbote } from "@postbote/core";
import { failover } from "@postbote/plugin-failover";
import { createTestAdapter } from "@postbote/testing";
import type { ReactElement } from "react";
import React from "react";
import { assertType, describe, expectTypeOf, it } from "vitest";
import { type ReactEmailExt, reactEmail } from "./index.js";

const adapter = createTestAdapter({ name: "test" });

type Property<T, K extends PropertyKey> = K extends keyof T ? T[K] : never;

describe("reactEmail types", () => {
  it("plugins: [reactEmail()] enables body: ReactElement", () => {
    const pb = createPostbote({ adapter, plugins: [reactEmail()] });
    type Input = Parameters<typeof pb.send>[0];
    type Body = Property<Input, "body">;
    expectTypeOf<string>().not.toExtend<Body>();
  });

  it("body: string is not allowed", () => {
    const pb = createPostbote({ adapter, plugins: [reactEmail()] });
    type Input = Parameters<typeof pb.send>[0];
    type Body = Property<Input, "body">;
    expectTypeOf<Body>().toEqualTypeOf<ReactElement | undefined>();
    pb.send({
      from: "f@t.com",
      to: "t@t.com",
      subject: "s",
      // @ts-expect-error body must be a ReactElement, not a string
      body: "<h1>hi</h1>",
    });
  });

  it("body with html is allowed simultaneously", () => {
    const pb = createPostbote({ adapter, plugins: [reactEmail()] });
    const msg = {
      from: "f@t.com" as const,
      to: "t@t.com" as const,
      subject: "s",
      html: "<p>fallback</p>",
      body: React.createElement("h1") as ReactElement,
    };
    assertType(pb.send(msg));
  });

  it("without plugin, body is not allowed", () => {
    const pb = createPostbote({ adapter });
    expectTypeOf(pb.send).parameter(0).not.toHaveProperty("body");
    pb.send({
      from: "f@t.com",
      to: "t@t.com",
      subject: "s",
      html: "<p>hi</p>",
      // @ts-expect-error body requires reactEmail()
      body: React.createElement("h1"),
    });
  });

  it("preserves body when combined with failover", () => {
    const fallback = createTestAdapter({ name: "fallback" });
    const pb = createPostbote({
      adapter,
      plugins: [reactEmail(), failover({ fallbacks: [fallback] })],
    });

    assertType(
      pb.send({
        from: "f@t.com",
        to: "t@t.com",
        subject: "s",
        body: React.createElement("h1"),
      }),
    );
  });

  it("ReactEmailExt describes body as ReactElement", () => {
    assertType<ReactElement | undefined>(
      null as unknown as ReactEmailExt["body"],
    );
  });
});
