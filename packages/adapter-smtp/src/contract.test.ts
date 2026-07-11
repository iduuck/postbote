import type { FailureKind } from "@postbote/adapter-contract";
import { runAdapterContractTests } from "@postbote/adapter-contract";
import { SMTPServer } from "smtp-server";
import { afterAll, beforeAll } from "vitest";
import { smtp } from "./adapter.js";

interface State {
  kind?: FailureKind;
  messageId: string;
}

let state: State = { messageId: "reset-id" };
let port = 0;

function smtpFailure(responseCode: number, message: string): Error {
  return Object.assign(new Error(message), { responseCode });
}

const server = new SMTPServer({
  authOptional: true,
  disabledCommands: ["STARTTLS"],
  onConnect(_session, callback) {
    if (state.kind === "unavailable") {
      callback(smtpFailure(421, "Service unavailable"));
      return;
    }
    if (state.kind === "networkError") {
      callback(smtpFailure(421, "Connection reset"));
      return;
    }
    callback();
  },
  onAuth(_auth, _session, callback) {
    if (state.kind === "auth") {
      callback(smtpFailure(535, "Authentication failed"));
      return;
    }
    callback(null, { user: "test" });
  },
  onRcptTo(address, _session, callback) {
    if (state.kind === "recipientRejected") {
      callback(smtpFailure(550, `Unknown recipient ${address.address}`));
      return;
    }
    if (state.kind === "rateLimited") {
      callback(smtpFailure(452, "Insufficient system storage"));
      return;
    }
    callback();
  },
  onData(stream, _session, callback) {
    stream.resume();
    stream.once("end", () => {
      if (state.kind === "invalidMessage") {
        callback(smtpFailure(552, "Message too large"));
        return;
      }
      if (state.kind === "timeout") return;
      callback(null, state.messageId);
    });
  },
});

runAdapterContractTests({
  name: "smtp",
  createAdapter: () =>
    smtp({
      host: "127.0.0.1",
      port,
      auth: { user: "test", pass: "smtp-test-secret" },
      timeoutMs: state.kind === "timeout" ? 50 : 1_000,
    }),
  interceptor: {
    success(messageId) {
      state = { messageId };
    },
    failure(kind) {
      state = { kind, messageId: "failure-id" };
    },
    reset() {
      state = { messageId: "reset-id" };
    },
  },
  secret: "smtp-test-secret",
  skipMessageIdEquality: true,
});

beforeAll(async () => {
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.server.address();
  if (!address || typeof address === "string") {
    throw new Error("SMTP test server did not expose a port");
  }
  port = address.port;
});

afterAll(() => {
  server.close();
});
