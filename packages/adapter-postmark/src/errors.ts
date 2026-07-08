import type { ErrorCode } from "@postbote/core";
import { PostboteError } from "@postbote/core";

const PROVIDER = "postmark";

export interface PostmarkSdkError {
  code: number;
  statusCode: number;
  message: string;
}

export function toPostboteErrorFromSdkError(error: unknown): PostboteError {
  if (typeof error !== "object" || error === null) {
    return new PostboteError(String(error), {
      code: "PROVIDER_UNAVAILABLE",
      provider: PROVIDER,
      cause: error,
    });
  }

  const sdkErr = error as Partial<PostmarkSdkError>;
  const message = sdkErr.message ?? String(error);
  const code = sdkErr.code;
  const statusCode = sdkErr.statusCode;

  let mappedCode: ErrorCode;

  if (code === 9) {
    mappedCode = "RATE_LIMITED";
  } else if (code === 10) {
    mappedCode = "AUTH";
  } else if (code === 300) {
    mappedCode = "INVALID_MESSAGE";
  } else if (code === 406) {
    mappedCode = "RECIPIENT_REJECTED";
  } else if (statusCode === 401 || statusCode === 403) {
    mappedCode = "AUTH";
  } else if (statusCode === 429) {
    mappedCode = "RATE_LIMITED";
  } else if (typeof statusCode === "number" && statusCode >= 500) {
    mappedCode = "PROVIDER_UNAVAILABLE";
  } else if (
    (code === 0 || code === undefined) &&
    (statusCode === 0 || statusCode === undefined)
  ) {
    if (typeof message === "string" && /timeout/i.test(message)) {
      mappedCode = "TIMEOUT";
    } else {
      mappedCode = "PROVIDER_UNAVAILABLE";
    }
  } else {
    mappedCode = "UNKNOWN";
  }

  return new PostboteError(message, {
    code: mappedCode,
    provider: PROVIDER,
    cause: error,
  });
}
