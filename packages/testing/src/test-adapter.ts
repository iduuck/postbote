import type {
  Adapter,
  EmailMessage,
  ErrorCode,
  SendOptions,
  SendResult,
} from "@postbote/core";
import { PostboteError } from "@postbote/core";
import { createInbox, type RecordedEmail, type TestInbox } from "./inbox.js";

export interface SendCall {
  message: EmailMessage;
  error?: PostboteError;
}

export interface TestAdapterOptions<TName extends string = string> {
  name?: TName;
  latencyMs?: number;
}

interface FailNextEntry {
  error: PostboteError;
  remaining: number;
}

type FailIfPredicate = (
  msg: EmailMessage,
) => PostboteError | ErrorCode | undefined;

export interface TestAdapter<TName extends string = string>
  extends Adapter<TName> {
  readonly inbox: TestInbox;
  readonly calls: readonly SendCall[];

  failNext(error?: PostboteError | ErrorCode, opts?: { times?: number }): void;
  failAlways(error?: PostboteError | ErrorCode): void;
  failIf(predicate: FailIfPredicate): void;

  reset(): void;
}

function toPostboteError(
  input: PostboteError | ErrorCode | undefined,
  defaultCode: ErrorCode = "PROVIDER_UNAVAILABLE",
): PostboteError {
  if (input instanceof PostboteError) return input;
  if (input !== undefined) {
    return new PostboteError(`Simulated: ${input}`, {
      code: input,
      provider: "test",
    });
  }
  return new PostboteError(`Simulated: ${defaultCode}`, {
    code: defaultCode,
    provider: "test",
  });
}

export function createTestAdapter<const TName extends string>(
  options: TestAdapterOptions<TName> & { name: TName },
): TestAdapter<TName>;
export function createTestAdapter(
  options?: Omit<TestAdapterOptions, "name">,
): TestAdapter<"test">;
export function createTestAdapter(options?: TestAdapterOptions): TestAdapter {
  const name = options?.name ?? "test";
  const latencyMs = options?.latencyMs ?? 0;

  const { inbox, add: addToInbox } = createInbox();

  const calls: SendCall[] = [];
  const failNextQueue: FailNextEntry[] = [];
  let failAlwaysError: PostboteError | undefined;
  let failIfPredicate: FailIfPredicate | undefined;

  let counter = 0;

  function failNext(
    error?: PostboteError | ErrorCode,
    opts?: { times?: number },
  ): void {
    const err = toPostboteError(error);
    const times = opts?.times ?? 1;
    failNextQueue.push({ error: err, remaining: times });
  }

  function failAlways(error?: PostboteError | ErrorCode): void {
    failAlwaysError = toPostboteError(error);
  }

  function failIf(predicate: FailIfPredicate): void {
    failIfPredicate = predicate;
  }

  function reset(): void {
    inbox.clear();
    calls.length = 0;
    failNextQueue.length = 0;
    failAlwaysError = undefined;
    failIfPredicate = undefined;
    counter = 0;
  }

  async function send(
    message: EmailMessage,
    sendOptions?: SendOptions,
  ): Promise<SendResult> {
    if (sendOptions?.signal?.aborted) {
      const err = new PostboteError("Send aborted", {
        code: "ABORTED",
        provider: name,
      });
      calls.push({ message: { ...message }, error: err });
      throw err;
    }

    const attempt = ++counter;

    let simulatedError: PostboteError | undefined;

    if (failNextQueue.length > 0) {
      const entry = failNextQueue[0];
      if (entry) {
        simulatedError = entry.error;
        entry.remaining--;
        if (entry.remaining <= 0) {
          failNextQueue.shift();
        }
      }
    } else if (failIfPredicate) {
      const result = failIfPredicate(message);
      if (result !== undefined) {
        simulatedError = toPostboteError(result);
      }
    } else if (failAlwaysError) {
      simulatedError = failAlwaysError;
    }

    if (latencyMs > 0) {
      await new Promise((resolve) => setTimeout(resolve, latencyMs));
    }

    if (simulatedError) {
      calls.push({ message: { ...message }, error: simulatedError });
      throw simulatedError;
    }

    const recorded: RecordedEmail = {
      ...message,
      from: { ...message.from },
      to: message.to.map((a) => ({ ...a })),
      cc: message.cc?.map((a) => ({ ...a })),
      bcc: message.bcc?.map((a) => ({ ...a })),
      replyTo: message.replyTo ? { ...message.replyTo } : undefined,
      headers: message.headers ? { ...message.headers } : undefined,
      tags: message.tags ? { ...message.tags } : undefined,
      attachments: message.attachments?.map((a) => ({ ...a })),
      messageId: `${name}-${attempt}`,
      sentAt: new Date(),
      attempt,
    };

    calls.push({ message: { ...message } });
    addToInbox(recorded);

    return {
      messageId: recorded.messageId,
      provider: name,
    };
  }

  return {
    name,
    inbox,
    calls,
    failNext,
    failAlways,
    failIf,
    reset,
    send,
  };
}
