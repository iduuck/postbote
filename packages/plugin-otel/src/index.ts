import type { Tracer } from "@opentelemetry/api";
import { SpanKind, SpanStatusCode, trace } from "@opentelemetry/api";
import type { Middleware, SendContext } from "@postbote/core";

export interface OtelOptions {
  tracer?: Tracer;
  captureRecipients?: "none" | "count";
}

export function otel(options: OtelOptions = {}): Middleware {
  const captureRecipients = options.captureRecipients ?? "count";

  return async (ctx: SendContext, next) => {
    const tracer = options.tracer ?? trace.getTracer("@postbote/plugin-otel");

    return tracer.startActiveSpan(
      "postbote.send",
      { kind: SpanKind.CLIENT },
      async (span) => {
        span.setAttribute("postbote.provider", ctx.adapter.name);
        span.setAttribute("postbote.attempt_count", 0);
        if (captureRecipients === "count") {
          span.setAttribute("postbote.recipient_count", ctx.message.to.length);
        }

        try {
          const result = await next();

          span.setAttribute("postbote.message_id", result.messageId);
          span.setAttribute("postbote.attempt_count", ctx.attempts.length);

          for (let i = 0; i < ctx.attempts.length; i++) {
            const attempt = ctx.attempts[i];
            if (attempt?.error) {
              span.addEvent("postbote.attempt", {
                adapter: attempt.adapter,
                "error.code": attempt.error.code,
                "error.retryable": String(attempt.error.retryable),
                "attempt.index": i,
              });
            }
          }

          span.setStatus({ code: SpanStatusCode.OK });
          span.end();
          return result;
        } catch (err) {
          const pbError =
            err && typeof err === "object" && "code" in err
              ? (err as { code: string; retryable: boolean; message: string })
              : { code: "UNKNOWN", retryable: false, message: String(err) };

          span.setAttribute("postbote.attempt_count", ctx.attempts.length);
          span.setAttribute("postbote.error_code", pbError.code);

          for (let i = 0; i < ctx.attempts.length; i++) {
            const attempt = ctx.attempts[i];
            if (attempt?.error) {
              span.addEvent("postbote.attempt", {
                adapter: attempt.adapter,
                "error.code": attempt.error.code,
                "error.retryable": String(attempt.error.retryable),
                "attempt.index": i,
              });
            }
          }

          span.recordException(
            err instanceof Error ? err : new Error(String(err)),
          );
          span.setStatus({
            code: SpanStatusCode.ERROR,
            message: pbError.message,
          });
          span.end();
          throw err;
        }
      },
    );
  };
}
