import type { Middleware, PostboteError, SendContext } from "@postbote/core";
import { PostboteError as PBError, toPostboteError } from "@postbote/core";

export interface HooksOptions {
  beforeSend?: (
    ctx: SendContext,
    helpers: { cancel: (reason: string) => never },
  ) => void | Promise<void>;
  afterSend?: (ctx: SendContext, result: unknown) => void | Promise<void>;
  onError?: (ctx: SendContext, error: PostboteError) => void | Promise<void>;
}

export function hooks(options: HooksOptions): Middleware {
  return async (ctx: SendContext, next) => {
    if (options.beforeSend) {
      try {
        await options.beforeSend(ctx, {
          cancel(reason: string): never {
            throw new PBError(reason, {
              code: "CANCELLED",
              provider: "plugin-hooks",
            });
          },
        });
      } catch (err) {
        if (err instanceof PBError) throw err;
        throw toPostboteError(err, "plugin-hooks");
      }
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
      const error =
        err instanceof PBError ? err : toPostboteError(err, "plugin-hooks");

      try {
        await options.onError?.(ctx, error);
      } catch {
        // onError errors must not replace the original error
      }

      throw error;
    }
  };
}