import { createPostbote, defineAdapter, type SendResult } from "@postbote/core";
import { assertType, describe, it } from "vitest";

const adapter = defineAdapter({
  name: "test",
  send: () => Promise.resolve({ messageId: "1" }),
});
const base = {
  from: "f@t.com",
  to: "t@t.com",
  subject: "s",
  html: "<p>hi</p>",
};

describe("wrapSend types", () => {
  it("without plugins, send() returns Promise<SendResult>", () => {
    const pb = createPostbote({ adapter });
    assertType<Promise<SendResult>>(pb.send(base));
  });
});
