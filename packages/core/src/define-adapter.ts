import { type ErrorCode, PostboteError, toPostboteError } from "./errors.js";
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

export interface AdapterSpec {
  name: string;
  send(
    message: EmailMessage,
    ctx: { signal?: AbortSignal },
  ): Promise<{ messageId: string; raw?: unknown }>;
  mapUnknownError?: (err: unknown) => PostboteError | ErrorCode;
}

export function defineAdapter(spec: AdapterSpec): Adapter {
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
    ): Promise<SendResult> {
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
        if (err instanceof PostboteError) throw err;

        if (spec.mapUnknownError) {
          const mapped = spec.mapUnknownError(err);
          if (mapped instanceof PostboteError) throw mapped;
          throw new PostboteError(String(err), {
            code: mapped,
            provider: name,
            cause: err,
          });
        }

        const normalized = toPostboteError(err, name);
        if (normalized.code === "UNKNOWN" && normalized.provider === name) {
          throw new PostboteError(normalized.message, {
            code: "UNKNOWN",
            provider: name,
            cause: err,
          });
        }
        throw normalized;
      }
    },
  };
}
