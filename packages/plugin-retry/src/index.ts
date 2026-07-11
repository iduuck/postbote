import type { Middleware, SendContext } from "@postbote/core";
import { PostboteError, toPostboteError } from "@postbote/core";

export interface RetryOptions {
  maxAttempts?: number;
  retryIf?: (error: PostboteError, ctx: SendContext) => boolean;
  backoff?:
    | { initialMs?: number; factor?: number; maxMs?: number; jitter?: boolean }
    | ((attempt: number, error: PostboteError) => number);
  respectRetryAfter?: boolean;
  onRetry?: (info: {
    attempt: number;
    delayMs: number;
    error: PostboteError;
  }) => void;
}

export function retry(options: RetryOptions = {}): Middleware {
  const maxAttempts = options.maxAttempts ?? 3;
  if (!Number.isInteger(maxAttempts) || maxAttempts < 1) {
    throw new TypeError("maxAttempts must be a positive integer");
  }

  return async (ctx, next) => {
    let lastError: PostboteError | undefined;
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        return await next();
      } catch (err) {
        const error = toPostboteError(err, ctx.adapter.name);
        lastError = error;
        if (
          attempt === maxAttempts ||
          !(options.retryIf ?? ((e) => e.retryable))(error, ctx)
        ) {
          throw error;
        }
        const delayMs = getDelay(attempt, error, options);
        try {
          options.onRetry?.({ attempt, delayMs, error });
        } catch {
          // Retry observers must not change delivery behaviour.
        }
        await sleep(delayMs, ctx.signal);
      }
    }
    throw lastError!;
  };
}

function getDelay(
  attempt: number,
  error: PostboteError,
  options: RetryOptions,
): number {
  const backoff = options.backoff;
  let delay: number;
  if (typeof backoff === "function") {
    delay = backoff(attempt, error);
  } else {
    const initialMs = backoff?.initialMs ?? 200;
    const factor = backoff?.factor ?? 2;
    const maxMs = backoff?.maxMs ?? 10_000;
    delay = Math.min(maxMs, initialMs * factor ** (attempt - 1));
    if (backoff?.jitter ?? true) delay = Math.random() * delay;
  }
  const retryAfter =
    options.respectRetryAfter === false ? undefined : error.retryAfterMs;
  return Math.max(
    0,
    retryAfter === undefined ? delay : Math.max(delay, retryAfter),
  );
}

function sleep(delayMs: number, signal?: AbortSignal): Promise<void> {
  if (signal?.aborted) return Promise.reject(aborted());
  return new Promise((resolve, reject) => {
    const timer = setTimeout(done, delayMs);
    const onAbort = () => {
      clearTimeout(timer);
      cleanup();
      reject(aborted());
    };
    const cleanup = () => signal?.removeEventListener("abort", onAbort);
    function done() {
      cleanup();
      resolve();
    }
    signal?.addEventListener("abort", onAbort, { once: true });
  });
}

function aborted(): PostboteError {
  return new PostboteError("Send aborted", {
    code: "ABORTED",
    provider: "retry",
  });
}
