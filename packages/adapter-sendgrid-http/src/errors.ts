import type { ErrorCode } from "@postbote/core";
import { PostboteError } from "@postbote/core";

const PROVIDER = "sendgrid-http";

interface SendGridErrorBody {
  errors?: Array<{ field?: string; message?: string }>;
}

export function toPostboteErrorFromResponse(
  response: Response,
  body: unknown,
): PostboteError {
  const status = response.status;
  const errorBody = body as SendGridErrorBody | undefined;

  let code: ErrorCode;

  if (status === 401 || status === 403) {
    code = "AUTH";
  } else if (status === 413) {
    code = "INVALID_MESSAGE";
  } else if (status === 400) {
    code = "INVALID_MESSAGE";
  } else if (status === 429) {
    code = "RATE_LIMITED";
  } else if (status >= 500) {
    code = "PROVIDER_UNAVAILABLE";
  } else {
    code = "UNKNOWN";
  }

  const firstMessage = errorBody?.errors?.[0]?.message ?? response.statusText;

  return new PostboteError(firstMessage, {
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

  const message = err instanceof Error ? err.message : String(err);
  return new PostboteError(message, {
    code: "PROVIDER_UNAVAILABLE",
    provider: PROVIDER,
    cause: err,
  });
}
