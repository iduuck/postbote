import { describe, expect, it } from "vitest";
import { runReactEmailExample } from "./example.js";

describe("React Email example", () => {
  it("renders HTML and plain text", async () => {
    const email = await runReactEmailExample();

    expect(email.html).toContain("Welcome Nick!");
    expect(email.text).toContain("WELCOME NICK!");
    expect(email).not.toHaveProperty("body");
  });
});
