import type {
  Adapter,
  EmailMessage,
  SendOptions,
  SendResult,
} from "@postbote/core";
import { PostboteError } from "@postbote/core";
import { Resend } from "resend";
import type { SdkError } from "./errors.js";
import { toPostboteErrorFromSdkError } from "./errors.js";
import { toResendSdkPayload } from "./map.js";

export interface ResendOptions {
  apiKey: string;
  client?: {
    emails: {
      send(
        payload: unknown,
      ): Promise<{ data?: { id: string }; error?: SdkError }>;
    };
  };
}

interface SendResultData {
  id: string;
}

type SendFn = (payload: unknown) => Promise<{
  data?: SendResultData;
  error?: SdkError;
}>;

export function resend(options: ResendOptions): Adapter {
  const client = options.client ?? new Resend(options.apiKey);
  const send: SendFn = client.emails.send.bind(client.emails) as SendFn;

  return {
    name: "resend",

    async send(
      message: EmailMessage,
      sendOptions?: SendOptions,
    ): Promise<SendResult> {
      if (sendOptions?.signal?.aborted) {
        throw new PostboteError("Send aborted", {
          code: "ABORTED",
          provider: "resend",
        });
      }

      const payload = toResendSdkPayload(message);

      let result: Awaited<ReturnType<SendFn>>;
      try {
        result = await send(payload);
      } catch (err) {
        throw new PostboteError("Send failed: network or SDK error", {
          code: "PROVIDER_UNAVAILABLE",
          provider: "resend",
          cause: err,
        });
      }

      if (result.error) {
        throw toPostboteErrorFromSdkError(result.error);
      }

      if (!result.data?.id) {
        throw new PostboteError("Send failed: missing message ID", {
          code: "UNKNOWN",
          provider: "resend",
        });
      }

      return {
        messageId: result.data.id,
        provider: "resend",
        raw: result.data,
      };
    },
  };
}
