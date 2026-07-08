import { fixtures } from "@postbote/adapter-contract";
import { encodeAttachment } from "@postbote/core";
import { describe, expect, it } from "vitest";
import { toSendGridSdkPayload } from "./map.js";

describe("toSendGridSdkPayload", () => {
  it("maps minimal fixture", () => {
    const result = toSendGridSdkPayload(fixtures.minimal);
    expect(result).toMatchSnapshot();
  });

  it("maps htmlOnly fixture", () => {
    const result = toSendGridSdkPayload(fixtures.htmlOnly);
    expect(result).toMatchSnapshot();
  });

  it("maps textOnly fixture", () => {
    const result = toSendGridSdkPayload(fixtures.textOnly);
    expect(result).toMatchSnapshot();
  });

  it("maps full fixture", () => {
    const result = toSendGridSdkPayload(fixtures.full);
    expect(result).toMatchSnapshot();
  });

  it("maps manyRecipients fixture", () => {
    const result = toSendGridSdkPayload(fixtures.manyRecipients);
    expect(result).toMatchSnapshot();
  });

  it("encodes Uint8Array attachments to base64", () => {
    const result = toSendGridSdkPayload(fixtures.full);
    const att = result.attachments?.find((a) => a.filename === "photo.png");
    expect(att).toBeDefined();
    expect(typeof att?.content).toBe("string");
    expect(att?.content).toBe(
      encodeAttachment(new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10])),
    );
  });

  it("leaves string attachment content untouched", () => {
    const result = toSendGridSdkPayload(fixtures.full);
    const att = result.attachments?.find((a) => a.filename === "readme.txt");
    expect(att?.content).toBe("SGVsbG8gV29ybGQ=");
  });

  it("maps tags to customArgs", () => {
    const result = toSendGridSdkPayload({
      from: { email: "f@t.com" },
      to: [{ email: "t@t.com" }],
      subject: "Tags Test",
      text: "body",
      tags: { campaign: "test", category: "signup" },
    });
    expect(result.customArgs).toEqual({
      campaign: "test",
      category: "signup",
    });
  });

  it("sets disposition on attachments", () => {
    const result = toSendGridSdkPayload(fixtures.full);
    for (const att of result.attachments ?? []) {
      expect(att.disposition).toBe("attachment");
    }
  });
});
