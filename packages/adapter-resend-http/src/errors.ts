import { httpStatusToErrorCode, PostboteError } from "@postbote/core";

const PROVIDER = "resend-http";

interface ResendErrorBody {
  message?: string;
  statusCode?: number;
}

export function toPostboteErrorFromResponse(
  response: Response,
  body: unknown,
): PostboteError {
  const status = response.status;
  const errorBody = body as ResendErrorBody | undefined;
  const message = errorBody?.message ?? response.statusText;
  const code = httpStatusToErrorCode(status);

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

  const message = err instanceof Error ? err.message : String(err);
  return new PostboteError(message, {
    code: "PROVIDER_UNAVAILABLE",
    provider: PROVIDER,
    cause: err,
  });
}
