import { describe, expect, it, vi } from "vitest";
import { postmarkHttp } from "./adapter.js";

describe("postmarkHttp()", () => {
  it("uses injected fetch and baseUrl", async () => {
    const mockFetch = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({ MessageID: "custom-fetch-id", SubmittedAt: "now" }),
        {
          status: 200,
          headers: { "content-type": "application/json" },
        },
      ),
    );

    const adapter = postmarkHttp({
      serverToken: "pma_dummy",
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
    expect(result.provider).toBe("postmark-http");
    expect(mockFetch).toHaveBeenCalledOnce();

    const callUrl = mockFetch.mock.calls[0]?.[0];
    expect(callUrl).toBe("http://localhost:9999/email");
  });

  it("throws UNKNOWN when response has no MessageID", async () => {
    const mockFetch = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({}), {
        status: 200,
        headers: { "content-type": "application/json" },
      }),
    );

    const adapter = postmarkHttp({
      serverToken: "pma_dummy",
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
      provider: "postmark-http",
    });
  });

  it("throws PROVIDER_UNAVAILABLE when fetch throws (network error)", async () => {
    const mockFetch = vi.fn().mockRejectedValue(new Error("ECONNREFUSED"));

    const adapter = postmarkHttp({
      serverToken: "pma_dummy",
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
      provider: "postmark-http",
      retryable: true,
    });
  });
});
