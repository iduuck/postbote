import { fixtures } from "@postbote/adapter-contract";
import { encodeAttachment, formatAddress } from "@postbote/core";
import { describe, expect, it } from "vitest";
import { toResendPayload } from "./map.js";

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

describe("toResendPayload", () => {
  it("maps minimal fixture", () => {
    const result = toResendPayload(fixtures.minimal);
    expect(result).toMatchSnapshot();
  });

  it("maps htmlOnly fixture", () => {
    const result = toResendPayload(fixtures.htmlOnly);
    expect(result).toMatchSnapshot();
  });

  it("maps textOnly fixture", () => {
    const result = toResendPayload(fixtures.textOnly);
    expect(result).toMatchSnapshot();
  });

  it("maps full fixture", () => {
    const result = toResendPayload(fixtures.full);
    expect(result).toMatchSnapshot();
  });

  it("maps manyRecipients fixture", () => {
    const result = toResendPayload(fixtures.manyRecipients);
    expect(result).toMatchSnapshot();
  });

  it("encodes Uint8Array attachments to base64", () => {
    const result = toResendPayload(fixtures.full);
    const att = result.attachments?.find((a) => a.filename === "photo.png");
    expect(att).toBeDefined();
    expect(typeof att?.content).toBe("string");
    expect(att?.content).toBe(
      encodeAttachment(new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10])),
    );
  });

  it("leaves string attachment content untouched", () => {
    const result = toResendPayload(fixtures.full);
    const att = result.attachments?.find((a) => a.filename === "readme.txt");
    expect(att?.content).toBe("SGVsbG8gV29ybGQ=");
  });

  it("maps tags object to array form", () => {
    const result = toResendPayload({
      from: { email: "f@t.com" },
      to: [{ email: "t@t.com" }],
      subject: "Tags Test",
      text: "body",
      tags: { campaign: "test", category: "signup" },
    });
    expect(result.tags).toEqual([
      { name: "campaign", value: "test" },
      { name: "category", value: "signup" },
    ]);
  });

  it("sanitizes tag names with invalid characters", () => {
    const result = toResendPayload({
      from: { email: "f@t.com" },
      to: [{ email: "t@t.com" }],
      subject: "Tag Sanitize",
      text: "body",
      tags: { "my-tag/1": "val", "hello world": "x" },
    });
    expect(result.tags).toEqual([
      { name: "my-tag_1", value: "val" },
      { name: "hello_world", value: "x" },
    ]);
  });
});
