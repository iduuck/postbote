import { describe, expect, it } from "vitest";
import { runBetterResultExample } from "./example.js";

describe("better-result example", () => {
  it("handles exhausted failover without throwing", async () => {
    await expect(runBetterResultExample()).resolves.toBe(
      "PROVIDER_UNAVAILABLE",
    );
  });
});
