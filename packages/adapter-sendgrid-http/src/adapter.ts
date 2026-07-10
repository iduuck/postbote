import { type Adapter, defineAdapter } from "@postbote/core";
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

export function sendgridHttp(
  options: SendGridHttpOptions,
): Adapter<"sendgrid-http"> {
  const baseUrl = options.baseUrl ?? DEFAULT_BASE_URL;
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const fetchFn = options.fetch ?? globalThis.fetch;

  return defineAdapter({
    name: "sendgrid-http",
    async send(message, { signal: userSignal }) {
      const payload = toSendGridPayload(message);

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
      return {
        messageId: messageId ?? "",
        raw: {
          status: response.status,
          headers: Object.fromEntries(response.headers.entries()),
        },
      };
    },
  });
}
