import { fixtures } from "@postbote/adapter-contract";
import { describe, expect, it } from "vitest";
import { toSmtpPayload } from "./map.js";

describe("toSmtpPayload", () => {
  for (const [name, fixture] of Object.entries(fixtures)) {
    it(`maps ${name}`, () => {
      expect(toSmtpPayload(fixture)).toMatchSnapshot();
    });
  }

  it("converts Uint8Array attachments to Buffer", () => {
    const payload = toSmtpPayload(fixtures.full);
    const attachment = payload.attachments?.find(
      (item) => item.filename === "photo.png",
    );

    expect(Buffer.isBuffer(attachment?.content)).toBe(true);
  });

  it("marks string attachments as base64", () => {
    const payload = toSmtpPayload(fixtures.full);
    const attachment = payload.attachments?.find(
      (item) => item.filename === "readme.txt",
    );

    expect(attachment).toMatchObject({
      content: "SGVsbG8gV29ybGQ=",
      encoding: "base64",
    });
  });

  it("maps tags to Postbote SMTP headers", () => {
    const payload = toSmtpPayload(fixtures.full);

    expect(payload.headers).toMatchObject({
      "X-Postbote-Tag-campaign": "onboarding",
      "X-Postbote-Tag-environment": "test",
    });
  });
});
