import type {
  Adapter,
  EmailMessage,
  SendOptions,
  SendResult,
} from "@postbote/core";
import { PostboteError } from "@postbote/core";
import type { Message } from "postmark";
import { ServerClient } from "postmark";
import { toPostboteErrorFromSdkError } from "./errors.js";
import { toPostmarkSdkPayload } from "./map.js";

export interface PostmarkOptions {
  serverToken: string;
  client?: {
    sendEmail: (email: Message) => ReturnType<ServerClient["sendEmail"]>;
  };
  messageStream?: string;
  timeoutMs?: number;
}

export function postmark(options: PostmarkOptions): Adapter {
  const sdkClient =
    options.client ??
    new ServerClient(options.serverToken, {
      ...(options.timeoutMs !== undefined
        ? { timeout: options.timeoutMs / 1000 }
        : {}),
    });

  const sendEmail = sdkClient.sendEmail.bind(sdkClient);

  return {
    name: "postmark",

    async send(
      message: EmailMessage,
      sendOptions?: SendOptions,
    ): Promise<SendResult> {
      if (sendOptions?.signal?.aborted) {
        throw new PostboteError("Send aborted", {
          code: "ABORTED",
          provider: "postmark",
        });
      }

      const payload = toPostmarkSdkPayload(message, options.messageStream);

      let result: Awaited<ReturnType<ServerClient["sendEmail"]>>;
      try {
        result = await sendEmail(payload as unknown as Message);
      } catch (err) {
        throw toPostboteErrorFromSdkError(err);
      }

      if (!result.MessageID) {
        throw new PostboteError("Send failed: missing message ID", {
          code: "UNKNOWN",
          provider: "postmark",
        });
      }

      return {
        messageId: result.MessageID,
        provider: "postmark",
        raw: result,
      };
    },
  };
}
