import { describe, expect, it } from "vitest";
import { toSmtpError } from "./errors.js";

function smtpError(overrides: Record<string, unknown>) {
  return { message: "SMTP error", ...overrides };
}

describe("toSmtpError", () => {
  it.each([530, 534, 535])("maps %i to AUTH", (responseCode) => {
    expect(toSmtpError(smtpError({ responseCode })).code).toBe("AUTH");
  });

  it.each([550, 551, 553])("maps %i to RECIPIENT_REJECTED", (responseCode) => {
    expect(toSmtpError(smtpError({ responseCode })).code).toBe(
      "RECIPIENT_REJECTED",
    );
  });

  it("maps message size rejection to INVALID_MESSAGE", () => {
    expect(toSmtpError(smtpError({ responseCode: 552 })).code).toBe(
      "INVALID_MESSAGE",
    );
  });

  it("maps rejected 554 responses to INVALID_MESSAGE", () => {
    expect(
      toSmtpError(
        smtpError({ responseCode: 554, response: "Message rejected" }),
      ).code,
    ).toBe("INVALID_MESSAGE");
  });

  it.each([421, 451])("maps %i to PROVIDER_UNAVAILABLE", (responseCode) => {
    expect(toSmtpError(smtpError({ responseCode })).code).toBe(
      "PROVIDER_UNAVAILABLE",
    );
  });

  it.each([450, 452])("maps %i to RATE_LIMITED", (responseCode) => {
    const error = toSmtpError(smtpError({ responseCode }));
    expect(error.code).toBe("RATE_LIMITED");
    expect(error.retryable).toBe(true);
  });

  it.each([
    "EDNS",
    "ECONNREFUSED",
    "ECONNRESET",
    "ESOCKET",
  ])("maps %s to PROVIDER_UNAVAILABLE", (code) => {
    expect(toSmtpError(smtpError({ code })).code).toBe("PROVIDER_UNAVAILABLE");
  });

  it.each([
    { code: "ETIMEDOUT" },
    { message: "Connection timeout" },
    { message: "Greeting timeout" },
  ])("maps timeout errors to TIMEOUT", (overrides) => {
    expect(toSmtpError(smtpError(overrides)).code).toBe("TIMEOUT");
  });

  it("maps unknown errors to UNKNOWN", () => {
    expect(toSmtpError(smtpError({ code: "EOTHER" })).code).toBe("UNKNOWN");
  });

  it("retains only safe SMTP response fields in cause", () => {
    const error = toSmtpError(
      smtpError({
        responseCode: 535,
        response: "Invalid credentials",
        command: "AUTH PLAIN",
        password: "secret",
      }),
    );

    expect(error.cause).toEqual({
      responseCode: 535,
      response: "Invalid credentials",
      command: "AUTH PLAIN",
    });
  });

  it("redacts a configured secret from its message", () => {
    const error = toSmtpError(
      smtpError({ message: "Authentication failed for secret" }),
      "secret",
    );

    expect(error.message).not.toContain("secret");
  });
});
