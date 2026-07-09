import { defineAdapter, type AdapterSpec } from "@postbote/core";
import type { EmailMessage } from "@postbote/core";
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

export function resend(options: ResendOptions) {
  const client = options.client ?? new Resend(options.apiKey);
  const send: SendFn = client.emails.send.bind(client.emails) as SendFn;

  const spec: AdapterSpec = {
    name: "resend",
    mapUnknownError: () => "PROVIDER_UNAVAILABLE" as const,
    async send(
      message: EmailMessage,
      ctx: { signal?: AbortSignal },
    ) {
      const payload = toResendSdkPayload(message);
      const result = await send(payload);

      if (result.error) {
        throw toPostboteErrorFromSdkError(result.error);
      }

      return { messageId: result.data!.id, raw: result.data };
    },
  };

  return defineAdapter(spec);
}