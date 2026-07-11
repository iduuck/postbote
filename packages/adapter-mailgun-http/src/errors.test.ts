import { describe, expect, it } from "vitest";
import { toMailgunFetchError, toMailgunResponseError } from "./errors.js";

function response(
  status: number,
  body: unknown,
  headers?: HeadersInit,
): Response {
  return new Response(JSON.stringify(body), {
    status,
    statusText: "Error",
    headers,
  });
}

describe("toMailgunResponseError", () => {
  it.each([401, 403])("maps %i to AUTH", (status) => {
    expect(
      toMailgunResponseError(response(status, { message: "Denied" }), {}).code,
    ).toBe("AUTH");
  });

  it("maps recipient validation errors to RECIPIENT_REJECTED", () => {
    expect(
      toMailgunResponseError(
        response(400, { message: "Recipient address is invalid" }),
        {
          message: "Recipient address is invalid",
        },
      ).code,
    ).toBe("RECIPIENT_REJECTED");
  });

  it("maps other client errors to INVALID_MESSAGE", () => {
    expect(
      toMailgunResponseError(response(400, { message: "Invalid subject" }), {})
        .code,
    ).toBe("INVALID_MESSAGE");
  });

  it("maps 429 to RATE_LIMITED and parses Retry-After", () => {
    const error = toMailgunResponseError(
      response(429, { message: "Slow down" }, { "Retry-After": "7" }),
      { message: "Slow down" },
    );

    expect(error).toMatchObject({ code: "RATE_LIMITED", retryAfterMs: 7_000 });
  });

  it("maps 5xx responses to PROVIDER_UNAVAILABLE", () => {
    expect(
      toMailgunResponseError(response(500, { message: "Down" }), {}).code,
    ).toBe("PROVIDER_UNAVAILABLE");
  });
});

describe("toMailgunFetchError", () => {
  it("maps an aborted user signal to ABORTED", () => {
    const controller = new AbortController();
    controller.abort();

    expect(
      toMailgunFetchError(
        new DOMException("Aborted", "AbortError"),
        controller.signal,
      ).code,
    ).toBe("ABORTED");
  });

  it("maps timeout aborts to TIMEOUT", () => {
    const timeout = AbortSignal.abort();

    expect(
      toMailgunFetchError(
        new DOMException("Aborted", "AbortError"),
        undefined,
        timeout,
      ).code,
    ).toBe("TIMEOUT");
  });

  it("maps network errors to PROVIDER_UNAVAILABLE", () => {
    expect(toMailgunFetchError(new Error("ECONNREFUSED")).code).toBe(
      "PROVIDER_UNAVAILABLE",
    );
  });
});
