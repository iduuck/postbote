import { Result } from "better-result";
import { toPostboteError, type PluginObject, type PostboteError, type SendResult } from "@postbote/core";

export type { Result, PostboteError, SendResult };

export function betterResult(): PluginObject<{}, Promise<Result<SendResult, PostboteError>>> {
  return {
    name: "better-result",
    wrapSend: (run) =>
      Result.tryPromise({
        try: run,
        catch: (err) => toPostboteError(err as Error, "postbote"),
      }),
  };
}
