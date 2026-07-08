import type { FailureKind } from "@postbote/adapter-contract";
import { runAdapterContractTests } from "@postbote/adapter-contract";
import { delay, HttpResponse, http } from "msw";
import { setupServer } from "msw/node";
import { afterAll, afterEach, beforeAll } from "vitest";
import { sendgridHttp } from "./adapter.js";

const API_BASE = "https://api.sendgrid.com";

interface MockState {
  status?: number;
  body?: Record<string, unknown>;
  delayMs?: number;
  networkError?: boolean;
}

let state: MockState = { status: 202, body: {}, delayMs: 0 };

const handlers = [
  http.post(`${API_BASE}/v3/mail/send`, async () => {
    if (state.networkError) {
      return HttpResponse.error();
    }
    if (state.delayMs && state.delayMs > 0) {
      await delay(state.delayMs);
    }
    const messageId = state.body?.id as string | undefined;
    return HttpResponse.json(state.body ?? {}, {
      status: state.status ?? 202,
      headers: messageId
        ? { "X-Message-Id": messageId, "content-type": "application/json" }
        : { "content-type": "application/json" },
    });
  }),
];

const server = setupServer(...handlers);

function getFailureResponse(kind: FailureKind): MockState {
  switch (kind) {
    case "auth":
      return {
        status: 401,
        body: {
          errors: [{ field: "authorization", message: "Unauthorized" }],
        },
        delayMs: 0,
      };
    case "rateLimited":
      return {
        status: 429,
        body: { errors: [{ message: "Too many requests" }] },
        delayMs: 0,
      };
    case "unavailable":
      return {
        status: 500,
        body: { errors: [{ message: "Internal server error" }] },
        delayMs: 0,
      };
    case "timeout":
      return { status: 202, body: {}, delayMs: 10_000 };
    case "invalidMessage":
      return {
        status: 400,
        body: { errors: [{ field: "subject", message: "Invalid subject" }] },
        delayMs: 0,
      };
    case "recipientRejected":
      return {
        status: 400,
        body: { errors: [{ field: "to", message: "Recipient rejected" }] },
        delayMs: 0,
      };
    case "networkError":
      return { networkError: true };
  }
}

runAdapterContractTests({
  name: "sendgrid-http",
  createAdapter: () =>
    sendgridHttp({
      apiKey: "SG.test_123456789",
      baseUrl: API_BASE,
      timeoutMs: 500,
    }),
  interceptor: {
    success(messageId: string) {
      state = { status: 202, body: { id: messageId }, delayMs: 0 };
    },
    failure(kind: FailureKind) {
      state = getFailureResponse(kind);
    },
    reset() {
      state = { status: 202, body: {}, delayMs: 0 };
    },
  },
  secret: "SG.test_123456789",
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
