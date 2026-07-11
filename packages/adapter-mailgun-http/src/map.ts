import type { Attachment, EmailMessage } from "@postbote/core";
import { formatAddress } from "@postbote/core";

function attachmentContent(content: Attachment["content"]): ArrayBuffer {
  const bytes =
    typeof content === "string"
      ? Uint8Array.from(atob(content), (char) => char.charCodeAt(0))
      : new Uint8Array(content);
  return bytes.buffer;
}

export function toMailgunFormData(message: EmailMessage): FormData {
  const body = new FormData();
  body.set("from", formatAddress(message.from));
  for (const address of message.to) body.append("to", formatAddress(address));
  for (const address of message.cc ?? [])
    body.append("cc", formatAddress(address));
  for (const address of message.bcc ?? []) {
    body.append("bcc", formatAddress(address));
  }
  body.set("subject", message.subject);
  if (message.text) body.set("text", message.text);
  if (message.html) body.set("html", message.html);
  if (message.replyTo) body.set("h:Reply-To", formatAddress(message.replyTo));
  for (const [key, value] of Object.entries(message.headers ?? {})) {
    body.set(`h:${key}`, value);
  }
  for (const tag of Object.values(message.tags ?? {}))
    body.append("o:tag", tag);
  for (const attachment of message.attachments ?? []) {
    body.append(
      "attachment",
      new Blob([attachmentContent(attachment.content)], {
        type: attachment.contentType,
      }),
      attachment.filename,
    );
  }
  return body;
}
