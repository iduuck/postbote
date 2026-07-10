import type {
  EmailMessage,
  EmailMessageInput,
  Middleware,
  PostboteError,
  SendContext,
  SendResult,
} from "@postbote/core";
import {
  isPostboteError,
  normalizeMessage,
  PostboteError as PBError,
  toPostboteError,
} from "@postbote/core";

export interface HooksOptions {
  transformMessage?: (
    message: Readonly<EmailMessage>,
    ctx: SendContext,
  ) => EmailMessageInput | Promise<EmailMessageInput>;
  beforeSend?: (
    ctx: SendContext,
    helpers: { cancel: (reason: string) => never },
  ) => void | Promise<void>;
  afterSend?: (ctx: SendContext, result: SendResult) => void | Promise<void>;
  onError?: (ctx: SendContext, error: PostboteError) => void | Promise<void>;
}

export function hooks(options: HooksOptions): Middleware {
  return async (ctx: SendContext, next) => {
    try {
      if (options.transformMessage) {
        ctx.message = normalizeMessage(
          await options.transformMessage(ctx.message, ctx),
        );
      }

      if (options.beforeSend) {
        await options.beforeSend(ctx, {
          cancel(reason: string): never {
            throw new PBError(reason, {
              code: "CANCELLED",
              provider: "plugin-hooks",
            });
          },
        });
      }
    } catch (err) {
      if (isPostboteError(err)) throw err;
      throw toPostboteError(err, "plugin-hooks");
    }

    try {
      const result = await next();

      try {
        await options.afterSend?.(ctx, result);
      } catch {
        // afterSend errors must not affect the send result
      }

      return result;
    } catch (err) {
      const error = isPostboteError(err)
        ? err
        : toPostboteError(err, "plugin-hooks");

      try {
        await options.onError?.(ctx, error);
      } catch {
        // onError errors must not replace the original error
      }

      throw error;
    }
  };
}
