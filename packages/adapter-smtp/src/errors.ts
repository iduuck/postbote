import type { ErrorCode } from "@postbote/core";
import { PostboteError } from "@postbote/core";

const PROVIDER = "smtp";

export interface SmtpError {
  message?: string;
  code?: string;
  command?: string;
  response?: string;
  responseCode?: number;
}

function errorCode(error: SmtpError): ErrorCode {
  if ([530, 534, 535].includes(error.responseCode ?? 0)) return "AUTH";
  if ([550, 551, 553].includes(error.responseCode ?? 0)) {
    return "RECIPIENT_REJECTED";
  }
  if (
    error.responseCode === 552 ||
    (error.responseCode === 554 &&
      /message rejected/i.test(error.response ?? ""))
  ) {
    return "INVALID_MESSAGE";
  }
  if ([421, 451].includes(error.responseCode ?? 0)) {
    return "PROVIDER_UNAVAILABLE";
  }
  if ([450, 452].includes(error.responseCode ?? 0)) return "RATE_LIMITED";
  if (
    ["EDNS", "ECONNREFUSED", "ECONNRESET", "ESOCKET"].includes(error.code ?? "")
  ) {
    return "PROVIDER_UNAVAILABLE";
  }
  if (
    error.code === "ETIMEDOUT" ||
    /(?:connection|greeting|socket)?\s*timeout/i.test(error.message ?? "")
  ) {
    return "TIMEOUT";
  }
  return "UNKNOWN";
}

function redact(message: string, secret?: string): string {
  return secret ? message.replaceAll(secret, "[REDACTED]") : message;
}

export function toSmtpError(error: unknown, secret?: string): PostboteError {
  const smtpError =
    typeof error === "object" && error !== null
      ? (error as SmtpError)
      : { message: String(error) };
  const message = redact(smtpError.message ?? "SMTP send failed", secret);

  return new PostboteError(message, {
    code: errorCode(smtpError),
    provider: PROVIDER,
    // Nodemailer errors can carry connection details. Keep only SMTP response data.
    cause: {
      responseCode: smtpError.responseCode,
      response: smtpError.response,
      command: smtpError.command,
    },
  });
}
