import {
  type ErrorCode,
  httpStatusToErrorCode,
  PostboteError,
} from "@postbote/core";

const PROVIDER = "mailgun-http";

interface MailgunErrorBody {
  message?: string;
}

export function toMailgunResponseError(
  response: Response,
  body: unknown,
): PostboteError {
  const errorBody = body as MailgunErrorBody | undefined;
  const message = errorBody?.message ?? response.statusText;
  let code: ErrorCode;

  if (response.status === 401 || response.status === 403) {
    code = "AUTH";
  } else if (
    response.status === 400 &&
    /recipient|mailbox|address/i.test(message)
  ) {
    code = "RECIPIENT_REJECTED";
  } else if (response.status === 400) {
    code = "INVALID_MESSAGE";
  } else {
    code = httpStatusToErrorCode(response.status);
  }

  return new PostboteError(message, {
    code,
    provider: PROVIDER,
    cause: { status: response.status, body },
    retryAfterMs:
      code === "RATE_LIMITED" ? parseRetryAfter(response) : undefined,
  });
}

function parseRetryAfter(response: Response): number | undefined {
  const value = response.headers.get("retry-after");
  if (!value) return undefined;
  const seconds = Number(value);
  if (Number.isFinite(seconds)) return Math.max(0, seconds * 1000);
  const date = Date.parse(value);
  return Number.isNaN(date) ? undefined : Math.max(0, date - Date.now());
}

function isAbortError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "name" in error &&
    error.name === "AbortError"
  );
}

export function toMailgunFetchError(
  error: unknown,
  userSignal?: AbortSignal,
  internalSignal?: AbortSignal,
): PostboteError {
  if (userSignal?.aborted) {
    return new PostboteError("Send aborted", {
      code: "ABORTED",
      provider: PROVIDER,
      cause: error,
    });
  }
  if (isAbortError(error) || internalSignal?.aborted) {
    return new PostboteError("Request timed out", {
      code: "TIMEOUT",
      provider: PROVIDER,
      cause: error,
    });
  }
  return new PostboteError(
    error instanceof Error ? error.message : String(error),
    { code: "PROVIDER_UNAVAILABLE", provider: PROVIDER, cause: error },
  );
}
