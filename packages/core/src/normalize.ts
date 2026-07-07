import { PostboteError } from "./errors.js";
import type { Address, EmailMessage, EmailMessageInput } from "./types.js";

const ADDRESS_REGEX_ANGLE = /^(.+?)\s*<([^>]+)>\s*$/;

export function parseAddress(input: string | Address): Address {
  if (typeof input !== "string") {
    return input;
  }

  const trimmed = input.trim();

  if (!trimmed.includes("@")) {
    throw new PostboteError(`Invalid address: missing "@" in "${trimmed}"`, {
      code: "INVALID_MESSAGE",
      provider: "postbote",
    });
  }

  const angleMatch = trimmed.match(ADDRESS_REGEX_ANGLE);
  if (angleMatch) {
    return { email: angleMatch[2]!, name: angleMatch[1]!.trim() };
  }

  return { email: trimmed };
}

function normalizeAddressField(
  input?: string | Address | Array<string | Address>,
): Address[] | undefined {
  if (input === undefined || input === null) return undefined;
  if (Array.isArray(input)) return input.map(parseAddress);
  return [parseAddress(input)];
}

export function normalizeMessage(input: EmailMessageInput): EmailMessage {
  if (!input.from) {
    throw new PostboteError('"from" is required', {
      code: "INVALID_MESSAGE",
      provider: "postbote",
    });
  }
  const from = parseAddress(input.from);

  const to = normalizeAddressField(input.to);
  if (!to || to.length === 0) {
    throw new PostboteError('At least one recipient in "to" is required', {
      code: "INVALID_MESSAGE",
      provider: "postbote",
    });
  }

  if (!input.subject) {
    throw new PostboteError('"subject" is required', {
      code: "INVALID_MESSAGE",
      provider: "postbote",
    });
  }

  if (!input.html && !input.text) {
    throw new PostboteError('At least one of "html" or "text" is required', {
      code: "INVALID_MESSAGE",
      provider: "postbote",
    });
  }

  return {
    from,
    to,
    cc: normalizeAddressField(input.cc),
    bcc: normalizeAddressField(input.bcc),
    replyTo: input.replyTo ? parseAddress(input.replyTo) : undefined,
    subject: input.subject,
    html: input.html,
    text: input.text,
    attachments: input.attachments,
    headers: input.headers,
    tags: input.tags,
  };
}

export function encodeAttachment(content: Uint8Array): string {
  let binary = "";
  for (let i = 0; i < content.length; i++) {
    binary += String.fromCharCode(content[i]!);
  }
  return btoa(binary);
}
