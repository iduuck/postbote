import type { ErrorCode, Middleware, SendContext } from "@postbote/core";

export type PostboteLogEvent =
  | {
      type: "send:start";
      provider: string;
      toCount: number;
      timestamp: number;
      to?: string[];
    }
  | {
      type: "send:success";
      provider: string;
      messageId: string;
      durationMs: number;
      attemptCount: number;
      timestamp: number;
    }
  | {
      type: "send:error";
      error: { code: ErrorCode; retryable: boolean; message: string };
      durationMs: number;
      attemptCount: number;
      timestamp: number;
    }
  | {
      type: "attempt:error";
      adapter: string;
      index: number;
      error: { code: ErrorCode; retryable: boolean };
      timestamp: number;
    };

export interface LoggerOptions {
  onEvent: (event: PostboteLogEvent) => void;
  capture?: "none" | "counts" | "full";
}

export function logger(options: LoggerOptions): Middleware {
  const capture = options.capture ?? "counts";

  return async (ctx: SendContext, next) => {
    const start = Date.now();

    const toCount = ctx.message.to.length;
    const startEvent: PostboteLogEvent = {
      type: "send:start",
      provider: ctx.adapter.name,
      toCount: capture === "none" ? 0 : toCount,
      timestamp: start,
      ...(capture === "full"
        ? { to: ctx.message.to.map((a) => a.email) }
        : {}),
    };

    safeEmit(options.onEvent, startEvent);

    try {
      const result = await next();
      const durationMs = Date.now() - start;

      safeEmit(options.onEvent, {
        type: "send:success",
        provider: ctx.adapter.name,
        messageId: result.messageId,
        durationMs,
        attemptCount: ctx.attempts.length,
        timestamp: Date.now(),
      });

      if (ctx.attempts.length > 1) {
        for (let i = 0; i < ctx.attempts.length - 1; i++) {
          const attempt = ctx.attempts[i];
          if (attempt?.error) {
            safeEmit(options.onEvent, {
              type: "attempt:error",
              adapter: attempt.adapter,
              index: i,
              error: {
                code: attempt.error.code,
                retryable: attempt.error.retryable,
              },
              timestamp: Date.now(),
            });
          }
        }
      }

      return result;
    } catch (err) {
      const durationMs = Date.now() - start;
      const pbError =
        err && typeof err === "object" && "code" in err
          ? (err as { code: ErrorCode; retryable: boolean; message: string })
          : { code: "UNKNOWN" as ErrorCode, retryable: false, message: String(err) };

      safeEmit(options.onEvent, {
        type: "send:error",
        error: pbError,
        durationMs,
        attemptCount: ctx.attempts.length,
        timestamp: Date.now(),
      });

      if (ctx.attempts.length > 0) {
        for (let i = 0; i < ctx.attempts.length; i++) {
          const attempt = ctx.attempts[i];
          if (attempt?.error) {
            safeEmit(options.onEvent, {
              type: "attempt:error",
              adapter: attempt.adapter,
              index: i,
              error: {
                code: attempt.error.code,
                retryable: attempt.error.retryable,
              },
              timestamp: Date.now(),
            });
          }
        }
      }

      throw err;
    }
  };
}

function safeEmit(
  onEvent: (event: PostboteLogEvent) => void,
  event: PostboteLogEvent,
): void {
  try {
    onEvent(event);
  } catch {
    // logging errors must not break the send
  }
}