const BRAND = Symbol.for("postbote.error");

export type ErrorCode =
  | "ABORTED"
  | "AUTH"
  | "CANCELLED"
  | "INVALID_MESSAGE"
  | "RECIPIENT_REJECTED"
  | "RATE_LIMITED"
  | "PROVIDER_UNAVAILABLE"
  | "TIMEOUT"
  | "UNKNOWN";

const DEFAULT_RETRYABLE: Record<ErrorCode, boolean> = {
  ABORTED: false,
  AUTH: false,
  CANCELLED: false,
  INVALID_MESSAGE: false,
  RECIPIENT_REJECTED: false,
  RATE_LIMITED: true,
  PROVIDER_UNAVAILABLE: true,
  TIMEOUT: true,
  UNKNOWN: false,
};

export class PostboteError extends Error {
  readonly [BRAND] = true as const;
  readonly code: ErrorCode;
  readonly retryable: boolean;
  readonly provider: string;
  readonly cause?: unknown;

  constructor(
    message: string,
    opts: {
      code: ErrorCode;
      provider: string;
      retryable?: boolean;
      cause?: unknown;
    },
  ) {
    super(message, { cause: opts.cause });
    this.name = "PostboteError";
    this.code = opts.code;
    this.provider = opts.provider;
    this.retryable = opts.retryable ?? DEFAULT_RETRYABLE[opts.code];
    this.cause = opts.cause;
  }
}

export function toPostboteError(err: unknown, provider: string): PostboteError {
  if (isPostboteError(err)) {
    return err;
  }
  const message = err instanceof Error ? err.message : String(err);
  return new PostboteError(message, {
    code: "UNKNOWN",
    provider,
    cause: err,
  });
}

export function isPostboteError(err: unknown): err is PostboteError {
  return typeof err === "object" && err !== null && BRAND in err;
}
