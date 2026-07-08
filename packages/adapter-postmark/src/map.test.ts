import { fixtures } from "@postbote/adapter-contract";
import { encodeAttachment } from "@postbote/core";
import { describe, expect, it } from "vitest";
import { toPostmarkSdkPayload } from "./map.js";

describe("toPostmarkSdkPayload", () => {
  it("maps minimal fixture", () => {
    const result = toPostmarkSdkPayload(fixtures.minimal);
    expect(result).toMatchSnapshot();
  });

  it("maps htmlOnly fixture", () => {
    const result = toPostmarkSdkPayload(fixtures.htmlOnly);
    expect(result).toMatchSnapshot();
  });

  it("maps textOnly fixture", () => {
    const result = toPostmarkSdkPayload(fixtures.textOnly);
    expect(result).toMatchSnapshot();
  });

  it("maps full fixture", () => {
    const result = toPostmarkSdkPayload(fixtures.full);
    expect(result).toMatchSnapshot();
  });

  it("maps manyRecipients fixture", () => {
    const result = toPostmarkSdkPayload(fixtures.manyRecipients);
    expect(result).toMatchSnapshot();
  });

  it("encodes Uint8Array attachments to base64", () => {
    const result = toPostmarkSdkPayload(fixtures.full);
    const att = (result.Attachments as Array<Record<string, unknown>>)?.find(
      (a) => a.Name === "photo.png",
    );
    expect(att).toBeDefined();
    expect(typeof att?.Content).toBe("string");
    expect(att?.Content).toBe(
      encodeAttachment(new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10])),
    );
  });

  it("leaves string attachment content untouched", () => {
    const result = toPostmarkSdkPayload(fixtures.full);
    const att = (result.Attachments as Array<Record<string, unknown>>)?.find(
      (a) => a.Name === "readme.txt",
    );
    expect(att?.Content).toBe("SGVsbG8gV29ybGQ=");
  });

  it("includes ContentType fallback on attachments", () => {
    const result = toPostmarkSdkPayload(fixtures.full);
    const att = (result.Attachments as Array<Record<string, unknown>>)?.find(
      (a) => a.Name === "readme.txt",
    );
    expect(att?.ContentType).toBe("text/plain");
  });

  it("adds ContentType fallback when missing", () => {
    const result = toPostmarkSdkPayload({
      from: { email: "f@t.com" },
      to: [{ email: "t@t.com" }],
      subject: "No ContentType",
      text: "body",
      attachments: [{ filename: "file.bin", content: "AAAA" }],
    });
    const att = (result.Attachments as Array<Record<string, unknown>>)?.[0];
    expect(att?.ContentType).toBe("application/octet-stream");
  });

  it("maps headers to Name/Value array", () => {
    const result = toPostmarkSdkPayload(fixtures.full);
    expect(result.Headers).toEqual([
      { Name: "X-Custom-Header", Value: "custom-value" },
      { Name: "X-Priority", Value: "high" },
    ]);
  });

  it("maps tags to Metadata and promotes tag key", () => {
    const result = toPostmarkSdkPayload({
      from: { email: "f@t.com" },
      to: [{ email: "t@t.com" }],
      subject: "Tags Test",
      text: "body",
      tags: { tag: "welcome", campaign: "onboarding" },
    });
    expect(result.Metadata).toEqual({ tag: "welcome", campaign: "onboarding" });
    expect(result.Tag).toBe("welcome");
  });

  it("sets MessageStream from options", () => {
    const result = toPostmarkSdkPayload(fixtures.minimal, "outbound");
    expect(result.MessageStream).toBe("outbound");
  });

  it("omits MessageStream when not provided", () => {
    const result = toPostmarkSdkPayload(fixtures.minimal);
    expect(result.MessageStream).toBeUndefined();
  });

  it("throws when recipient count exceeds 50", () => {
    const manyTo = Array.from({ length: 51 }, (_, i) => ({
      email: `r${i}@example.com`,
    }));
    expect(() =>
      toPostmarkSdkPayload({
        from: { email: "f@t.com" },
        to: manyTo,
        subject: "Too many",
        text: "body",
      }),
    ).toThrow(RangeError);
  });

  it("splits To into comma-separated string", () => {
    const result = toPostmarkSdkPayload(fixtures.manyRecipients);
    expect(typeof result.To).toBe("string");
    expect(result.To).toContain("r1@example.com");
    expect(result.To).toContain("Fourth Recipient <r4@example.com>");
  });
});
