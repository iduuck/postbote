import { createPostbote } from "@postbote/core";
import { failover } from "@postbote/plugin-failover";
import { hooks } from "@postbote/plugin-hooks";
import { logger, type PostboteLogEvent } from "@postbote/plugin-logger";
import { otel } from "@postbote/plugin-otel";
import { createTestAdapter } from "@postbote/testing";

export async function runObservabilityExample() {
  const primary = createTestAdapter({ name: "primary" });
  const fallback = createTestAdapter({ name: "fallback" });
  const events: PostboteLogEvent[] = [];
  let beforeSendCalls = 0;

  primary.failNext("PROVIDER_UNAVAILABLE");

  const postbote = createPostbote({
    adapter: primary,
    plugins: [
      hooks({
        beforeSend: () => {
          beforeSendCalls++;
        },
      }),
      logger({ onEvent: (event) => events.push(event) }),
      otel(),
      failover({ fallbacks: [fallback] }),
    ],
  });

  const result = await postbote.send({
    from: "sender@example.com",
    to: "recipient@example.com",
    subject: "Observed send",
    html: "<p>Hello</p>",
  });

  return { beforeSendCalls, events, result };
}
