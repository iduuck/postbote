import { describe, expect, it } from "vitest";
import { isPostboteError, PostboteError, toPostboteError } from "./errors.js";

describe("PostboteError", () => {
  it("sets retryable defaults per code", () => {
    const auth = new PostboteError("x", { code: "AUTH", provider: "p" });
    expect(auth.retryable).toBe(false);

    const rate = new PostboteError("x", {
      code: "RATE_LIMITED",
      provider: "p",
    });
    expect(rate.retryable).toBe(true);

    const unavailable = new PostboteError("x", {
      code: "PROVIDER_UNAVAILABLE",
      provider: "p",
    });
    expect(unavailable.retryable).toBe(true);

    const timeout = new PostboteError("x", { code: "TIMEOUT", provider: "p" });
    expect(timeout.retryable).toBe(true);

    const invalid = new PostboteError("x", {
      code: "INVALID_MESSAGE",
      provider: "p",
    });
    expect(invalid.retryable).toBe(false);

    const rejected = new PostboteError("x", {
      code: "RECIPIENT_REJECTED",
      provider: "p",
    });
    expect(rejected.retryable).toBe(false);

    const unknown = new PostboteError("x", { code: "UNKNOWN", provider: "p" });
    expect(unknown.retryable).toBe(false);

    const aborted = new PostboteError("x", { code: "ABORTED", provider: "p" });
    expect(aborted.retryable).toBe(false);
  });

  it("ABORTED code is not retryable", () => {
    const err = new PostboteError("aborted", {
      code: "ABORTED",
      provider: "p",
    });
    expect(err.retryable).toBe(false);
  });

  it("explicit retryable overrides default", () => {
    const err = new PostboteError("x", {
      code: "RATE_LIMITED",
      provider: "p",
      retryable: false,
    });
    expect(err.retryable).toBe(false);
  });

  it("sets code, provider, message", () => {
    const err = new PostboteError("test message", {
      code: "AUTH",
      provider: "my-provider",
    });
    expect(err.code).toBe("AUTH");
    expect(err.provider).toBe("my-provider");
    expect(err.message).toBe("test message");
  });

  it("sets cause when provided", () => {
    const cause = new Error("root");
    const err = new PostboteError("x", {
      code: "UNKNOWN",
      provider: "p",
      cause,
    });
    expect(err.cause).toBe(cause);
  });

  it("passes cause to native Error.cause", () => {
    const cause = new Error("root");
    const err = new PostboteError("x", {
      code: "TIMEOUT",
      provider: "p",
      cause,
    });
    expect(err.cause).toBe(cause);
  });
});

describe("toPostboteError", () => {
  it("wraps a plain Error as UNKNOWN", () => {
    const err = toPostboteError(new Error("something broke"), "test-provider");
    expect(err.code).toBe("UNKNOWN");
    expect(err.retryable).toBe(false);
    expect(err.provider).toBe("test-provider");
    expect(err.cause).toBeInstanceOf(Error);
  });

  it("wraps a string value", () => {
    const err = toPostboteError("string error", "p");
    expect(err.code).toBe("UNKNOWN");
    expect(err.message).toBe("string error");
  });

  it("passes through an existing PostboteError unchanged", () => {
    const original = new PostboteError("x", { code: "AUTH", provider: "p" });
    const result = toPostboteError(original, "other-provider");
    expect(result).toBe(original);
    expect(result.provider).toBe("p");
  });
});

describe("isPostboteError", () => {
  it("returns true for PostboteError", () => {
    const err = new PostboteError("x", { code: "AUTH", provider: "p" });
    expect(isPostboteError(err)).toBe(true);
  });

  it("returns false for regular Error", () => {
    expect(isPostboteError(new Error("x"))).toBe(false);
  });

  it("returns false for null/undefined/primitives", () => {
    expect(isPostboteError(null)).toBe(false);
    expect(isPostboteError(undefined)).toBe(false);
    expect(isPostboteError("string")).toBe(false);
    expect(isPostboteError(42)).toBe(false);
  });

  it("detects foreign instance with Brand symbol (module duplicate simulation)", () => {
    const foreign = { [Symbol.for("postbote.error")]: true, code: "AUTH" };
    expect(isPostboteError(foreign)).toBe(true);
  });

  it("does not false-positive on objects without the brand", () => {
    expect(isPostboteError({ code: "AUTH" })).toBe(false);
  });
});
