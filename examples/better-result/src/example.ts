import { createPostbote } from "@postbote/core";
import { betterResult } from "@postbote/plugin-better-result";
import { failover } from "@postbote/plugin-failover";
import { createTestAdapter } from "@postbote/testing";

export async function runBetterResultExample() {
  const primary = createTestAdapter({ name: "primary" });
  const fallback = createTestAdapter({ name: "fallback" });
  primary.failAlways("PROVIDER_UNAVAILABLE");
  fallback.failAlways("PROVIDER_UNAVAILABLE");

  const postbote = createPostbote({
    adapter: primary,
    plugins: [betterResult(), failover({ fallbacks: [fallback] })],
  });

  const result = await postbote.send({
    from: "sender@example.com",
    to: "recipient@example.com",
    subject: "Result example",
    html: "<p>Hello</p>",
  });

  return result.match({
    ok: (sent) => sent.messageId,
    err: (error) => error.code,
  });
}
