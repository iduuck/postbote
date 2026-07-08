import type { ErrorCode } from "@postbote/core";
import { PostboteError } from "@postbote/core";

const PROVIDER = "resend";

export interface SdkError {
  name: string;
  message: string;
}

export function toPostboteErrorFromSdkError(error: SdkError): PostboteError {
  const { name, message } = error;

  let code: ErrorCode;

  switch (name) {
    case "unauthorized":
    case "forbidden":
      code = "AUTH";
      break;
    case "validation_error":
      code = "INVALID_MESSAGE";
      break;
    case "rate_limit_exceeded":
      code = "RATE_LIMITED";
      break;
    case "application_error":
    case "internal_server_error":
      code = "PROVIDER_UNAVAILABLE";
      break;
    default:
      code = "UNKNOWN";
  }

  return new PostboteError(message, {
    code,
    provider: PROVIDER,
    cause: error,
  });
}
