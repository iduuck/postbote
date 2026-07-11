import type { Address, Attachment, EmailMessage } from "@postbote/core";
import type { SendMailOptions } from "nodemailer";

function mapAddress(address: Address): { name?: string; address: string } {
  return address.name
    ? { name: address.name, address: address.email }
    : { address: address.email };
}

function mapAddresses(
  addresses?: Address[],
): Array<{ name?: string; address: string }> | undefined {
  return addresses?.map(mapAddress);
}

function mapAttachment(att: Attachment): {
  filename: string;
  content: Buffer | string;
  contentType?: string;
  encoding?: "base64";
} {
  if (typeof att.content === "string") {
    return {
      filename: att.filename,
      content: att.content,
      contentType: att.contentType,
      encoding: "base64",
    };
  }

  return {
    filename: att.filename,
    content: Buffer.from(att.content),
    contentType: att.contentType,
  };
}

function mapHeaders(message: EmailMessage): Record<string, string> | undefined {
  const tags = Object.fromEntries(
    Object.entries(message.tags ?? {}).map(([key, value]) => [
      `X-Postbote-Tag-${key}`,
      value,
    ]),
  );
  const headers = { ...message.headers, ...tags };

  return Object.keys(headers).length > 0 ? headers : undefined;
}

export function toSmtpPayload(message: EmailMessage): SendMailOptions {
  return {
    from: mapAddress(message.from),
    to: mapAddresses(message.to),
    cc: mapAddresses(message.cc),
    bcc: mapAddresses(message.bcc),
    replyTo: message.replyTo ? mapAddress(message.replyTo) : undefined,
    subject: message.subject,
    html: message.html,
    text: message.text,
    headers: mapHeaders(message),
    attachments: message.attachments?.map(mapAttachment),
  };
}
