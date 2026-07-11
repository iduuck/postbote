import type { Adapter, EmailMessage } from "@postbote/core";
import { defineAdapter, PostboteError } from "@postbote/core";
import nodemailer, { type Transporter } from "nodemailer";
import { toSmtpError } from "./errors.js";
import { toSmtpPayload } from "./map.js";

export interface SmtpOptions {
  url?: string;
  host?: string;
  port?: number;
  secure?: boolean;
  auth?: { user: string; pass: string };
  pool?: boolean;
  maxConnections?: number;
  timeoutMs?: number;
  transport?: Pick<Transporter, "sendMail">;
}

export interface SmtpAdapter extends Adapter<"smtp"> {
  close(): Promise<void>;
}

function configuredSecret(options: SmtpOptions): string | undefined {
  if (options.auth?.pass) return options.auth.pass;
  if (!options.url) return undefined;

  try {
    return decodeURIComponent(new URL(options.url).password) || undefined;
  } catch {
    return undefined;
  }
}

function createTransport(options: SmtpOptions): Transporter {
  const timeoutMs = options.timeoutMs ?? 30_000;
  const defaults = {
    pool: options.pool ?? true,
    maxConnections: options.maxConnections ?? 5,
    connectionTimeout: timeoutMs,
    greetingTimeout: timeoutMs,
    socketTimeout: timeoutMs,
  };

  if (options.url) {
    return nodemailer.createTransport({ url: options.url, ...defaults });
  }

  const port = options.port ?? 587;
  return nodemailer.createTransport({
    ...defaults,
    host: options.host,
    port,
    secure: options.secure ?? port === 465,
    auth: options.auth,
  });
}

function abortPromise(signal: AbortSignal): Promise<never> {
  return new Promise((_, reject) => {
    signal.addEventListener(
      "abort",
      () => {
        reject(
          new PostboteError("Send aborted", {
            code: "ABORTED",
            provider: "smtp",
          }),
        );
      },
      { once: true },
    );
  });
}

export function smtp(options: SmtpOptions): SmtpAdapter {
  const transport = options.transport ?? createTransport(options);
  const secret = configuredSecret(options);
  const adapter = defineAdapter({
    name: "smtp",
    async send(message: EmailMessage, { signal }) {
      const send = transport.sendMail(toSmtpPayload(message));
      const info = signal
        ? await Promise.race([send, abortPromise(signal)])
        : await send;

      if (info.rejected.length > 0) {
        throw new PostboteError("SMTP rejected one or more recipients", {
          code: "RECIPIENT_REJECTED",
          provider: "smtp",
          cause: { rejected: info.rejected },
        });
      }

      return {
        messageId: info.messageId,
        raw: {
          messageId: info.messageId,
          accepted: info.accepted,
          rejected: info.rejected,
          response: info.response,
        },
      };
    },
    mapUnknownError: (error) => toSmtpError(error, secret),
  });

  return Object.assign(adapter, {
    async close() {
      const close = (transport as { close?: () => void | Promise<void> }).close;
      await close?.call(transport);
    },
  });
}
