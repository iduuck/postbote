import type { FailureKind } from "@postbote/adapter-contract";
import { runAdapterContractTests } from "@postbote/adapter-contract";
import { delay, HttpResponse, http } from "msw";
import { setupServer } from "msw/node";
import { afterAll, afterEach, beforeAll } from "vitest";
import { postmark } from "./adapter.js";

const API_BASE = "https://api.postmarkapp.com";

interface MockState {
  status: number;
  body: Record<string, unknown>;
  delayMs: number;
  networkError?: boolean;
}

let state: MockState = {
  status: 200,
  body: {
    MessageID: "default-id",
    To: "recipient@example.com",
    SubmittedAt: "2024-01-01T00:00:00Z",
    ErrorCode: 0,
    Message: "OK",
  },
  delayMs: 0,
};

const handlers = [
  http.post(`${API_BASE}/email`, async () => {
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
        body: { ErrorCode: 10, Message: "Invalid API key" },
        delayMs: 0,
      };
    case "rateLimited":
      return {
        status: 429,
        body: { ErrorCode: 9, Message: "Rate limit exceeded" },
        delayMs: 0,
      };
    case "unavailable":
      return {
        status: 500,
        body: { ErrorCode: 0, Message: "Internal server error" },
        delayMs: 0,
      };
    case "timeout":
      return {
        status: 200,
        body: {
          MessageID: "too-slow",
          To: "recipient@example.com",
          SubmittedAt: "2024-01-01T00:00:00Z",
          ErrorCode: 0,
          Message: "OK",
        },
        delayMs: 10_000,
      };
    case "invalidMessage":
      return {
        status: 422,
        body: { ErrorCode: 300, Message: "Invalid email request" },
        delayMs: 0,
      };
    case "recipientRejected":
      return {
        status: 422,
        body: { ErrorCode: 406, Message: "Inactive recipient" },
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
  name: "postmark",
  createAdapter: () =>
    postmark({
      serverToken: "pma_test_123456789",
      timeoutMs: 500,
    }),
  interceptor: {
    success(messageId: string) {
      state = {
        status: 200,
        body: {
          MessageID: messageId,
          To: "recipient@example.com",
          SubmittedAt: "2024-01-01T00:00:00Z",
          ErrorCode: 0,
          Message: "OK",
        },
        delayMs: 0,
      };
    },
    failure(kind: FailureKind) {
      state = getFailureResponse(kind);
    },
    reset() {
      state = {
        status: 200,
        body: {
          MessageID: "reset-id",
          To: "recipient@example.com",
          SubmittedAt: "2024-01-01T00:00:00Z",
          ErrorCode: 0,
          Message: "OK",
        },
        delayMs: 0,
      };
    },
  },
  secret: "pma_test_123456789",
  skip: [],
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
