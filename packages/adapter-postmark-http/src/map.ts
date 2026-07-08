import type { Address, Attachment, EmailMessage } from "@postbote/core";
import { encodeAttachment, formatAddress, PostboteError } from "@postbote/core";

const MAX_RECIPIENTS = 50;

function formatAddressList(addrs: Address[], field: string): string {
  if (addrs.length > MAX_RECIPIENTS) {
    throw new PostboteError(
      `Too many recipients in "${field}": ${addrs.length} (max ${MAX_RECIPIENTS})`,
      {
        code: "INVALID_MESSAGE",
        provider: "postmark-http",
      },
    );
  }
  return addrs.map(formatAddress).join(", ");
}

function mapHeaders(
  headers: Record<string, string>,
): { Name: string; Value: string }[] {
  return Object.entries(headers).map(([Name, Value]) => ({ Name, Value }));
}

function mapAttachment(att: Attachment): {
  Name: string;
  Content: string;
  ContentType: string;
} {
  const content =
    typeof att.content === "string"
      ? att.content
      : encodeAttachment(att.content);
  return {
    Name: att.filename,
    Content: content,
    ContentType: att.contentType ?? "application/octet-stream",
  };
}

export interface PostmarkPayload {
  From: string;
  To: string;
  Cc?: string;
  Bcc?: string;
  ReplyTo?: string;
  Subject: string;
  HtmlBody?: string;
  TextBody?: string;
  Headers?: { Name: string; Value: string }[];
  Attachments?: { Name: string; Content: string; ContentType: string }[];
  Metadata?: Record<string, string>;
  MessageStream: string;
  Tag?: string;
}

export function toPostmarkPayload(
  msg: EmailMessage,
  messageStream: string,
): PostmarkPayload {
  const payload: PostmarkPayload = {
    From: formatAddress(msg.from),
    To: formatAddressList(msg.to, "to"),
    Subject: msg.subject,
    MessageStream: messageStream,
  };

  if (msg.html) payload.HtmlBody = msg.html;
  if (msg.text) payload.TextBody = msg.text;

  if (msg.cc && msg.cc.length > 0) {
    payload.Cc = formatAddressList(msg.cc, "cc");
  }

  if (msg.bcc && msg.bcc.length > 0) {
    payload.Bcc = formatAddressList(msg.bcc, "bcc");
  }

  if (msg.replyTo) {
    payload.ReplyTo = formatAddress(msg.replyTo);
  }

  if (msg.headers && Object.keys(msg.headers).length > 0) {
    payload.Headers = mapHeaders(msg.headers);
  }

  if (msg.attachments && msg.attachments.length > 0) {
    payload.Attachments = msg.attachments.map(mapAttachment);
  }

  if (msg.tags && Object.keys(msg.tags).length > 0) {
    payload.Metadata = { ...msg.tags };
    if (msg.tags.tag) {
      payload.Tag = msg.tags.tag;
    }
  }

  return payload;
}
