import {
  type PluginObject,
  type PostboteError,
  type SendResult,
  toPostboteError,
} from "@postbote/core";
import { Result } from "better-result";

export type { PostboteError, Result, SendResult };

export function betterResult(): PluginObject<
  {},
  Promise<Result<SendResult, PostboteError>>
> {
  return {
    name: "better-result",
    wrapSend: (run) =>
      Result.tryPromise({
        try: run,
        catch: (err) => toPostboteError(err as Error, "postbote"),
      }),
  };
}
