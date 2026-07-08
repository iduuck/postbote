import { isPostboteError } from "@postbote/core";
import { describe, expect, it } from "vitest";
import { toPostboteErrorFromSdkError } from "./errors.js";

describe("toPostboteErrorFromSdkError", () => {
  it("maps unauthorized → AUTH", () => {
    const err = toPostboteErrorFromSdkError({
      name: "unauthorized",
      message: "Invalid API key",
    });
    expect(err.code).toBe("AUTH");
    expect(err.retryable).toBe(false);
    expect(err.provider).toBe("resend");
  });

  it("maps forbidden → AUTH", () => {
    const err = toPostboteErrorFromSdkError({
      name: "forbidden",
      message: "Access denied",
    });
    expect(err.code).toBe("AUTH");
  });

  it("maps validation_error → INVALID_MESSAGE", () => {
    const err = toPostboteErrorFromSdkError({
      name: "validation_error",
      message: "Invalid 'to' field",
    });
    expect(err.code).toBe("INVALID_MESSAGE");
    expect(err.retryable).toBe(false);
  });

  it("maps rate_limit_exceeded → RATE_LIMITED", () => {
    const err = toPostboteErrorFromSdkError({
      name: "rate_limit_exceeded",
      message: "Rate limit exceeded",
    });
    expect(err.code).toBe("RATE_LIMITED");
    expect(err.retryable).toBe(true);
  });

  it("maps application_error → PROVIDER_UNAVAILABLE", () => {
    const err = toPostboteErrorFromSdkError({
      name: "application_error",
      message: "Something went wrong",
    });
    expect(err.code).toBe("PROVIDER_UNAVAILABLE");
    expect(err.retryable).toBe(true);
  });

  it("maps internal_server_error → PROVIDER_UNAVAILABLE", () => {
    const err = toPostboteErrorFromSdkError({
      name: "internal_server_error",
      message: "Internal error",
    });
    expect(err.code).toBe("PROVIDER_UNAVAILABLE");
  });

  it("maps unknown error name → UNKNOWN", () => {
    const err = toPostboteErrorFromSdkError({
      name: "some_unknown_error",
      message: "Something weird",
    });
    expect(err.code).toBe("UNKNOWN");
    expect(err.retryable).toBe(false);
  });

  it("includes error object in cause", () => {
    const sdkError = { name: "rate_limit_exceeded", message: "Slow down" };
    const err = toPostboteErrorFromSdkError(sdkError);
    expect(err.cause).toBe(sdkError);
  });

  it("returns a PostboteError", () => {
    const err = toPostboteErrorFromSdkError({
      name: "validation_error",
      message: "Bad request",
    });
    expect(isPostboteError(err)).toBe(true);
  });
});
