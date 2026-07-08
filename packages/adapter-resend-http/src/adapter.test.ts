import { describe, expect, it, vi } from "vitest";
import { resendHttp } from "./adapter.js";

describe("resendHttp()", () => {
  it("uses injected fetch and baseUrl", async () => {
    const mockFetch = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ id: "custom-fetch-id" }), {
        status: 200,
        headers: { "content-type": "application/json" },
      }),
    );

    const adapter = resendHttp({
      apiKey: "re_dummy",
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
    expect(result.provider).toBe("resend-http");
    expect(mockFetch).toHaveBeenCalledOnce();

    const callUrl = mockFetch.mock.calls[0]?.[0];
    expect(callUrl).toBe("http://localhost:9999/emails");
  });

  it("throws UNKNOWN when response has no id", async () => {
    const mockFetch = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({}), {
        status: 200,
        headers: { "content-type": "application/json" },
      }),
    );

    const adapter = resendHttp({
      apiKey: "re_dummy",
      fetch: mockFetch,
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
      provider: "resend-http",
    });
  });

  it("throws PROVIDER_UNAVAILABLE when fetch throws (network error)", async () => {
    const mockFetch = vi.fn().mockRejectedValue(new Error("ECONNREFUSED"));

    const adapter = resendHttp({
      apiKey: "re_dummy",
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
      provider: "resend-http",
      retryable: true,
    });
  });
});
