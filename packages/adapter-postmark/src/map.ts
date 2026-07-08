import type { Address, Attachment, EmailMessage } from "@postbote/core";
import { encodeAttachment, formatAddress } from "@postbote/core";

const MAX_RECIPIENTS = 50;

function formatAddressList(addrs?: Address[]): string | undefined {
  if (!addrs || addrs.length === 0) return undefined;
  return addrs.map(formatAddress).join(", ");
}

function countRecipients(msg: EmailMessage): number {
  return (msg.to?.length ?? 0) + (msg.cc?.length ?? 0) + (msg.bcc?.length ?? 0);
}

function mapAttachment(att: Attachment): Record<string, unknown> {
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

function mapHeaders(
  headers: Record<string, string>,
): { Name: string; Value: string }[] {
  return Object.entries(headers).map(([Name, Value]) => ({ Name, Value }));
}

export function toPostmarkSdkPayload(
  msg: EmailMessage,
  messageStream?: string,
): Record<string, unknown> {
  if (countRecipients(msg) > MAX_RECIPIENTS) {
    throw new RangeError(
      `Total recipients (To + Cc + Bcc) exceeds maximum of ${MAX_RECIPIENTS}`,
    );
  }

  const payload: Record<string, unknown> = {
    From: formatAddress(msg.from),
    To: formatAddressList(msg.to) ?? "",
    Subject: msg.subject,
  };

  if (msg.html) payload.HtmlBody = msg.html;
  if (msg.text) payload.TextBody = msg.text;

  if (msg.cc && msg.cc.length > 0) {
    payload.Cc = formatAddressList(msg.cc);
  }

  if (msg.bcc && msg.bcc.length > 0) {
    payload.Bcc = formatAddressList(msg.bcc);
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
    if (msg.tags.tag) {
      payload.Tag = msg.tags.tag;
    }
    payload.Metadata = { ...msg.tags };
  }

  if (messageStream) {
    payload.MessageStream = messageStream;
  }

  return payload;
}
