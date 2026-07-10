import { type Adapter, defineAdapter } from "@postbote/core";
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

export function postmarkHttp(
  options: PostmarkHttpOptions,
): Adapter<"postmark-http"> {
  const baseUrl = options.baseUrl ?? DEFAULT_BASE_URL;
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const messageStream = options.messageStream ?? DEFAULT_MESSAGE_STREAM;
  const fetchFn = options.fetch ?? globalThis.fetch;

  return defineAdapter({
    name: "postmark-http",
    async send(message, { signal: userSignal }) {
      const payload = toPostmarkPayload(message, messageStream);

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
      return {
        messageId: result.MessageID ?? "",
        raw: result,
      };
    },
  });
}
