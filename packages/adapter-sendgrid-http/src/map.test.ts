import { fixtures } from "@postbote/adapter-contract";
import { encodeAttachment } from "@postbote/core";
import { describe, expect, it } from "vitest";
import { toSendGridPayload } from "./map.js";

describe("toSendGridPayload", () => {
  it("maps minimal fixture", () => {
    const result = toSendGridPayload(fixtures.minimal);
    expect(result).toMatchSnapshot();
  });

  it("maps htmlOnly fixture", () => {
    const result = toSendGridPayload(fixtures.htmlOnly);
    expect(result).toMatchSnapshot();
  });

  it("maps textOnly fixture", () => {
    const result = toSendGridPayload(fixtures.textOnly);
    expect(result).toMatchSnapshot();
  });

  it("maps full fixture", () => {
    const result = toSendGridPayload(fixtures.full);
    expect(result).toMatchSnapshot();
  });

  it("maps manyRecipients fixture", () => {
    const result = toSendGridPayload(fixtures.manyRecipients);
    expect(result).toMatchSnapshot();
  });

  it("encodes Uint8Array attachments to base64", () => {
    const result = toSendGridPayload(fixtures.full);
    const att = result.attachments?.find((a) => a.filename === "photo.png");
    expect(att).toBeDefined();
    expect(typeof att?.content).toBe("string");
    expect(att?.content).toBe(
      encodeAttachment(new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10])),
    );
  });

  it("leaves string attachment content untouched", () => {
    const result = toSendGridPayload(fixtures.full);
    const att = result.attachments?.find((a) => a.filename === "readme.txt");
    expect(att?.content).toBe("SGVsbG8gV29ybGQ=");
  });

  it("sets disposition on attachments", () => {
    const result = toSendGridPayload(fixtures.full);
    for (const att of result.attachments ?? []) {
      expect(att.disposition).toBe("attachment");
    }
  });

  it("maps tags to custom_args", () => {
    const result = toSendGridPayload({
      from: { email: "f@t.com" },
      to: [{ email: "t@t.com" }],
      subject: "Tags Test",
      text: "body",
      tags: { campaign: "test", category: "signup" },
    });
    expect(result.custom_args).toEqual({
      campaign: "test",
      category: "signup",
    });
  });

  it("omits custom_args when no tags", () => {
    const result = toSendGridPayload(fixtures.minimal);
    expect(result.custom_args).toBeUndefined();
  });

  it("puts text content before html content", () => {
    const result = toSendGridPayload({
      from: { email: "f@t.com" },
      to: [{ email: "t@t.com" }],
      subject: "Ordering Test",
      text: "plain body",
      html: "<p>html body</p>",
    });
    expect(result.content).toHaveLength(2);
    const content = result.content as Array<{ type: string; value: string }>;
    expect(content[0]?.type).toBe("text/plain");
    expect(content[1]?.type).toBe("text/html");
  });

  it("includes only html when text is absent", () => {
    const result = toSendGridPayload(fixtures.htmlOnly);
    expect(result.content).toHaveLength(1);
    expect(result.content?.[0]?.type).toBe("text/html");
  });

  it("includes only text when html is absent", () => {
    const result = toSendGridPayload(fixtures.textOnly);
    expect(result.content).toHaveLength(1);
    expect(result.content?.[0]?.type).toBe("text/plain");
  });

  it("omits content array when neither text nor html present", () => {
    const result = toSendGridPayload({
      from: { email: "f@t.com" },
      to: [{ email: "t@t.com" }],
      subject: "No Content",
    });
    expect(result.content).toHaveLength(0);
  });

  it("includes reply_to when replyTo is set", () => {
    const result = toSendGridPayload(fixtures.full);
    expect(result.reply_to).toEqual({
      email: "noreply@example.com",
    });
  });

  it("omits reply_to when replyTo is not set", () => {
    const result = toSendGridPayload(fixtures.minimal);
    expect(result.reply_to).toBeUndefined();
  });

  it("includes headers when present", () => {
    const result = toSendGridPayload(fixtures.full);
    expect(result.headers).toEqual({
      "X-Custom-Header": "custom-value",
      "X-Priority": "high",
    });
  });

  it("omits headers when not present", () => {
    const result = toSendGridPayload(fixtures.minimal);
    expect(result.headers).toBeUndefined();
  });
});
