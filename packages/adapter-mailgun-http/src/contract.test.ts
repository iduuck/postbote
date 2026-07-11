import type { FailureKind } from "@postbote/adapter-contract";
import { runAdapterContractTests } from "@postbote/adapter-contract";
import { delay, HttpResponse, http } from "msw";
import { setupServer } from "msw/node";
import { afterAll, afterEach, beforeAll } from "vitest";
import { mailgunHttp } from "./adapter.js";

const API_BASE = "https://api.mailgun.test";

interface MockState {
  status: number;
  body: Record<string, unknown>;
  delayMs: number;
  headers?: Record<string, string>;
  networkError?: boolean;
}

let state: MockState = { status: 200, body: { id: "default-id" }, delayMs: 0 };

const server = setupServer(
  http.post(`${API_BASE}/v3/example.com/messages`, async () => {
    if (state.networkError) return HttpResponse.error();
    if (state.delayMs > 0) await delay(state.delayMs);
    return HttpResponse.json(state.body, {
      status: state.status,
      headers: state.headers,
    });
  }),
);

function failure(kind: FailureKind): MockState {
  switch (kind) {
    case "auth":
      return { status: 401, body: { message: "Forbidden" }, delayMs: 0 };
    case "rateLimited":
      return {
        status: 429,
        body: { message: "Too many requests" },
        delayMs: 0,
        headers: { "Retry-After": "7" },
      };
    case "unavailable":
      return { status: 500, body: { message: "Internal error" }, delayMs: 0 };
    case "timeout":
      return { status: 200, body: { id: "slow" }, delayMs: 10_000 };
    case "invalidMessage":
      return { status: 400, body: { message: "Invalid subject" }, delayMs: 0 };
    case "recipientRejected":
      return {
        status: 400,
        body: { message: "Recipient address is invalid" },
        delayMs: 0,
      };
    case "networkError":
      return { status: 0, body: {}, delayMs: 0, networkError: true };
  }
}

runAdapterContractTests({
  name: "mailgun-http",
  createAdapter: () =>
    mailgunHttp({
      apiKey: "key-test-secret",
      domain: "example.com",
      baseUrl: API_BASE,
      timeoutMs: 500,
    }),
  interceptor: {
    success(messageId) {
      state = { status: 200, body: { id: messageId }, delayMs: 0 };
    },
    failure(kind) {
      state = failure(kind);
    },
    reset() {
      state = { status: 200, body: { id: "reset-id" }, delayMs: 0 };
    },
  },
  secret: "key-test-secret",
  retryAfterMs: 7_000,
});

beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterAll(() => server.close());
afterEach(() => server.resetHandlers());
