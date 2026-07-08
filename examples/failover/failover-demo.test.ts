import { createPostbote, PostboteError } from "@postbote/core";
import { failover } from "@postbote/plugin-failover";
import { createTestAdapter } from "@postbote/testing";
import { describe, expect, it } from "vitest";

const dummy = { from: "f@t.com", to: "t@t.com", subject: "Hi", text: "Hello" };

describe("failover demo — Resend fällt aus, Postmark übernimmt", () => {
  it("send via fallback when primary is unavailable", async () => {
    const resend = createTestAdapter({ name: "resend" });
    const postmark = createTestAdapter({ name: "postmark" });

    resend.failAlways(
      new PostboteError("Resend is down", {
        code: "PROVIDER_UNAVAILABLE",
        provider: "resend",
      }),
    );

    const pb = createPostbote({
      adapter: resend,
      plugins: [failover({ fallbacks: [postmark] })],
    });

    const result = await pb.send(dummy);

    expect(result.provider).toBe("postmark");
    expect(postmark.inbox.count()).toBe(1);
    expect(postmark.inbox.last()?.subject).toBe("Hi");
  });

  it("uses primary when it works", async () => {
    const resend = createTestAdapter({ name: "resend" });
    const postmark = createTestAdapter({ name: "postmark" });

    const pb = createPostbote({
      adapter: resend,
      plugins: [failover({ fallbacks: [postmark] })],
    });

    const result = await pb.send(dummy);

    expect(result.provider).toBe("resend");
    expect(resend.inbox.count()).toBe(1);
    expect(postmark.inbox.count()).toBe(0);
  });

  it("onFailover hook is called on switch", async () => {
    const resend = createTestAdapter({ name: "resend" });
    const postmark = createTestAdapter({ name: "postmark" });

    resend.failAlways(
      new PostboteError("down", {
        code: "PROVIDER_UNAVAILABLE",
        provider: "resend",
      }),
    );

    const calls: string[] = [];
    const pb = createPostbote({
      adapter: resend,
      plugins: [
        failover({
          fallbacks: [postmark],
          onFailover: ({ from, to }) => void calls.push(`${from}→${to}`),
        }),
      ],
    });

    await pb.send(dummy);
    expect(calls).toEqual(["resend→postmark"]);
  });

  it("throws FailoverExhaustedError when all fail", async () => {
    const resend = createTestAdapter({ name: "resend" });
    const postmark = createTestAdapter({ name: "postmark" });

    resend.failAlways(
      new PostboteError("down", {
        code: "PROVIDER_UNAVAILABLE",
        provider: "resend",
      }),
    );
    postmark.failAlways(
      new PostboteError("down", {
        code: "PROVIDER_UNAVAILABLE",
        provider: "postmark",
      }),
    );

    const pb = createPostbote({
      adapter: resend,
      plugins: [failover({ fallbacks: [postmark] })],
    });

    const err = await pb.send(dummy).catch((e) => e);
    expect(err.code).toBe("PROVIDER_UNAVAILABLE");
    expect(err.attempts).toHaveLength(2);
  });
});
