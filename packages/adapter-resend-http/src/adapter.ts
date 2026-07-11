import { type Adapter, defineAdapter } from "@postbote/core";
import {
  toPostboteErrorFromFetchError,
  toPostboteErrorFromResponse,
} from "./errors.js";
import { toResendPayload } from "./map.js";

export interface ResendHttpOptions {
  apiKey?: string;
  baseUrl?: string;
  timeoutMs?: number;
  fetch?: typeof fetch;
}

const DEFAULT_BASE_URL = "https://api.resend.com";
const DEFAULT_TIMEOUT_MS = 30_000;

export function resendHttp(options: ResendHttpOptions): Adapter<"resend-http"> {
  const apiKey = options.apiKey ?? readEnvironment("RESEND_API_KEY");
  if (!apiKey)
    throw new TypeError(
      "Resend API key is required (apiKey or RESEND_API_KEY)",
    );
  const baseUrl = options.baseUrl ?? DEFAULT_BASE_URL;
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const fetchFn = options.fetch ?? globalThis.fetch;

  return defineAdapter({
    name: "resend-http",
    async send(message, { signal: userSignal, idempotencyKey }) {
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
            Authorization: `Bearer ${apiKey}`,
            ...(idempotencyKey ? { "Idempotency-Key": idempotencyKey } : {}),
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

function readEnvironment(name: string): string | undefined {
  return (
    globalThis as { process?: { env?: Record<string, string | undefined> } }
  ).process?.env?.[name];
}
