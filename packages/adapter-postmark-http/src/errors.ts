import type { ErrorCode } from "@postbote/core";
import { PostboteError } from "@postbote/core";

const PROVIDER = "postmark-http";

interface PostmarkErrorBody {
  ErrorCode?: number;
  Message?: string;
}

export function toPostboteErrorFromResponse(
  response: Response,
  body: unknown,
): PostboteError {
  const status = response.status;
  const errorBody = body as PostmarkErrorBody | undefined;
  const message = errorBody?.Message ?? response.statusText;
  const errorCode = errorBody?.ErrorCode;

  let code: ErrorCode;

  if (status === 401 || errorCode === 10) {
    code = "AUTH";
  } else if (status === 422 && errorCode === 406) {
    code = "RECIPIENT_REJECTED";
  } else if (status === 422 && errorCode === 300) {
    if (message && /recipient/i.test(message)) {
      code = "RECIPIENT_REJECTED";
    } else {
      code = "INVALID_MESSAGE";
    }
  } else if (status === 422) {
    code = "INVALID_MESSAGE";
  } else if (status === 429) {
    code = "RATE_LIMITED";
  } else if (status >= 500) {
    code = "PROVIDER_UNAVAILABLE";
  } else {
    code = "UNKNOWN";
  }

  return new PostboteError(message, {
    code,
    provider: PROVIDER,
    cause: { status, body },
  });
}

function isAbortError(err: unknown): boolean {
  return (
    typeof err === "object" &&
    err !== null &&
    "name" in err &&
    (err as { name: string }).name === "AbortError"
  );
}

export function toPostboteErrorFromFetchError(
  err: unknown,
  userSignal?: AbortSignal,
  internalSignal?: AbortSignal,
): PostboteError {
  if (userSignal?.aborted) {
    return new PostboteError("Send aborted", {
      code: "ABORTED",
      provider: PROVIDER,
      cause: err,
    });
  }

  if (isAbortError(err) || internalSignal?.aborted) {
    return new PostboteError("Request timed out", {
      code: "TIMEOUT",
      provider: PROVIDER,
      cause: err,
    });
  }

  const msg = err instanceof Error ? err.message : String(err);
  return new PostboteError(msg, {
    code: "PROVIDER_UNAVAILABLE",
    provider: PROVIDER,
    cause: err,
  });
}
