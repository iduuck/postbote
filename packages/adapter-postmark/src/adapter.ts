import type { EmailMessage } from "@postbote/core";
import { type AdapterSpec, defineAdapter } from "@postbote/core";
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

export function postmark(options: PostmarkOptions) {
  const sdkClient =
    options.client ??
    new ServerClient(options.serverToken, {
      ...(options.timeoutMs !== undefined
        ? { timeout: options.timeoutMs / 1000 }
        : {}),
    });

  const sendEmail = sdkClient.sendEmail.bind(sdkClient);

  const spec: AdapterSpec<"postmark"> = {
    name: "postmark",
    async send(message: EmailMessage, ctx: { signal?: AbortSignal }) {
      const payload = toPostmarkSdkPayload(message, options.messageStream);

      let result: Awaited<ReturnType<ServerClient["sendEmail"]>>;
      try {
        result = await sendEmail(payload as unknown as Message);
      } catch (err) {
        throw toPostboteErrorFromSdkError(err);
      }

      return { messageId: result.MessageID, raw: result };
    },
  };

  return defineAdapter(spec);
}
