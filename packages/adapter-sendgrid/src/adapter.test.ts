import { describe, expect, it, vi } from "vitest";
import { sendgrid } from "./adapter.js";

function mockClient(
  overrides?: Partial<{
    statusCode: number;
    headers: Record<string, string>;
    body: string;
  }>,
) {
  const {
    statusCode = 202,
    headers = { "x-message-id": "test-id" },
    body = "",
  } = overrides ?? {};
  const send = vi.fn().mockResolvedValue([{ statusCode, headers, body }, {}]);
  return { send };
}

describe("sendgrid()", () => {
  it("uses the provided client instance", async () => {
    const client = mockClient();
    const adapter = sendgrid({ apiKey: "SG.dummy", client });

    const result = await adapter.send({
      from: { email: "f@t.com" },
      to: [{ email: "t@t.com" }],
      subject: "Client Test",
      text: "body",
    });

    expect(result.messageId).toBe("test-id");
    expect(result.provider).toBe("sendgrid");
    expect(client.send).toHaveBeenCalledOnce();
  });

  it("throws PROVIDER_UNAVAILABLE when client throws (network error)", async () => {
    const client = {
      send: vi.fn().mockRejectedValue(new Error("ECONNREFUSED")),
    };
    const adapter = sendgrid({ apiKey: "SG.dummy", client });

    await expect(
      adapter.send({
        from: { email: "f@t.com" },
        to: [{ email: "t@t.com" }],
        subject: "Fail",
        text: "body",
      }),
    ).rejects.toMatchObject({
      code: "PROVIDER_UNAVAILABLE",
      provider: "sendgrid",
      retryable: true,
    });
  });

  it("throws UNKNOWN when response has no message ID", async () => {
    const client = mockClient({ headers: {} });
    const adapter = sendgrid({ apiKey: "SG.dummy", client });

    const promise = adapter.send({
      from: { email: "f@t.com" },
      to: [{ email: "t@t.com" }],
      subject: "No ID",
      text: "body",
    });

    await expect(promise).rejects.toMatchObject({
      code: "UNKNOWN",
      provider: "sendgrid",
    });
  });

  it("throws AUTH on 401 from SDK", async () => {
    const err = Object.assign(new Error("Unauthorized"), { code: 401 });
    const client = { send: vi.fn().mockRejectedValue(err) };
    const adapter = sendgrid({ apiKey: "SG.dummy", client });

    await expect(
      adapter.send({
        from: { email: "f@t.com" },
        to: [{ email: "t@t.com" }],
        subject: "Auth fail",
        text: "body",
      }),
    ).rejects.toMatchObject({
      code: "AUTH",
      provider: "sendgrid",
    });
  });

  it("respects already-aborted AbortSignal", async () => {
    const client = mockClient();
    const adapter = sendgrid({ apiKey: "SG.dummy", client });
    const ac = new AbortController();
    ac.abort(new DOMException("Aborted", "AbortError"));

    await expect(
      adapter.send(
        {
          from: { email: "f@t.com" },
          to: [{ email: "t@t.com" }],
          subject: "Abort",
          text: "body",
        },
        { signal: ac.signal },
      ),
    ).rejects.toMatchObject({
      code: "ABORTED",
      provider: "sendgrid",
    });
  });
});
