import { describe, expect, it, vi } from "vitest";
import { smtp } from "./adapter.js";

const message = {
  from: { email: "sender@example.com" },
  to: [{ email: "recipient@example.com" }],
  subject: "Hello",
  text: "Hello from Postbote",
};

function transport(
  result: Partial<{
    messageId: string;
    accepted: string[];
    rejected: string[];
    response: string;
  }> = {},
) {
  return {
    sendMail: vi.fn().mockResolvedValue({
      messageId: "message-id",
      accepted: ["recipient@example.com"],
      rejected: [],
      response: "250 queued",
      ...result,
    }),
  };
}

describe("smtp()", () => {
  it("uses the injected transport", async () => {
    const injected = transport({ messageId: "injected-id" });
    const adapter = smtp({ transport: injected });

    const result = await adapter.send(message);

    expect(result).toMatchObject({
      messageId: "injected-id",
      provider: "smtp",
    });
    expect(injected.sendMail).toHaveBeenCalledOnce();
  });

  it("returns RECIPIENT_REJECTED for partial SMTP acceptance", async () => {
    const adapter = smtp({
      transport: transport({ rejected: ["rejected@example.com"] }),
    });

    await expect(adapter.send(message)).rejects.toMatchObject({
      code: "RECIPIENT_REJECTED",
      cause: { rejected: ["rejected@example.com"] },
    });
  });

  it("closes transports that expose close", async () => {
    const close = vi.fn();
    const injected = Object.assign(transport(), { close });
    const adapter = smtp({ transport: injected });

    await adapter.close();

    expect(close).toHaveBeenCalledOnce();
  });

  it("supports URL configuration", () => {
    expect(() =>
      smtp({ url: "smtp://user:pass@localhost:2525" }),
    ).not.toThrow();
  });

  it("supports field configuration", () => {
    expect(() =>
      smtp({
        host: "localhost",
        port: 2525,
        secure: false,
        auth: { user: "user", pass: "pass" },
      }),
    ).not.toThrow();
  });

  it("maps unavailable SMTP sockets", async () => {
    const adapter = smtp({
      host: "127.0.0.1",
      port: 1,
      auth: { user: "test", pass: "smtp-test-secret" },
      timeoutMs: 50,
    });

    await expect(adapter.send(message)).rejects.toMatchObject({
      code: "PROVIDER_UNAVAILABLE",
      provider: "smtp",
    });
  });
});
