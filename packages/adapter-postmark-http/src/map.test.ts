import { fixtures } from "@postbote/adapter-contract";
import { encodeAttachment, formatAddress } from "@postbote/core";
import { describe, expect, it } from "vitest";
import { toPostmarkPayload } from "./map.js";

const defaultMessageStream = "outbound";

describe("formatAddress", () => {
  it("returns email only when no name", () => {
    expect(formatAddress({ email: "a@b.com" })).toBe("a@b.com");
  });

  it("formats name and email", () => {
    expect(formatAddress({ email: "a@b.com", name: "Max" })).toBe(
      "Max <a@b.com>",
    );
  });

  it("handles name with umlauts", () => {
    expect(formatAddress({ email: "m@b.de", name: "Müller" })).toBe(
      "Müller <m@b.de>",
    );
  });
});

describe("toPostmarkPayload", () => {
  it("maps minimal fixture", () => {
    const result = toPostmarkPayload(fixtures.minimal, defaultMessageStream);
    expect(result).toMatchSnapshot();
  });

  it("maps htmlOnly fixture", () => {
    const result = toPostmarkPayload(fixtures.htmlOnly, defaultMessageStream);
    expect(result).toMatchSnapshot();
  });

  it("maps textOnly fixture", () => {
    const result = toPostmarkPayload(fixtures.textOnly, defaultMessageStream);
    expect(result).toMatchSnapshot();
  });

  it("maps full fixture", () => {
    const result = toPostmarkPayload(fixtures.full, defaultMessageStream);
    expect(result).toMatchSnapshot();
  });

  it("maps manyRecipients fixture", () => {
    const result = toPostmarkPayload(
      fixtures.manyRecipients,
      defaultMessageStream,
    );
    expect(result).toMatchSnapshot();
  });

  it("encodes Uint8Array attachments to base64", () => {
    const result = toPostmarkPayload(fixtures.full, defaultMessageStream);
    const att = result.Attachments?.find((a) => a.Name === "photo.png");
    expect(att).toBeDefined();
    expect(typeof att?.Content).toBe("string");
    expect(att?.Content).toBe(
      encodeAttachment(new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10])),
    );
  });

  it("leaves string attachment content untouched", () => {
    const result = toPostmarkPayload(fixtures.full, defaultMessageStream);
    const att = result.Attachments?.find((a) => a.Name === "readme.txt");
    expect(att?.Content).toBe("SGVsbG8gV29ybGQ=");
  });

  it("maps headers to {Name, Value} array", () => {
    const result = toPostmarkPayload(fixtures.full, defaultMessageStream);
    expect(result.Headers).toEqual([
      { Name: "X-Custom-Header", Value: "custom-value" },
      { Name: "X-Priority", Value: "high" },
    ]);
  });

  it("maps tags to Metadata object", () => {
    const result = toPostmarkPayload(fixtures.full, defaultMessageStream);
    expect(result.Metadata).toEqual({
      campaign: "onboarding",
      environment: "test",
    });
  });

  it("sets Tag from Metadata.tag", () => {
    const msg = {
      from: { email: "f@t.com" },
      to: [{ email: "t@t.com" }],
      subject: "Tag Test",
      text: "body",
      tags: { tag: "welcome", campaign: "onboarding" },
    };
    const result = toPostmarkPayload(msg, defaultMessageStream);
    expect(result.Metadata).toEqual({ tag: "welcome", campaign: "onboarding" });
    expect(result.Tag).toBe("welcome");
  });

  it("does not set Tag when Metadata has no tag key", () => {
    const msg = {
      from: { email: "f@t.com" },
      to: [{ email: "t@t.com" }],
      subject: "No Tag",
      text: "body",
      tags: { campaign: "onboarding" },
    };
    const result = toPostmarkPayload(msg, defaultMessageStream);
    expect(result.Tag).toBeUndefined();
  });

  it("sets MessageStream from parameter", () => {
    const result = toPostmarkPayload(fixtures.minimal, "transactional");
    expect(result.MessageStream).toBe("transactional");
  });

  it("throws INVALID_MESSAGE when to exceeds 50 recipients", () => {
    const msg = {
      from: { email: "f@t.com" },
      to: Array.from({ length: 51 }, (_, i) => ({
        email: `r${i}@example.com`,
      })),
      subject: "Too many",
      text: "body",
    };
    expect(() => toPostmarkPayload(msg, defaultMessageStream)).toThrow(
      "Too many recipients",
    );
  });

  it("throws INVALID_MESSAGE when cc exceeds 50 recipients", () => {
    const msg = {
      from: { email: "f@t.com" },
      to: [{ email: "t@t.com" }],
      cc: Array.from({ length: 51 }, (_, i) => ({
        email: `cc${i}@example.com`,
      })),
      subject: "Too many cc",
      text: "body",
    };
    expect(() => toPostmarkPayload(msg, defaultMessageStream)).toThrow(
      "Too many recipients",
    );
  });

  it("attachments use application/octet-stream when contentType missing", () => {
    const msg = {
      from: { email: "f@t.com" },
      to: [{ email: "t@t.com" }],
      subject: "Att",
      text: "body",
      attachments: [{ filename: "f.bin", content: "AAAA" }],
    };
    const result = toPostmarkPayload(msg, defaultMessageStream);
    expect(result.Attachments).toHaveLength(1);
    expect(result.Attachments?.[0]?.ContentType).toBe(
      "application/octet-stream",
    );
  });
});
