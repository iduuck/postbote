import { isPostboteError } from "@postbote/core";
import { describe, expect, it } from "vitest";
import { toPostboteErrorFromSdkError } from "./errors.js";

function makeSdkError(
  overrides: Partial<{ code: number; statusCode: number; message: string }>,
) {
  return {
    code: 0,
    statusCode: 0,
    message: "Error",
    ...overrides,
  };
}

describe("toPostboteErrorFromSdkError", () => {
  it("maps code 9 → RATE_LIMITED", () => {
    const err = toPostboteErrorFromSdkError(
      makeSdkError({ code: 9, message: "Rate limit exceeded" }),
    );
    expect(err.code).toBe("RATE_LIMITED");
    expect(err.retryable).toBe(true);
    expect(err.provider).toBe("postmark");
  });

  it("maps code 10 → AUTH", () => {
    const err = toPostboteErrorFromSdkError(
      makeSdkError({ code: 10, message: "Invalid API key" }),
    );
    expect(err.code).toBe("AUTH");
    expect(err.retryable).toBe(false);
  });

  it("maps code 300 → INVALID_MESSAGE", () => {
    const err = toPostboteErrorFromSdkError(
      makeSdkError({ code: 300, message: "Invalid email request" }),
    );
    expect(err.code).toBe("INVALID_MESSAGE");
    expect(err.retryable).toBe(false);
  });

  it("maps code 406 → RECIPIENT_REJECTED", () => {
    const err = toPostboteErrorFromSdkError(
      makeSdkError({ code: 406, message: "Inactive recipient" }),
    );
    expect(err.code).toBe("RECIPIENT_REJECTED");
    expect(err.retryable).toBe(false);
  });

  it("maps statusCode 401 → AUTH (fallback)", () => {
    const err = toPostboteErrorFromSdkError(
      makeSdkError({ code: 0, statusCode: 401, message: "Unauthorized" }),
    );
    expect(err.code).toBe("AUTH");
  });

  it("maps statusCode 403 → AUTH (fallback)", () => {
    const err = toPostboteErrorFromSdkError(
      makeSdkError({ code: 0, statusCode: 403, message: "Forbidden" }),
    );
    expect(err.code).toBe("AUTH");
  });

  it("maps statusCode 429 → RATE_LIMITED (fallback)", () => {
    const err = toPostboteErrorFromSdkError(
      makeSdkError({ code: 0, statusCode: 429, message: "Too many requests" }),
    );
    expect(err.code).toBe("RATE_LIMITED");
  });

  it("maps statusCode 500 → PROVIDER_UNAVAILABLE", () => {
    const err = toPostboteErrorFromSdkError(
      makeSdkError({ code: 0, statusCode: 500, message: "Internal error" }),
    );
    expect(err.code).toBe("PROVIDER_UNAVAILABLE");
    expect(err.retryable).toBe(true);
  });

  it("maps statusCode 503 → PROVIDER_UNAVAILABLE", () => {
    const err = toPostboteErrorFromSdkError(
      makeSdkError({ code: 0, statusCode: 503, message: "Unavailable" }),
    );
    expect(err.code).toBe("PROVIDER_UNAVAILABLE");
  });

  it("maps network error (no code/statusCode) → PROVIDER_UNAVAILABLE", () => {
    const err = toPostboteErrorFromSdkError(
      makeSdkError({ code: 0, statusCode: 0, message: "Network Error" }),
    );
    expect(err.code).toBe("PROVIDER_UNAVAILABLE");
    expect(err.retryable).toBe(true);
  });

  it("maps timeout message → TIMEOUT", () => {
    const err = toPostboteErrorFromSdkError(
      makeSdkError({
        code: 0,
        statusCode: 0,
        message: "timeout of 500ms exceeded",
      }),
    );
    expect(err.code).toBe("TIMEOUT");
    expect(err.retryable).toBe(true);
  });

  it("maps statusCode 422 + code 300 → INVALID_MESSAGE", () => {
    const err = toPostboteErrorFromSdkError(
      makeSdkError({ code: 300, statusCode: 422, message: "Invalid email" }),
    );
    expect(err.code).toBe("INVALID_MESSAGE");
  });

  it("maps statusCode 422 + code 406 → RECIPIENT_REJECTED", () => {
    const err = toPostboteErrorFromSdkError(
      makeSdkError({
        code: 406,
        statusCode: 422,
        message: "Inactive recipient",
      }),
    );
    expect(err.code).toBe("RECIPIENT_REJECTED");
  });

  it("maps unknown error → UNKNOWN", () => {
    const err = toPostboteErrorFromSdkError(
      makeSdkError({ code: 999, message: "Something weird" }),
    );
    expect(err.code).toBe("UNKNOWN");
    expect(err.retryable).toBe(false);
  });

  it("handles non-object error", () => {
    const err = toPostboteErrorFromSdkError("string error");
    expect(err.code).toBe("PROVIDER_UNAVAILABLE");
  });

  it("returns a PostboteError", () => {
    const err = toPostboteErrorFromSdkError(makeSdkError({ code: 10 }));
    expect(isPostboteError(err)).toBe(true);
  });

  it("includes original error in cause", () => {
    const sdkError = makeSdkError({ code: 9, message: "Slow down" });
    const err = toPostboteErrorFromSdkError(sdkError);
    expect(err.cause).toBe(sdkError);
  });
});
