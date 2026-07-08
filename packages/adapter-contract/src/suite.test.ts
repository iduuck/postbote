import type { EmailMessage } from "@postbote/core";
import { normalizeMessage } from "@postbote/core";
import { describe, expect, it } from "vitest";
import { fixtures } from "./fixtures.js";

describe("fixtures", () => {
  for (const [name, _msg] of Object.entries(fixtures)) {
    const msg = _msg as EmailMessage;
    it(`"${name}" is a valid EmailMessage`, () => {
      const input: Parameters<typeof normalizeMessage>[0] = {
        from: msg.from.email,
        to: msg.to.map((a) => a.email).join(", "),
        subject: msg.subject,
      };
      if (msg.html) input.html = msg.html;
      if (msg.text) input.text = msg.text;
      expect(() => normalizeMessage(input)).not.toThrow();
    });
  }
});
