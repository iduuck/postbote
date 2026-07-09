import type { PostboteError } from "./errors.js";
import type { Middleware, SendContext } from "./pipeline.js";

export interface Address {
  email: string;
  name?: string;
}

export interface Attachment {
  filename: string;
  content: string | Uint8Array;
  contentType?: string;
}

export interface EmailMessage {
  from: Address;
  to: Address[];
  cc?: Address[];
  bcc?: Address[];
  replyTo?: Address;
  subject: string;
  html?: string;
  text?: string;
  attachments?: Attachment[];
  headers?: Record<string, string>;
  tags?: Record<string, string>;
}

export interface EmailMessageInput {
  from: string | Address;
  to: string | Address | Array<string | Address>;
  cc?: string | Address | Array<string | Address>;
  bcc?: string | Address | Array<string | Address>;
  replyTo?: string | Address;
  subject: string;
  html?: string;
  text?: string;
  attachments?: Attachment[];
  headers?: Record<string, string>;
  tags?: Record<string, string>;
}

export interface SendOptions {
  signal?: AbortSignal;
}

export interface SendResult {
  messageId: string;
  provider: string;
  raw?: unknown;
}

export interface Adapter {
  readonly name: string;
  send(message: EmailMessage, options?: SendOptions): Promise<SendResult>;
}

export interface PluginObject<TInputExt = {}, TSendReturn = never> {
  name: string;
  transformInput?: (
    input: EmailMessageInput,
  ) => EmailMessageInput | Promise<EmailMessageInput>;
  middleware?: Middleware;
  wrapSend?: (run: () => Promise<SendResult>) => TSendReturn;
  readonly __inputExt?: TInputExt;
  readonly __sendReturn?: TSendReturn;
}

export type PostbotePlugin<TInputExt = {}, TSendReturn = never> =
  | Middleware
  | PluginObject<TInputExt, TSendReturn>;