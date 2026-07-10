import { type Adapter, defineAdapter } from "@postbote/core";
import {
  toPostboteErrorFromFetchError,
  toPostboteErrorFromResponse,
} from "./errors.js";
import { toResendPayload } from "./map.js";

export interface ResendHttpOptions {
  apiKey: string;
  baseUrl?: string;
  timeoutMs?: number;
  fetch?: typeof fetch;
}

const DEFAULT_BASE_URL = "https://api.resend.com";
const DEFAULT_TIMEOUT_MS = 30_000;

export function resendHttp(options: ResendHttpOptions): Adapter {
  const baseUrl = options.baseUrl ?? DEFAULT_BASE_URL;
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const fetchFn = options.fetch ?? globalThis.fetch;

  return defineAdapter({
    name: "resend-http",
    async send(message, { signal: userSignal }) {
      const payload = toResendPayload(message);

      const signals = [userSignal, AbortSignal.timeout(timeoutMs)].filter(
        Boolean,
      ) as AbortSignal[];

      const combinedSignal =
        signals.length > 1 ? AbortSignal.any(signals) : signals[0];

      let response: Response;
      try {
        response = await fetchFn(`${baseUrl}/emails`, {
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

      const body: unknown = await response.json().catch(() => undefined);

      if (!response.ok) {
        throw toPostboteErrorFromResponse(response, body);
      }

      const result = body as { id?: string };
      return {
        messageId: result.id ?? "",
        raw: result,
      };
    },
  });
}
