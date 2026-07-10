import { describe, expect, it } from "vitest";
import { runObservabilityExample } from "./example.js";

describe("observability example", () => {
  it("observes one logical send with a failed primary attempt", async () => {
    const { beforeSendCalls, events, result } = await runObservabilityExample();

    expect(beforeSendCalls).toBe(1);
    expect(result.provider).toBe("fallback");
    expect(events.map((event) => event.type)).toEqual([
      "send:start",
      "send:success",
      "attempt:error",
    ]);
  });
});
