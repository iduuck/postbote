import { createTestAdapter } from "@postbote/testing";
import type { ReactElement } from "react";
import React from "react";
import { describe, expect, it, vi } from "vitest";
import { reactEmail } from "./index.js";

const adapter = createTestAdapter({ name: "test" });

function Welcome({ name }: { name: string }) {
  return React.createElement("h1", null, `Welcome ${name}!`);
}

function bodyEl(el: ReactElement) {
  return { body: el };
}

describe("reactEmail plugin", () => {
  it("renders component to html and removes body", async () => {
    const { createPostbote } = await import("@postbote/core");
    const a = createTestAdapter({ name: "test" });
    const spy = vi.spyOn(a, "send");
    const pb = createPostbote({
      adapter: a,
      plugins: [reactEmail()],
    });

    const result = await pb.send({
      from: "sender@test.com",
      to: "recipient@test.com",
      subject: "Welcome",
      ...bodyEl(React.createElement(Welcome, { name: "Nick" })),
    });

    expect(result.messageId).toBeTruthy();
    expect(spy.mock.calls[0]?.[0]).not.toHaveProperty("body");
  });

  it("passes through input without body unchanged", async () => {
    const { createPostbote } = await import("@postbote/core");
    const a = createTestAdapter({ name: "test" });
    const spy = vi
      .spyOn(a, "send")
      .mockResolvedValue({ messageId: "1" } as any);

    const pb = createPostbote({ adapter: a, plugins: [reactEmail()] });

    await pb.send({
      from: "s@t.com",
      to: "r@t.com",
      subject: "Hi",
      html: "<p>hello</p>",
    });

    const sent = spy.mock.calls[0]![0];
    expect(sent.html).toBe("<p>hello</p>");
    expect((sent as any).body).toBeUndefined();
  });

  it("generates text when plainText is true and no explicit text", async () => {
    const { createPostbote } = await import("@postbote/core");
    const a = createTestAdapter({ name: "test" });
    const spy = vi
      .spyOn(a, "send")
      .mockResolvedValue({ messageId: "1" } as any);

    const pb = createPostbote({
      adapter: a,
      plugins: [reactEmail({ plainText: true })],
    });

    await pb.send({
      from: "s@t.com",
      to: "r@t.com",
      subject: "Welcome",
      ...bodyEl(React.createElement(Welcome, { name: "Nick" })),
    });

    const sent = spy.mock.calls[0]![0];
    expect(sent.html).toContain("Welcome");
    expect(sent.text).toBeTruthy();
  });

  it("does not override explicit text when plainText is true", async () => {
    const { createPostbote } = await import("@postbote/core");
    const a = createTestAdapter({ name: "test" });
    const spy = vi
      .spyOn(a, "send")
      .mockResolvedValue({ messageId: "1" } as any);

    const pb = createPostbote({
      adapter: a,
      plugins: [reactEmail({ plainText: true })],
    });

    await pb.send({
      from: "s@t.com",
      to: "r@t.com",
      subject: "Welcome",
      text: "Custom text",
      ...bodyEl(React.createElement(Welcome, { name: "Nick" })),
    });

    const sent = spy.mock.calls[0]![0];
    expect(sent.text).toBe("Custom text");
  });

  it("renders body over a supplied html fallback", async () => {
    const { createPostbote } = await import("@postbote/core");
    const a = createTestAdapter({ name: "test" });
    const spy = vi.spyOn(a, "send");
    const pb = createPostbote({ adapter: a, plugins: [reactEmail()] });

    await pb.send({
      from: "s@t.com",
      to: "r@t.com",
      subject: "Welcome",
      html: "<p>fallback</p>",
      ...bodyEl(React.createElement(Welcome, { name: "Nick" })),
    });

    expect(spy.mock.calls[0]?.[0].html).toContain("Welcome Nick!");
  });

  it("does not generate text when plainText is false", async () => {
    const { createPostbote } = await import("@postbote/core");
    const a = createTestAdapter({ name: "test" });
    const spy = vi
      .spyOn(a, "send")
      .mockResolvedValue({ messageId: "1" } as any);

    const pb = createPostbote({
      adapter: a,
      plugins: [reactEmail({ plainText: false })],
    });

    await pb.send({
      from: "s@t.com",
      to: "r@t.com",
      subject: "Welcome",
      ...bodyEl(React.createElement(Welcome, { name: "Nick" })),
    });

    const sent = spy.mock.calls[0]![0];
    expect(sent.html).toContain("Welcome");
    expect(sent.text).toBeUndefined();
  });
});
