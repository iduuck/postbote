import { describe, expect, it, vi } from "vitest";
import { mailgunHttp } from "./adapter.js";

const message = {
  from: { email: "from@example.com" },
  to: [{ email: "to@example.com" }],
  subject: "Subject",
  text: "Text",
};

describe("mailgunHttp", () => {
  it("sends a multipart message with Basic authentication", async () => {
    const fetch = vi
      .fn()
      .mockResolvedValue(new Response(JSON.stringify({ id: "mailgun-id" })));
    const adapter = mailgunHttp({
      apiKey: "key",
      domain: "example.com",
      fetch,
    });

    await expect(adapter.send(message)).resolves.toMatchObject({
      messageId: "mailgun-id",
    });
    expect(fetch).toHaveBeenCalledWith(
      "https://api.mailgun.net/v3/example.com/messages",
      expect.objectContaining({
        headers: { Authorization: "Basic YXBpOmtleQ==" },
        method: "POST",
      }),
    );
  });

  it("uses a configured EU base URL", async () => {
    const fetch = vi
      .fn()
      .mockResolvedValue(new Response(JSON.stringify({ id: "mailgun-id" })));
    const adapter = mailgunHttp({
      apiKey: "key",
      domain: "example.com",
      baseUrl: "https://api.eu.mailgun.net/",
      fetch,
    });

    await adapter.send(message);

    expect(fetch).toHaveBeenCalledWith(
      "https://api.eu.mailgun.net/v3/example.com/messages",
      expect.anything(),
    );
  });

  it("requires a domain", () => {
    expect(() => mailgunHttp({ apiKey: "key", domain: "" })).toThrow(
      "Mailgun domain is required",
    );
  });

  it("does not send when the signal is already aborted", async () => {
    const fetch = vi.fn();
    const adapter = mailgunHttp({
      apiKey: "key",
      domain: "example.com",
      fetch,
    });
    const controller = new AbortController();
    controller.abort();

    await expect(
      adapter.send(message, { signal: controller.signal }),
    ).rejects.toMatchObject({
      code: "ABORTED",
      provider: "mailgun-http",
    });
    expect(fetch).not.toHaveBeenCalled();
  });
});
