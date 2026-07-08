import type { FailureKind } from "@postbote/adapter-contract";
import { runAdapterContractTests } from "@postbote/adapter-contract";
import { delay, HttpResponse, http } from "msw";
import { setupServer } from "msw/node";
import { afterAll, afterEach, beforeAll } from "vitest";
import { sendgrid } from "./adapter.js";

interface MockState {
  status: number;
  headers: Record<string, string>;
  body: string;
  delayMs: number;
  networkError?: boolean;
}

let state: MockState = {
  status: 202,
  headers: { "x-message-id": "default-id" },
  body: "",
  delayMs: 0,
};

const handlers = [
  http.post("https://api.sendgrid.com/v3/mail/send", async () => {
    if (state.networkError) {
      return HttpResponse.error();
    }
    if (state.delayMs > 0) {
      await delay(state.delayMs);
    }
    return new HttpResponse(state.body, {
      status: state.status,
      headers: state.headers,
    });
  }),
];

const server = setupServer(...handlers);

function getFailureResponse(kind: FailureKind): MockState {
  switch (kind) {
    case "auth":
      return {
        status: 401,
        headers: {},
        body: JSON.stringify({
          errors: [{ message: "Unauthorized", field: "authorization" }],
        }),
        delayMs: 0,
      };
    case "rateLimited":
      return {
        status: 429,
        headers: {},
        body: JSON.stringify({ errors: [{ message: "Too many requests" }] }),
        delayMs: 0,
      };
    case "unavailable":
      return {
        status: 500,
        headers: {},
        body: JSON.stringify({
          errors: [{ message: "Internal server error" }],
        }),
        delayMs: 0,
      };
    case "timeout":
      return {
        status: 200,
        headers: { "x-message-id": "too-slow" },
        body: "",
        delayMs: 10_000,
      };
    case "invalidMessage":
      return {
        status: 400,
        headers: {},
        body: JSON.stringify({
          errors: [{ message: "Invalid message", field: "to" }],
        }),
        delayMs: 0,
      };
    case "recipientRejected":
      // SendGrid returns 400 for invalid recipients
      return {
        status: 400,
        headers: {},
        body: JSON.stringify({
          errors: [{ message: "Invalid recipient", field: "to" }],
        }),
        delayMs: 0,
      };
    case "networkError":
      return {
        status: 0,
        headers: {},
        body: "",
        delayMs: 0,
        networkError: true,
      };
  }
}

runAdapterContractTests({
  name: "sendgrid",
  createAdapter: () =>
    sendgrid({
      apiKey: "SG.test_123456789",
    }),
  interceptor: {
    success(messageId: string) {
      state = {
        status: 202,
        headers: { "x-message-id": messageId },
        body: "",
        delayMs: 0,
      };
    },
    failure(kind: FailureKind) {
      state = getFailureResponse(kind);
    },
    reset() {
      state = {
        status: 202,
        headers: { "x-message-id": "reset-id" },
        body: "",
        delayMs: 0,
      };
    },
  },
  secret: "SG.test_123456789",
  skip: ["recipientRejected", "timeout"],
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
