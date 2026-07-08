import { isPostboteError } from "@postbote/core";
import { describe, expect, it } from "vitest";
import { toPostboteErrorFromSdkError } from "./errors.js";

class MockError extends Error {
  code?: number;

  constructor(message: string, code?: number) {
    super(message);
    this.name = "ResponseError";
    this.code = code;
  }
}

describe("toPostboteErrorFromSdkError", () => {
  it("maps 401 → AUTH", () => {
    const err = toPostboteErrorFromSdkError(new MockError("Unauthorized", 401));
    expect(err.code).toBe("AUTH");
    expect(err.retryable).toBe(false);
    expect(err.provider).toBe("sendgrid");
  });

  it("maps 403 → AUTH", () => {
    const err = toPostboteErrorFromSdkError(new MockError("Forbidden", 403));
    expect(err.code).toBe("AUTH");
    expect(err.retryable).toBe(false);
  });

  it("maps 400 → INVALID_MESSAGE", () => {
    const err = new MockError("Bad Request", 400);
    const result = toPostboteErrorFromSdkError(err);
    expect(result.code).toBe("INVALID_MESSAGE");
    expect(result.retryable).toBe(false);
  });

  it("maps 413 → INVALID_MESSAGE", () => {
    const err = new MockError("Payload too large", 413);
    const result = toPostboteErrorFromSdkError(err);
    expect(result.code).toBe("INVALID_MESSAGE");
  });

  it("maps 429 → RATE_LIMITED", () => {
    const err = toPostboteErrorFromSdkError(
      new MockError("Rate limit exceeded", 429),
    );
    expect(err.code).toBe("RATE_LIMITED");
    expect(err.retryable).toBe(true);
  });

  it("maps 500 → PROVIDER_UNAVAILABLE", () => {
    const err = toPostboteErrorFromSdkError(
      new MockError("Internal error", 500),
    );
    expect(err.code).toBe("PROVIDER_UNAVAILABLE");
    expect(err.retryable).toBe(true);
  });

  it("maps 503 → PROVIDER_UNAVAILABLE", () => {
    const err = toPostboteErrorFromSdkError(
      new MockError("Service unavailable", 503),
    );
    expect(err.code).toBe("PROVIDER_UNAVAILABLE");
    expect(err.retryable).toBe(true);
  });

  it("maps generic Error without code → PROVIDER_UNAVAILABLE", () => {
    const err = toPostboteErrorFromSdkError(new Error("ECONNREFUSED connect"));
    expect(err.code).toBe("PROVIDER_UNAVAILABLE");
    expect(err.retryable).toBe(true);
  });

  it("maps timeout message → TIMEOUT", () => {
    const err = toPostboteErrorFromSdkError(new Error("Connection timeout"));
    expect(err.code).toBe("TIMEOUT");
    expect(err.retryable).toBe(true);
  });

  it("maps unknown HTTP status → UNKNOWN", () => {
    const err = toPostboteErrorFromSdkError(new MockError("Teapot", 418));
    expect(err.code).toBe("UNKNOWN");
    expect(err.retryable).toBe(false);
  });

  it("handles non-Error input", () => {
    const err = toPostboteErrorFromSdkError("string error");
    expect(err.code).toBe("PROVIDER_UNAVAILABLE");
    expect(err.provider).toBe("sendgrid");
  });

  it("returns a PostboteError", () => {
    const err = toPostboteErrorFromSdkError(new MockError("fail", 400));
    expect(isPostboteError(err)).toBe(true);
  });
});
