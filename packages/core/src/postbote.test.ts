import { describe, expect, it, vi } from "vitest";
import { PostboteError } from "./errors.js";
import { createPostbote } from "./postbote.js";
import type { Adapter, EmailMessage, SendResult } from "./types.js";

function fakeAdapter(name = "test"): Adapter {
  const send = vi.fn(async (msg: EmailMessage): Promise<SendResult> => {
    return { messageId: `${name}-${msg.to[0]!.email}`, provider: name };
  });
  return { name, send };
}

describe("createPostbote", () => {
  it("returns a Postbote with send and adapter", () => {
    const adapter = fakeAdapter();
    const pb = createPostbote({ adapter });
    expect(pb).toHaveProperty("send");
    expect(pb.adapter).toBe(adapter);
  });

  it("send() returns SendResult with provider name", async () => {
    const adapter = fakeAdapter("resend");
    const pb = createPostbote({ adapter });
    const result = await pb.send({
      from: "f@t.com",
      to: "t@t.com",
      subject: "Hello",
      text: "World",
    });
    expect(result).toHaveProperty("messageId");
    expect(result.provider).toBe("resend");
  });

  it("normalizes input before passing to adapter", async () => {
    const adapter = fakeAdapter();
    const pb = createPostbote({ adapter });
    await pb.send({
      from: "Sender <s@t.com>",
      to: ["r@t.com"],
      subject: "Test",
      text: "Body",
    });
    const received = (adapter.send as ReturnType<typeof vi.fn>).mock
      .calls[0]![0] as EmailMessage;
    expect(received.from).toEqual({ email: "s@t.com", name: "Sender" });
    expect(received.to).toEqual([{ email: "r@t.com" }]);
  });

  it("rejects invalid input before calling adapter", async () => {
    const adapter = fakeAdapter();
    const pb = createPostbote({ adapter });
    await expect(pb.send({} as any)).rejects.toThrow(PostboteError);
    expect(adapter.send).not.toHaveBeenCalled();
  });

  it("provides fresh state for each send() call", async () => {
    const adapter = fakeAdapter();
    const pb = createPostbote({ adapter });
    await pb.send({
      from: "f@t.com",
      to: "a@t.com",
      subject: "S1",
      text: "B1",
    });
    await pb.send({
      from: "f@t.com",
      to: "b@t.com",
      subject: "S2",
      text: "B2",
    });
    const calls = (adapter.send as ReturnType<typeof vi.fn>).mock.calls;
    expect(calls).toHaveLength(2);
  });

  it("executes plugins from config", async () => {
    const adapter = fakeAdapter();
    const plugin = vi.fn(async (ctx: any, next: any) => {
      return next();
    });
    const pb = createPostbote({ adapter, plugins: [plugin] });
    await pb.send({ from: "f@t.com", to: "t@t.com", subject: "S", text: "B" });
    expect(plugin).toHaveBeenCalledOnce();
  });
});
