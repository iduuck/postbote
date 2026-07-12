import { PostboteError, toPostboteError } from "./errors.js";
import type { Adapter, EmailMessage, SendResult } from "./types.js";

export interface SendAttempt {
  adapter: string;
  error?: PostboteError;
}

export interface SendContext {
  message: EmailMessage;
  adapter: Adapter;
  /** Named adapters configured on this Postbote instance. */
  registry?: readonly Adapter[];
  attempts: SendAttempt[];
  signal?: AbortSignal;
  idempotencyKey?: string;
}

export type Next = () => Promise<SendResult>;

export type Middleware = (ctx: SendContext, next: Next) => Promise<SendResult>;

export function compose(middlewares: Middleware[]) {
  const terminal = async (ctx: SendContext): Promise<SendResult> => {
    if (ctx.signal?.aborted) {
      const err = new PostboteError("Send aborted", {
        code: "ABORTED",
        provider: ctx.adapter.name,
      });
      ctx.attempts.push({ adapter: ctx.adapter.name, error: err });
      throw err;
    }

    try {
      const result = await ctx.adapter.send(ctx.message, {
        signal: ctx.signal,
        idempotencyKey: ctx.idempotencyKey,
      });
      ctx.attempts.push({ adapter: ctx.adapter.name });
      return result;
    } catch (err) {
      const e = toPostboteError(err, ctx.adapter.name);
      ctx.attempts.push({ adapter: ctx.adapter.name, error: e });
      throw e;
    }
  };

  return middlewares.reduceRight<(ctx: SendContext) => Promise<SendResult>>(
    (next, mw) => (ctx) => mw(ctx, () => next(ctx)),
    terminal,
  );
}
