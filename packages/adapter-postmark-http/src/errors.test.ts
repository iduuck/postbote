import { isPostboteError } from "@postbote/core";
import { describe, expect, it } from "vitest";
import {
  toPostboteErrorFromFetchError,
  toPostboteErrorFromResponse,
} from "./errors.js";

function makeResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    statusText: status === 200 ? "OK" : "Error",
    headers: { "content-type": "application/json" },
  });
}

describe("toPostboteErrorFromResponse", () => {
  it("maps 401 → AUTH", () => {
    const res = makeResponse(401, { Message: "Unauthorized", ErrorCode: 10 });
    const err = toPostboteErrorFromResponse(res, {
      Message: "Unauthorized",
      ErrorCode: 10,
    });
    expect(err.code).toBe("AUTH");
    expect(err.retryable).toBe(false);
    expect(err.provider).toBe("postmark-http");
  });

  it("maps ErrorCode 10 on non-401 → AUTH", () => {
    const res = makeResponse(500, { Message: "Bad token", ErrorCode: 10 });
    const err = toPostboteErrorFromResponse(res, {
      Message: "Bad token",
      ErrorCode: 10,
    });
    expect(err.code).toBe("AUTH");
  });

  it("maps 422 + ErrorCode 300 → INVALID_MESSAGE", () => {
    const res = makeResponse(422, {
      Message: "Invalid email",
      ErrorCode: 300,
    });
    const err = toPostboteErrorFromResponse(res, {
      Message: "Invalid email",
      ErrorCode: 300,
    });
    expect(err.code).toBe("INVALID_MESSAGE");
    expect(err.retryable).toBe(false);
  });

  it("maps 422 + ErrorCode 406 → RECIPIENT_REJECTED", () => {
    const res = makeResponse(422, {
      Message: "Inactive recipient",
      ErrorCode: 406,
    });
    const err = toPostboteErrorFromResponse(res, {
      Message: "Inactive recipient",
      ErrorCode: 406,
    });
    expect(err.code).toBe("RECIPIENT_REJECTED");
    expect(err.retryable).toBe(false);
  });

  it("maps 422 + ErrorCode 300 with 'recipient' in message → RECIPIENT_REJECTED", () => {
    const res = makeResponse(422, {
      Message: "The recipient a@b.com is not allowed",
      ErrorCode: 300,
    });
    const err = toPostboteErrorFromResponse(res, {
      Message: "The recipient a@b.com is not allowed",
      ErrorCode: 300,
    });
    expect(err.code).toBe("RECIPIENT_REJECTED");
  });

  it("maps 429 → RATE_LIMITED", () => {
    const res = makeResponse(429, { Message: "Too many requests" });
    const err = toPostboteErrorFromResponse(res, {
      Message: "Too many requests",
    });
    expect(err.code).toBe("RATE_LIMITED");
    expect(err.retryable).toBe(true);
  });

  it("maps 500 → PROVIDER_UNAVAILABLE", () => {
    const res = makeResponse(500, { Message: "Internal error" });
    const err = toPostboteErrorFromResponse(res, { Message: "Internal error" });
    expect(err.code).toBe("PROVIDER_UNAVAILABLE");
    expect(err.retryable).toBe(true);
  });

  it("maps 503 → PROVIDER_UNAVAILABLE", () => {
    const res = makeResponse(503, { Message: "Service unavailable" });
    const err = toPostboteErrorFromResponse(res, {
      Message: "Service unavailable",
    });
    expect(err.code).toBe("PROVIDER_UNAVAILABLE");
  });

  it("maps unknown status → UNKNOWN", () => {
    const res = makeResponse(418, { Message: "I'm a teapot" });
    const err = toPostboteErrorFromResponse(res, { Message: "I'm a teapot" });
    expect(err.code).toBe("UNKNOWN");
    expect(err.retryable).toBe(false);
  });

  it("includes response status and body in cause", () => {
    const res = makeResponse(401, {
      Message: "Unauthorized",
      ErrorCode: 10,
    });
    const err = toPostboteErrorFromResponse(res, {
      Message: "Unauthorized",
      ErrorCode: 10,
    });
    expect(err.cause).toBeDefined();
    const cause = err.cause as { status: number; body: unknown };
    expect(cause.status).toBe(401);
  });

  it("maps 422 without ErrorCode → INVALID_MESSAGE", () => {
    const res = makeResponse(422, { Message: "Some error" });
    const err = toPostboteErrorFromResponse(res, { Message: "Some error" });
    expect(err.code).toBe("INVALID_MESSAGE");
  });
});

describe("toPostboteErrorFromFetchError", () => {
  it("maps DOMException AbortError with user signal → ABORTED", () => {
    const ac = new AbortController();
    ac.abort();
    const err = new DOMException("Aborted", "AbortError");
    const result = toPostboteErrorFromFetchError(err, ac.signal);
    expect(result.code).toBe("ABORTED");
    expect(result.retryable).toBe(false);
  });

  it("maps DOMException AbortError without user signal → TIMEOUT", () => {
    const err = new DOMException("The operation was aborted", "AbortError");
    const result = toPostboteErrorFromFetchError(err);
    expect(result.code).toBe("TIMEOUT");
    expect(result.retryable).toBe(true);
  });

  it("maps Type Error → PROVIDER_UNAVAILABLE", () => {
    const err = new TypeError("fetch failed");
    const result = toPostboteErrorFromFetchError(err);
    expect(result.code).toBe("PROVIDER_UNAVAILABLE");
    expect(result.provider).toBe("postmark-http");
    expect(result.cause).toBe(err);
  });

  it("maps string error → PROVIDER_UNAVAILABLE", () => {
    const result = toPostboteErrorFromFetchError("network error");
    expect(result.code).toBe("PROVIDER_UNAVAILABLE");
  });

  it("returns a PostboteError", () => {
    const err = new Error("network error");
    const result = toPostboteErrorFromFetchError(err);
    expect(isPostboteError(result)).toBe(true);
  });
});
