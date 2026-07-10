import { defineAdapter, type ErrorCode, PostboteError } from "@postbote/core";
import { describe } from "vitest";
import type { FailureKind } from "./suite.js";
import { runAdapterContractTests } from "./suite.js";

describe("defineAdapter contract", () => {
  let failure: FailureKind | undefined;
  let messageId = "test-id";
  const codes: Record<FailureKind, ErrorCode> = {
    auth: "AUTH",
    rateLimited: "RATE_LIMITED",
    unavailable: "PROVIDER_UNAVAILABLE",
    timeout: "TIMEOUT",
    invalidMessage: "INVALID_MESSAGE",
    recipientRejected: "RECIPIENT_REJECTED",
    networkError: "PROVIDER_UNAVAILABLE",
  };

  runAdapterContractTests({
    name: "define-adapter",
    createAdapter: () =>
      defineAdapter({
        name: "define-adapter",
        mapUnknownError: () => "PROVIDER_UNAVAILABLE",
        async send() {
          if (failure === "networkError") throw new Error("network failed");
          if (failure) {
            throw new PostboteError(`Simulated: ${failure}`, {
              code: codes[failure],
              provider: "define-adapter",
              cause: { failure },
            });
          }
          return { messageId, raw: { messageId } };
        },
      }),
    interceptor: {
      success(id) {
        messageId = id;
      },
      failure(kind) {
        failure = kind;
      },
      reset() {
        failure = undefined;
        messageId = "test-id";
      },
    },
  });
});
