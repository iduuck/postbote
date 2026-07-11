import { fixtures } from "@postbote/adapter-contract";
import { describe, expect, it } from "vitest";
import { toMailgunFormData } from "./map.js";

describe("toMailgunFormData", () => {
  for (const [name, fixture] of Object.entries(fixtures)) {
    it(`maps ${name}`, () => {
      expect(
        Array.from(toMailgunFormData(fixture).entries()),
      ).toMatchSnapshot();
    });
  }

  it("decodes base64 string attachments before uploading", async () => {
    const form = toMailgunFormData(fixtures.full);
    const attachment = form.getAll("attachment")[0] as File;

    expect(await attachment.text()).toBe("Hello World");
  });

  it("maps tags as Mailgun tag values", () => {
    const form = toMailgunFormData(fixtures.full);

    expect(form.getAll("o:tag")).toEqual(["onboarding", "test"]);
  });
});
