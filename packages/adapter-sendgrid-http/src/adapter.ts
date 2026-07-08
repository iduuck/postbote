import type {
  Adapter,
  EmailMessage,
  SendOptions,
  SendResult,
} from "@postbote/core";
import { PostboteError } from "@postbote/core";
import {
  toPostboteErrorFromFetchError,
  toPostboteErrorFromResponse,
} from "./errors.js";
import { toSendGridPayload } from "./map.js";

export interface SendGridHttpOptions {
  apiKey: string;
  baseUrl?: string;
  timeoutMs?: number;
  fetch?: typeof fetch;
}

const DEFAULT_BASE_URL = "https://api.sendgrid.com";
const DEFAULT_TIMEOUT_MS = 30_000;

export function sendgridHttp(options: SendGridHttpOptions): Adapter {
  const baseUrl = options.baseUrl ?? DEFAULT_BASE_URL;
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const fetchFn = options.fetch ?? globalThis.fetch;

  return {
    name: "sendgrid-http",

    async send(
      message: EmailMessage,
      sendOptions?: SendOptions,
    ): Promise<SendResult> {
      const payload = toSendGridPayload(message);
      const userSignal = sendOptions?.signal;

      if (userSignal?.aborted) {
        const err = new DOMException("Aborted", "AbortError");
        throw toPostboteErrorFromFetchError(err, userSignal);
      }

      const signals = [userSignal, AbortSignal.timeout(timeoutMs)].filter(
        Boolean,
      ) as AbortSignal[];

      const combinedSignal =
        signals.length > 1 ? AbortSignal.any(signals) : signals[0];

      let response: Response;
      try {
        response = await fetchFn(`${baseUrl}/v3/mail/send`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${options.apiKey}`,
          },
          body: JSON.stringify(payload),
          signal: combinedSignal,
        });
      } catch (err) {
        throw toPostboteErrorFromFetchError(err, userSignal, combinedSignal);
      }

      if (!response.ok) {
        const body: unknown = await response.json().catch(() => undefined);
        throw toPostboteErrorFromResponse(response, body);
      }

      const messageId = response.headers.get("x-message-id");
      if (!messageId) {
        throw new PostboteError(
          "Send failed: missing X-Message-Id header in response",
          {
            code: "UNKNOWN",
            provider: "sendgrid-http",
          },
        );
      }

      return {
        messageId,
        provider: "sendgrid-http",
        raw: {
          status: response.status,
          headers: Object.fromEntries(response.headers.entries()),
        },
      };
    },
  };
}
