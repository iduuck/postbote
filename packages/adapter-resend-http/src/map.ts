import type { Address, Attachment, EmailMessage } from "@postbote/core";
import { encodeAttachment, formatAddress } from "@postbote/core";

function formatAddressArray(addrs?: Address[]): string[] | undefined {
  if (!addrs || addrs.length === 0) return undefined;
  return addrs.map(formatAddress);
}

function mapTags(
  tags: Record<string, string>,
): { name: string; value: string }[] {
  return Object.entries(tags).map(([name, value]) => ({
    name: sanitizeTagName(name),
    value,
  }));
}

function sanitizeTagName(name: string): string {
  return name.replace(/[^a-zA-Z0-9_-]/g, "_");
}

function mapAttachment(att: Attachment): { filename: string; content: string } {
  const content =
    typeof att.content === "string"
      ? att.content
      : encodeAttachment(att.content);
  return { filename: att.filename, content };
}

export interface ResendPayload {
  from: string;
  to: string[];
  cc?: string[];
  bcc?: string[];
  reply_to?: string;
  subject: string;
  html?: string;
  text?: string;
  headers?: Record<string, string>;
  attachments?: { filename: string; content: string }[];
  tags?: { name: string; value: string }[];
}

export function toResendPayload(msg: EmailMessage): ResendPayload {
  const payload: ResendPayload = {
    from: formatAddress(msg.from),
    to: formatAddressArray(msg.to) ?? [],
    subject: msg.subject,
  };

  if (msg.html) payload.html = msg.html;
  if (msg.text) payload.text = msg.text;

  if (msg.cc && msg.cc.length > 0) {
    payload.cc = formatAddressArray(msg.cc);
  }

  if (msg.bcc && msg.bcc.length > 0) {
    payload.bcc = formatAddressArray(msg.bcc);
  }

  if (msg.replyTo) {
    payload.reply_to = formatAddress(msg.replyTo);
  }

  if (msg.headers && Object.keys(msg.headers).length > 0) {
    payload.headers = { ...msg.headers };
  }

  if (msg.attachments && msg.attachments.length > 0) {
    payload.attachments = msg.attachments.map(mapAttachment);
  }

  if (msg.tags && Object.keys(msg.tags).length > 0) {
    payload.tags = mapTags(msg.tags);
  }

  return payload;
}
