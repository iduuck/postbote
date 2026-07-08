import type {
  Adapter,
  EmailMessage,
  SendOptions,
  SendResult,
} from "@postbote/core";
import { PostboteError } from "@postbote/core";
import sgMail from "@sendgrid/mail";
import { toPostboteErrorFromSdkError } from "./errors.js";
import { toSendGridSdkPayload } from "./map.js";

interface SendGridResponse {
  statusCode: number;
  headers: Record<string, string | string[] | undefined>;
  body: string;
}

interface SendGridClient {
  send(data: unknown): Promise<[SendGridResponse, Record<string, unknown>]>;
}

export interface SendGridOptions {
  apiKey: string;
  client?: SendGridClient;
}

export function sendgrid(options: SendGridOptions): Adapter {
  if (!options.client) {
    sgMail.setApiKey(options.apiKey);
  }
  const client: SendGridClient =
    options.client ?? (sgMail as unknown as SendGridClient);

  return {
    name: "sendgrid",

    async send(
      message: EmailMessage,
      sendOptions?: SendOptions,
    ): Promise<SendResult> {
      if (sendOptions?.signal?.aborted) {
        throw new PostboteError("Send aborted", {
          code: "ABORTED",
          provider: "sendgrid",
        });
      }

      const payload = toSendGridSdkPayload(message);

      let result: [SendGridResponse, Record<string, unknown>];
      try {
        result = await client.send(payload);
      } catch (err) {
        throw toPostboteErrorFromSdkError(err);
      }

      const [response] = result;
      const messageId = response.headers?.["x-message-id"];

      if (!messageId) {
        throw new PostboteError("Send failed: missing message ID", {
          code: "UNKNOWN",
          provider: "sendgrid",
        });
      }

      return {
        messageId: String(messageId),
        provider: "sendgrid",
        raw: response,
      };
    },
  };
}
