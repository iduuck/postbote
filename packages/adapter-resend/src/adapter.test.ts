import { describe, expect, it, vi } from "vitest";
import { resend } from "./adapter.js";

describe("resend()", () => {
  it("uses the provided client instance", async () => {
    const send = vi.fn().mockResolvedValue({
      data: { id: "client-test-id" },
      error: null,
    });

    const adapter = resend({
      apiKey: "re_dummy",
      client: { emails: { send } },
    });

    const result = await adapter.send({
      from: { email: "f@t.com" },
      to: [{ email: "t@t.com" }],
      subject: "Client Test",
      text: "body",
    });

    expect(result.messageId).toBe("client-test-id");
    expect(result.provider).toBe("resend");
    expect(send).toHaveBeenCalledOnce();
  });

  it("throws PROVIDER_UNAVAILABLE when client throws (network error)", async () => {
    const send = vi.fn().mockRejectedValue(new Error("ECONNREFUSED"));

    const adapter = resend({
      apiKey: "re_dummy",
      client: { emails: { send } },
    });

    await expect(
      adapter.send({
        from: { email: "f@t.com" },
        to: [{ email: "t@t.com" }],
        subject: "Fail",
        text: "body",
      }),
    ).rejects.toMatchObject({
      code: "PROVIDER_UNAVAILABLE",
      provider: "resend",
      retryable: true,
    });
  });

  it("throws UNKNOWN when response has no id", async () => {
    const send = vi.fn().mockResolvedValue({ data: {}, error: null });

    const adapter = resend({
      apiKey: "re_dummy",
      client: { emails: { send } },
    });

    const promise = adapter.send({
      from: { email: "f@t.com" },
      to: [{ email: "t@t.com" }],
      subject: "No ID",
      text: "body",
    });

    await expect(promise).rejects.toMatchObject({
      code: "UNKNOWN",
      provider: "resend",
    });
  });
});
