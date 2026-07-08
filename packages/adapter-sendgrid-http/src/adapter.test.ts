import { describe, expect, it, vi } from "vitest";
import { sendgridHttp } from "./adapter.js";

describe("sendgridHttp()", () => {
  it("uses injected fetch and baseUrl", async () => {
    const mockFetch = vi.fn().mockResolvedValue(
      new Response(null, {
        status: 202,
        headers: {
          "content-type": "application/json",
          "x-message-id": "custom-fetch-id",
        },
      }),
    );

    const adapter = sendgridHttp({
      apiKey: "SG_dummy",
      baseUrl: "http://localhost:9999",
      fetch: mockFetch,
    });

    const result = await adapter.send({
      from: { email: "f@t.com" },
      to: [{ email: "t@t.com" }],
      subject: "Custom Fetch",
      text: "body",
    });

    expect(result.messageId).toBe("custom-fetch-id");
    expect(result.provider).toBe("sendgrid-http");
    expect(result.raw).toEqual({ status: 202 });
    expect(mockFetch).toHaveBeenCalledOnce();

    const callUrl = mockFetch.mock.calls[0]?.[0];
    expect(callUrl).toBe("http://localhost:9999/v3/mail/send");
  });

  it("throws UNKNOWN when X-Message-Id header is missing", async () => {
    const mockFetch = vi.fn().mockResolvedValue(
      new Response(null, {
        status: 202,
        headers: { "content-type": "application/json" },
      }),
    );

    const adapter = sendgridHttp({
      apiKey: "SG_dummy",
      fetch: mockFetch,
    });

    await expect(
      adapter.send({
        from: { email: "f@t.com" },
        to: [{ email: "t@t.com" }],
        subject: "No Header",
        text: "body",
      }),
    ).rejects.toMatchObject({
      code: "UNKNOWN",
      provider: "sendgrid-http",
    });
  });

  it("throws PROVIDER_UNAVAILABLE when fetch throws (network error)", async () => {
    const mockFetch = vi.fn().mockRejectedValue(new Error("ECONNREFUSED"));

    const adapter = sendgridHttp({
      apiKey: "SG_dummy",
      fetch: mockFetch,
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
      provider: "sendgrid-http",
      retryable: true,
    });
  });
});
