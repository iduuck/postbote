import {
  type ErrorCode,
  isPostboteError,
  PostboteError,
  toPostboteError,
} from "./errors.js";
import type { Adapter, EmailMessage, SendResult } from "./types.js";

const NAME_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export function httpStatusToErrorCode(status: number): ErrorCode {
  if (status === 401 || status === 403) return "AUTH";
  if (status === 408) return "TIMEOUT";
  if (status === 413 || status === 422) return "INVALID_MESSAGE";
  if (status === 429) return "RATE_LIMITED";
  if (status >= 500) return "PROVIDER_UNAVAILABLE";
  return "UNKNOWN";
}

export interface AdapterSpec<TName extends string = string> {
  name: TName;
  send(
    message: EmailMessage,
    ctx: { signal?: AbortSignal },
  ): Promise<{ messageId: string; raw?: unknown }>;
  mapUnknownError?: (err: unknown) => PostboteError | ErrorCode;
}

export function defineAdapter<const TName extends string>(
  spec: AdapterSpec<TName>,
): Adapter<TName> {
  if (!NAME_RE.test(spec.name)) {
    throw new TypeError(
      `Invalid adapter name "${spec.name}": must match [a-z0-9-]+`,
    );
  }

  const { name } = spec;

  return {
    get name() {
      return name;
    },
    async send(
      message: EmailMessage,
      options?: { signal?: AbortSignal },
    ): Promise<SendResult<TName>> {
      if (options?.signal?.aborted) {
        const err = new PostboteError("Send aborted", {
          code: "ABORTED",
          provider: name,
        });
        throw err;
      }

      try {
        const result = await spec.send(message, {
          signal: options?.signal,
        });

        if (!result.messageId) {
          throw new PostboteError("Provider did not return a message ID", {
            code: "UNKNOWN",
            provider: name,
          });
        }

        return { messageId: result.messageId, provider: name, raw: result.raw };
      } catch (err) {
        if (isPostboteError(err)) throw err;

        if (spec.mapUnknownError) {
          const mapped = spec.mapUnknownError(err);
          if (isPostboteError(mapped)) throw mapped;
          throw new PostboteError(String(err), {
            code: mapped,
            provider: name,
            cause: err,
          });
        }

        throw toPostboteError(err, name);
      }
    },
  };
}
