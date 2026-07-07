import { type PostboteError, toPostboteError } from "./errors.js";
import type { Adapter, EmailMessage, SendResult } from "./types.js";

export interface SendAttempt {
  adapter: string;
  error?: PostboteError;
}

export interface SendContext {
  message: EmailMessage;
  adapter: Adapter;
  attempts: SendAttempt[];
}

export type Next = () => Promise<SendResult>;

export type Middleware = (ctx: SendContext, next: Next) => Promise<SendResult>;

export function compose(middlewares: Middleware[]) {
  const terminal = async (ctx: SendContext): Promise<SendResult> => {
    try {
      const result = await ctx.adapter.send(ctx.message);
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
