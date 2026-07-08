import { describe, expect, it, vi } from "vitest";
import { postmark } from "./adapter.js";

function makeSdkResult(
  overrides?: Partial<{
    MessageID: string;
    To: string;
    SubmittedAt: string;
    ErrorCode: number;
  }>,
) {
  return {
    MessageID: "test-message-id",
    To: "recipient@example.com",
    SubmittedAt: "2024-01-01T00:00:00Z",
    ErrorCode: 0,
    ...overrides,
  };
}

describe("postmark()", () => {
  it("uses the provided client instance", async () => {
    const sendEmail = vi
      .fn()
      .mockResolvedValue(makeSdkResult({ MessageID: "client-test-id" }));

    const adapter = postmark({
      serverToken: "dummy-token",
      client: { sendEmail },
    });

    const result = await adapter.send({
      from: { email: "f@t.com" },
      to: [{ email: "t@t.com" }],
      subject: "Client Test",
      text: "body",
    });

    expect(result.messageId).toBe("client-test-id");
    expect(result.provider).toBe("postmark");
    expect(sendEmail).toHaveBeenCalledOnce();
  });

  it("throws PROVIDER_UNAVAILABLE when client throws (network error)", async () => {
    const sendEmail = vi.fn().mockRejectedValue(new Error("ECONNREFUSED"));

    const adapter = postmark({
      serverToken: "dummy-token",
      client: { sendEmail },
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
      provider: "postmark",
      retryable: true,
    });
  });

  it("throws UNKNOWN when response has no MessageID", async () => {
    const sendEmail = vi
      .fn()
      .mockResolvedValue(makeSdkResult({ MessageID: "" }));

    const adapter = postmark({
      serverToken: "dummy-token",
      client: { sendEmail },
    });

    await expect(
      adapter.send({
        from: { email: "f@t.com" },
        to: [{ email: "t@t.com" }],
        subject: "No ID",
        text: "body",
      }),
    ).rejects.toMatchObject({
      code: "UNKNOWN",
      provider: "postmark",
    });
  });

  it("throws ABORTED when signal is already aborted", async () => {
    const sendEmail = vi.fn();

    const adapter = postmark({
      serverToken: "dummy-token",
      client: { sendEmail },
    });

    const ac = new AbortController();
    ac.abort();

    await expect(
      adapter.send(
        {
          from: { email: "f@t.com" },
          to: [{ email: "t@t.com" }],
          subject: "Aborted",
          text: "body",
        },
        { signal: ac.signal },
      ),
    ).rejects.toMatchObject({
      code: "ABORTED",
      provider: "postmark",
    });

    expect(sendEmail).not.toHaveBeenCalled();
  });

  it("maps SDK PostmarkError code to PostboteError", async () => {
    const sdkError = Object.assign(new Error("Invalid API key"), {
      code: 10,
      statusCode: 401,
    });
    const sendEmail = vi.fn().mockRejectedValue(sdkError);

    const adapter = postmark({
      serverToken: "dummy-token",
      client: { sendEmail },
    });

    await expect(
      adapter.send({
        from: { email: "f@t.com" },
        to: [{ email: "t@t.com" }],
        subject: "Auth error",
        text: "body",
      }),
    ).rejects.toMatchObject({
      code: "AUTH",
      provider: "postmark",
    });
  });
});
