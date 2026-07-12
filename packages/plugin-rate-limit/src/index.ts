import type { Middleware } from "@postbote/core";
import { PostboteError } from "@postbote/core";

export interface RateLimitOptions {
  tokens: number;
  intervalMs: number;
  burst?: number;
  mode?: "wait" | "reject";
  maxWaitMs?: number;
  maxQueue?: number;
}

export function rateLimit(options: RateLimitOptions): Middleware {
  if (!(options.tokens > 0) || !(options.intervalMs > 0))
    throw new TypeError("tokens and intervalMs must be positive");
  const capacity = options.burst ?? options.tokens;
  let available = capacity;
  let updatedAt = Date.now();
  let queued = 0;
  const denied = () =>
    new PostboteError("Rate limit exceeded", {
      code: "RATE_LIMITED",
      provider: "plugin-rate-limit",
    });
  return async (ctx, next) => {
    refill();
    if (available >= 1) {
      available--;
      return next();
    }
    if (options.mode === "reject" || queued >= (options.maxQueue ?? 100))
      throw denied();
    queued++;
    try {
      await waitForToken(ctx.signal);
    } finally {
      queued--;
    }
    return next();
  };
  function refill() {
    const now = Date.now();
    available = Math.min(
      capacity,
      available + ((now - updatedAt) * options.tokens) / options.intervalMs,
    );
    updatedAt = now;
  }
  function waitForToken(signal?: AbortSignal): Promise<void> {
    const maxWaitMs = options.maxWaitMs ?? 30_000;
    const started = Date.now();
    return new Promise((resolve, reject) => {
      const check = () => {
        if (signal?.aborted)
          return reject(
            new PostboteError("Send aborted", {
              code: "ABORTED",
              provider: "plugin-rate-limit",
            }),
          );
        refill();
        if (available >= 1) {
          available--;
          return resolve();
        }
        if (Date.now() - started >= maxWaitMs) return reject(denied());
        setTimeout(
          check,
          Math.max(
            1,
            Math.ceil(((1 - available) * options.intervalMs) / options.tokens),
          ),
        );
      };
      check();
    });
  }
}
