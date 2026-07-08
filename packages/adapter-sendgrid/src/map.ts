import type { Address, Attachment, EmailMessage } from "@postbote/core";
import { encodeAttachment } from "@postbote/core";

interface SendGridAddress {
  email: string;
  name?: string;
}

interface SendGridAttachment {
  content: string;
  filename: string;
  type?: string;
  disposition: string;
}

export interface SendGridSdkPayload {
  to: SendGridAddress[];
  from: SendGridAddress;
  cc?: SendGridAddress[];
  bcc?: SendGridAddress[];
  replyTo?: SendGridAddress;
  subject: string;
  text?: string;
  html?: string;
  headers?: Record<string, string>;
  attachments?: SendGridAttachment[];
  customArgs?: Record<string, string>;
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

function mapAttachment(att: Attachment): SendGridAttachment {
  const content =
    typeof att.content === "string"
      ? att.content
      : encodeAttachment(att.content);
  return {
    content,
    filename: att.filename,
    type: att.contentType,
    disposition: "attachment",
  };
}

export function toSendGridSdkPayload(msg: EmailMessage): SendGridSdkPayload {
  const payload: SendGridSdkPayload = {
    to: toSendGridAddressArray(msg.to) ?? [],
    from: toSendGridAddress(msg.from),
    subject: msg.subject,
  };

  if (msg.text) payload.text = msg.text;
  if (msg.html) payload.html = msg.html;

  if (msg.cc && msg.cc.length > 0) {
    payload.cc = toSendGridAddressArray(msg.cc);
  }

  if (msg.bcc && msg.bcc.length > 0) {
    payload.bcc = toSendGridAddressArray(msg.bcc);
  }

  if (msg.replyTo) {
    payload.replyTo = toSendGridAddress(msg.replyTo);
  }

  if (msg.headers && Object.keys(msg.headers).length > 0) {
    payload.headers = { ...msg.headers };
  }

  if (msg.attachments && msg.attachments.length > 0) {
    payload.attachments = msg.attachments.map(mapAttachment);
  }

  if (msg.tags && Object.keys(msg.tags).length > 0) {
    payload.customArgs = { ...msg.tags };
  }

  return payload;
}
