import type { ErrorCode } from "@postbote/core";
import { PostboteError } from "@postbote/core";

const PROVIDER = "sendgrid";

export function toPostboteErrorFromSdkError(err: unknown): PostboteError {
  if (err instanceof Error) {
    const code = (err as { code?: number }).code;

    let errorCode: ErrorCode;

    if (code === 401 || code === 403) {
      errorCode = "AUTH";
    } else if (code === 400 || code === 413) {
      errorCode = "INVALID_MESSAGE";
    } else if (code === 429) {
      errorCode = "RATE_LIMITED";
    } else if (code && code >= 500) {
      errorCode = "PROVIDER_UNAVAILABLE";
    } else if (err.message?.toLowerCase().includes("timeout")) {
      errorCode = "TIMEOUT";
    } else if (!code) {
      errorCode = "PROVIDER_UNAVAILABLE";
    } else {
      errorCode = "UNKNOWN";
    }

    return new PostboteError(err.message, {
      code: errorCode,
      provider: PROVIDER,
      cause: err,
    });
  }

  return new PostboteError(String(err), {
    code: "PROVIDER_UNAVAILABLE",
    provider: PROVIDER,
    cause: err,
  });
}
