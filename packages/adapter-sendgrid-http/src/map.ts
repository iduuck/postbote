import type { Address, Attachment, EmailMessage } from "@postbote/core";
import { encodeAttachment } from "@postbote/core";

interface SendGridAddress {
  email: string;
  name?: string;
}

function toSendGridAddress(addr: Address): SendGridAddress {
  return addr.name
    ? { email: addr.email, name: addr.name }
    : { email: addr.email };
}

function toSendGridAddressArray(
  addrs?: Address[],
): SendGridAddress[] | undefined {
  if (!addrs || addrs.length === 0) return undefined;
  return addrs.map(toSendGridAddress);
}

function mapAttachment(att: Attachment): {
  content: string;
  filename: string;
  type?: string;
  disposition?: string;
} {
  const content =
    typeof att.content === "string"
      ? att.content
      : encodeAttachment(att.content);
  return {
    content,
    filename: att.filename,
    ...(att.contentType ? { type: att.contentType } : {}),
    disposition: "attachment",
  };
}

export interface SendGridPayload {
  personalizations: Array<{
    to: SendGridAddress[];
    cc?: SendGridAddress[];
    bcc?: SendGridAddress[];
  }>;
  from: SendGridAddress;
  reply_to?: SendGridAddress;
  subject: string;
  content: Array<{ type: string; value: string }>;
  headers?: Record<string, string>;
  attachments?: Array<{
    content: string;
    filename: string;
    type?: string;
    disposition?: string;
  }>;
  custom_args?: Record<string, string>;
}

export function toSendGridPayload(msg: EmailMessage): SendGridPayload {
  const payload: SendGridPayload = {
    personalizations: [
      {
        to: toSendGridAddressArray(msg.to) ?? [],
      },
    ],
    from: toSendGridAddress(msg.from),
    subject: msg.subject,
    content: [],
  };

  if (msg.text) {
    payload.content.push({ type: "text/plain", value: msg.text });
  }
  if (msg.html) {
    payload.content.push({ type: "text/html", value: msg.html });
  }

  const personalization = payload.personalizations[0] as NonNullable<
    (typeof payload.personalizations)[number]
  >;
  if (msg.cc && msg.cc.length > 0) {
    personalization.cc = toSendGridAddressArray(msg.cc);
  }

  if (msg.bcc && msg.bcc.length > 0) {
    personalization.bcc = toSendGridAddressArray(msg.bcc);
  }

  if (msg.replyTo) {
    payload.reply_to = toSendGridAddress(msg.replyTo);
  }

  if (msg.headers && Object.keys(msg.headers).length > 0) {
    payload.headers = { ...msg.headers };
  }

  if (msg.attachments && msg.attachments.length > 0) {
    payload.attachments = msg.attachments.map(mapAttachment);
  }

  if (msg.tags && Object.keys(msg.tags).length > 0) {
    payload.custom_args = { ...msg.tags };
  }

  return payload;
}
