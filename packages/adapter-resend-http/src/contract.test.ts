import type { FailureKind } from "@postbote/adapter-contract";
import { runAdapterContractTests } from "@postbote/adapter-contract";
import { delay, HttpResponse, http } from "msw";
import { setupServer } from "msw/node";
import { afterAll, afterEach, beforeAll } from "vitest";
import { resendHttp } from "./adapter.js";

const API_BASE = "https://api.resend.com";

interface MockState {
  status: number;
  body: Record<string, unknown>;
  delayMs: number;
  networkError?: boolean;
}

let state: MockState = { status: 200, body: { id: "default-id" }, delayMs: 0 };

const handlers = [
  http.post(`${API_BASE}/emails`, async () => {
    if (state.networkError) {
      return HttpResponse.error();
    }
    if (state.delayMs > 0) {
      await delay(state.delayMs);
    }
    return HttpResponse.json(state.body, { status: state.status });
  }),
];

const server = setupServer(...handlers);

function getFailureResponse(kind: FailureKind): MockState {
  switch (kind) {
    case "auth":
      return {
        status: 401,
        body: { name: "unauthorized", message: "Unauthorized" },
        delayMs: 0,
      };
    case "rateLimited":
      return {
        status: 429,
        body: { name: "rate_limit_exceeded", message: "Too many requests" },
        delayMs: 0,
      };
    case "unavailable":
      return {
        status: 500,
        body: { name: "application_error", message: "Internal server error" },
        delayMs: 0,
      };
    case "timeout":
      return { status: 200, body: { id: "too-slow" }, delayMs: 10_000 };
    case "invalidMessage":
      return {
        status: 422,
        body: { name: "validation_error", message: "Validation failed" },
        delayMs: 0,
      };
    case "recipientRejected":
      return {
        status: 422,
        body: { name: "recipient_rejected", message: "Recipient rejected" },
        delayMs: 0,
      };
    case "networkError":
      return {
        status: 0,
        body: {},
        delayMs: 0,
        networkError: true,
      };
  }
}

runAdapterContractTests({
  name: "resend-http",
  createAdapter: () =>
    resendHttp({
      apiKey: "re_test_123456789",
      baseUrl: API_BASE,
      timeoutMs: 500,
    }),
  interceptor: {
    success(messageId: string) {
      state = { status: 200, body: { id: messageId }, delayMs: 0 };
    },
    failure(kind: FailureKind) {
      state = getFailureResponse(kind);
    },
    reset() {
      state = { status: 200, body: { id: "reset-id" }, delayMs: 0 };
    },
  },
  secret: "re_test_123456789",
  skip: ["recipientRejected"],
});

beforeAll(() => {
  server.listen({ onUnhandledRequest: "error" });
});

afterAll(() => {
  server.close();
});

afterEach(() => {
  server.resetHandlers();
});
