import { type Adapter, defineAdapter } from "@postbote/core";
import { toMailgunFetchError, toMailgunResponseError } from "./errors.js";
import { toMailgunFormData } from "./map.js";

export interface MailgunHttpOptions {
  apiKey?: string;
  domain: string;
  /** Use `https://api.eu.mailgun.net` for Mailgun's EU region. */
  baseUrl?: string;
  timeoutMs?: number;
  fetch?: typeof fetch;
}

const DEFAULT_BASE_URL = "https://api.mailgun.net";
const DEFAULT_TIMEOUT_MS = 30_000;

export function mailgunHttp(
  options: MailgunHttpOptions,
): Adapter<"mailgun-http"> {
  const apiKey = options.apiKey ?? readEnvironment("MAILGUN_API_KEY");
  if (!apiKey) {
    throw new TypeError(
      "Mailgun API key is required (apiKey or MAILGUN_API_KEY)",
    );
  }
  if (!options.domain) throw new TypeError("Mailgun domain is required");

  const baseUrl = (options.baseUrl ?? DEFAULT_BASE_URL).replace(/\/$/, "");
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const fetchFn = options.fetch ?? globalThis.fetch;

  return defineAdapter({
    name: "mailgun-http",
    async send(message, { signal: userSignal }) {
      const signals = [userSignal, AbortSignal.timeout(timeoutMs)].filter(
        Boolean,
      ) as AbortSignal[];
      const signal = signals.length > 1 ? AbortSignal.any(signals) : signals[0];

      let response: Response;
      try {
        response = await fetchFn(`${baseUrl}/v3/${options.domain}/messages`, {
          method: "POST",
          headers: { Authorization: `Basic ${btoa(`api:${apiKey}`)}` },
          body: toMailgunFormData(message),
          signal,
        });
      } catch (error) {
        throw toMailgunFetchError(error, userSignal, signal);
      }

      const body: unknown = await response.json().catch(() => undefined);
      if (!response.ok) throw toMailgunResponseError(response, body);

      const result = body as { id?: string };
      return { messageId: result.id ?? "", raw: result };
    },
  });
}

function readEnvironment(name: string): string | undefined {
  return (
    globalThis as { process?: { env?: Record<string, string | undefined> } }
  ).process?.env?.[name];
}
