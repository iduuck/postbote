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
    const res = makeResponse(401, {
      errors: [{ field: "authorization", message: "Unauthorized" }],
    });
    const err = toPostboteErrorFromResponse(res, {
      errors: [{ field: "authorization", message: "Unauthorized" }],
    });
    expect(err.code).toBe("AUTH");
    expect(err.retryable).toBe(false);
    expect(err.provider).toBe("sendgrid-http");
  });

  it("maps 403 → AUTH", () => {
    const res = makeResponse(403, {
      errors: [{ message: "Forbidden" }],
    });
    const err = toPostboteErrorFromResponse(res, {
      errors: [{ message: "Forbidden" }],
    });
    expect(err.code).toBe("AUTH");
  });

  it("maps 400 → INVALID_MESSAGE", () => {
    const res = makeResponse(400, {
      errors: [{ field: "subject", message: "Invalid subject" }],
    });
    const err = toPostboteErrorFromResponse(res, {
      errors: [{ field: "subject", message: "Invalid subject" }],
    });
    expect(err.code).toBe("INVALID_MESSAGE");
    expect(err.retryable).toBe(false);
  });

  it("maps 413 → INVALID_MESSAGE", () => {
    const res = makeResponse(413, {});
    const err = toPostboteErrorFromResponse(res, {});
    expect(err.code).toBe("INVALID_MESSAGE");
  });

  it("maps 429 → RATE_LIMITED", () => {
    const res = makeResponse(429, {
      errors: [{ message: "Too many requests" }],
    });
    const err = toPostboteErrorFromResponse(res, {
      errors: [{ message: "Too many requests" }],
    });
    expect(err.code).toBe("RATE_LIMITED");
    expect(err.retryable).toBe(true);
  });

  it("maps 500 → PROVIDER_UNAVAILABLE", () => {
    const res = makeResponse(500, {
      errors: [{ message: "Internal error" }],
    });
    const err = toPostboteErrorFromResponse(res, {
      errors: [{ message: "Internal error" }],
    });
    expect(err.code).toBe("PROVIDER_UNAVAILABLE");
    expect(err.retryable).toBe(true);
  });

  it("maps 503 → PROVIDER_UNAVAILABLE", () => {
    const res = makeResponse(503, {
      errors: [{ message: "Service unavailable" }],
    });
    const err = toPostboteErrorFromResponse(res, {
      errors: [{ message: "Service unavailable" }],
    });
    expect(err.code).toBe("PROVIDER_UNAVAILABLE");
  });

  it("maps unknown status → UNKNOWN", () => {
    const res = makeResponse(418, {});
    const err = toPostboteErrorFromResponse(res, {});
    expect(err.code).toBe("UNKNOWN");
    expect(err.retryable).toBe(false);
  });

  it("includes response status and body in cause", () => {
    const res = makeResponse(401, {
      errors: [{ message: "Unauthorized" }],
    });
    const err = toPostboteErrorFromResponse(res, {
      errors: [{ message: "Unauthorized" }],
    });
    expect(err.cause).toBeDefined();
    const cause = err.cause as { status: number; body: unknown };
    expect(cause.status).toBe(401);
  });

  it("extracts first error message from body", () => {
    const res = makeResponse(400, {
      errors: [
        { field: "to", message: "Invalid recipient" },
        { field: "subject", message: "Invalid subject" },
      ],
    });
    const err = toPostboteErrorFromResponse(res, {
      errors: [
        { field: "to", message: "Invalid recipient" },
        { field: "subject", message: "Invalid subject" },
      ],
    });
    expect(err.message).toBe("Invalid recipient");
  });

  it("falls back to statusText when body has no errors", () => {
    const res = new Response(null, { status: 400, statusText: "Bad Request" });
    const err = toPostboteErrorFromResponse(res, undefined);
    expect(err.message).toBe("Bad Request");
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

  it("maps TypeError → PROVIDER_UNAVAILABLE", () => {
    const err = new TypeError("fetch failed");
    const result = toPostboteErrorFromFetchError(err);
    expect(result.code).toBe("PROVIDER_UNAVAILABLE");
    expect(result.provider).toBe("sendgrid-http");
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
