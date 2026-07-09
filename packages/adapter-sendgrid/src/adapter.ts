import type { EmailMessage } from "@postbote/core";
import { type AdapterSpec, defineAdapter } from "@postbote/core";
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

export function sendgrid(options: SendGridOptions) {
  let client: SendGridClient;

  if (options.client) {
    client = options.client;
  } else {
    const MailService = sgMail.constructor as new () => SendGridClient & {
      setApiKey(key: string): void;
    };
    const mailService = new MailService();
    mailService.setApiKey(options.apiKey);
    client = mailService;
  }

  const spec: AdapterSpec = {
    name: "sendgrid",
    async send(message: EmailMessage, ctx: { signal?: AbortSignal }) {
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
        return { messageId: "", raw: response };
      }

      return { messageId: String(messageId), raw: response };
    },
  };

  return defineAdapter(spec);
}
