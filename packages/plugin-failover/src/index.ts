import type {
  Adapter,
  AdapterName,
  Middleware,
  SendAttempt,
  SendContext,
} from "@postbote/core";
import { PostboteError, toPostboteError } from "@postbote/core";

export interface FailoverOptions<
  TFallbacks extends readonly Adapter[] = readonly Adapter[],
> {
  fallbacks: TFallbacks;
  shouldFailover?: (error: PostboteError, ctx: SendContext) => boolean;
  onFailover?: (info: {
    from: string;
    to: string;
    error: PostboteError;
    attempt: number;
  }) => void;
}

export class FailoverExhaustedError extends PostboteError {
  readonly attempts: readonly SendAttempt[];

  constructor(
    attempts: readonly SendAttempt[],
    opts?: { cause?: PostboteError },
  ) {
    super("All providers failed", {
      code: "PROVIDER_UNAVAILABLE",
      provider: "failover",
      retryable: true,
      cause: opts?.cause,
    });
    this.name = "FailoverExhaustedError";
    this.attempts = [...attempts];
  }
}

function safeCall(
  fn:
    | ((info: {
        from: string;
        to: string;
        error: PostboteError;
        attempt: number;
      }) => void)
    | undefined,
  info: {
    from: string;
    to: string;
    error: PostboteError;
    attempt: number;
  },
): void {
  if (fn) {
    try {
      fn(info);
    } catch {
      // Observability hooks must not change delivery behavior.
    }
  }
}

export function failover<const TFallbacks extends readonly Adapter[]>(
  options: FailoverOptions<TFallbacks>,
): Middleware & {
  readonly __providerNames?: AdapterName<TFallbacks[number]>;
} {
  const shouldFailover =
    options.shouldFailover ?? ((e: PostboteError) => e.retryable);

  return async (ctx, next) => {
    const primary = ctx.adapter;
    const chain = [primary, ...options.fallbacks];
    let lastError: PostboteError | undefined;

    for (let i = 0; i < chain.length; i++) {
      const adapter = chain[i];
      if (!adapter) break;
      ctx.adapter = adapter;
      try {
        return await next();
      } catch (err) {
        const error = toPostboteError(err, ctx.adapter.name);
        if (!shouldFailover(error, ctx)) throw error;
        lastError = error;
        const nextAdapter = chain[i + 1];
        if (nextAdapter) {
          safeCall(options.onFailover, {
            from: adapter.name,
            to: nextAdapter.name,
            error,
            attempt: i + 1,
          });
        }
      }
    }

    // An outer retry must begin with the primary adapter again.
    ctx.adapter = primary;
    throw new FailoverExhaustedError(ctx.attempts, { cause: lastError });
  };
}
