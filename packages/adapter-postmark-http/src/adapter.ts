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
import { toPostmarkPayload } from "./map.js";

export interface PostmarkHttpOptions {
  serverToken: string;
  baseUrl?: string;
  timeoutMs?: number;
  fetch?: typeof fetch;
  messageStream?: string;
}

const DEFAULT_BASE_URL = "https://api.postmarkapp.com";
const DEFAULT_TIMEOUT_MS = 30_000;
const DEFAULT_MESSAGE_STREAM = "outbound";

export function postmarkHttp(options: PostmarkHttpOptions): Adapter {
  const baseUrl = options.baseUrl ?? DEFAULT_BASE_URL;
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const messageStream = options.messageStream ?? DEFAULT_MESSAGE_STREAM;
  const fetchFn = options.fetch ?? globalThis.fetch;

  return {
    name: "postmark-http",

    async send(
      message: EmailMessage,
      sendOptions?: SendOptions,
    ): Promise<SendResult> {
      const payload = toPostmarkPayload(message, messageStream);
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
        response = await fetchFn(`${baseUrl}/email`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Accept: "application/json",
            "X-Postmark-Server-Token": options.serverToken,
          },
          body: JSON.stringify(payload),
          signal: combinedSignal,
        });
      } catch (err) {
        throw toPostboteErrorFromFetchError(err, userSignal, combinedSignal);
      }

      const body: unknown = await response.json().catch(() => undefined);

      if (!response.ok) {
        throw toPostboteErrorFromResponse(response, body);
      }

      const result = body as { MessageID?: string };
      if (!result.MessageID) {
        throw new PostboteError("Send failed: missing MessageID in response", {
          code: "UNKNOWN",
          provider: "postmark-http",
        });
      }

      return {
        messageId: result.MessageID,
        provider: "postmark-http",
        raw: result,
      };
    },
  };
}
