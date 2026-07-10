import { createPostbote } from "@postbote/core";
import { createTestAdapter } from "@postbote/testing";
import { render } from "@react-email/render";
import React from "react";
import { describe, expect, it, vi } from "vitest";

vi.mock("@react-email/render", () => ({
  render: vi.fn().mockRejectedValue(new Error("render failure")),
}));

import { reactEmail } from "./index.js";

describe("reactEmail render errors", () => {
  it("rejects with INVALID_MESSAGE and does not call the adapter", async () => {
    const adapter = createTestAdapter();
    const postbote = createPostbote({
      adapter,
      plugins: [reactEmail()],
    });

    await expect(
      postbote.send({
        from: "sender@example.com",
        to: "recipient@example.com",
        subject: "Welcome",
        body: React.createElement("h1", null, "Welcome"),
      }),
    ).rejects.toMatchObject({
      code: "INVALID_MESSAGE",
      provider: "plugin-react-email",
      cause: expect.objectContaining({ message: "render failure" }),
    });
    expect(adapter.calls).toHaveLength(0);
  });

  it("uses a safe message for non-Error render failures", async () => {
    vi.mocked(render).mockRejectedValueOnce("render failure");
    const postbote = createPostbote({
      adapter: createTestAdapter(),
      plugins: [reactEmail()],
    });

    await expect(
      postbote.send({
        from: "sender@example.com",
        to: "recipient@example.com",
        subject: "Welcome",
        body: React.createElement("h1", null, "Welcome"),
      }),
    ).rejects.toMatchObject({ message: "Failed to render email" });
  });
});
