import { PostboteError } from "./errors.js";
import type { Address, EmailMessage, EmailMessageInput } from "./types.js";

const ADDRESS_REGEX_ANGLE = /^(.+?)\s*<([^>]+)>\s*$/;

const CRLF = /[\r\n]/;

function checkEmail(email: string, label: string): void {
  if (!email.includes("@")) {
    throw new PostboteError(`Invalid ${label}: missing "@" in "${email}"`, {
      code: "INVALID_MESSAGE",
      provider: "postbote",
    });
  }
}

function checkCRLF(value: string, label: string): void {
  if (CRLF.test(value)) {
    throw new PostboteError(
      `${label} contains prohibited CR or LF characters`,
      { code: "INVALID_MESSAGE", provider: "postbote" },
    );
  }
}

export function parseAddress(input: string | Address): Address {
  if (typeof input !== "string") {
    checkEmail(input.email, "address");
    return input;
  }

  const trimmed = input.trim();

  const angleMatch = trimmed.match(ADDRESS_REGEX_ANGLE);
  if (angleMatch) {
    const email = angleMatch[2];
    if (!email) {
      throw new PostboteError(`Invalid address: no email in "${trimmed}"`, {
        code: "INVALID_MESSAGE",
        provider: "postbote",
      });
    }
    checkEmail(email, "address");
    return { email, name: angleMatch[1]?.trim() };
  }

  checkEmail(trimmed, "address");
  return { email: trimmed };
}

function normalizeAddressField(
  input?: string | Address | Array<string | Address>,
): Address[] | undefined {
  if (input === undefined || input === null) return undefined;
  if (Array.isArray(input)) return input.map(parseAddress);
  return [parseAddress(input)];
}

function validateAddressCRLF(addr: Address, label: string): void {
  checkCRLF(addr.email, `${label} email`);
  if (addr.name) checkCRLF(addr.name, `${label} name`);
}

export function normalizeMessage(input: EmailMessageInput): EmailMessage {
  if (!input.from) {
    throw new PostboteError('"from" is required', {
      code: "INVALID_MESSAGE",
      provider: "postbote",
    });
  }
  const from = parseAddress(input.from);
  validateAddressCRLF(from, "from");

  const to = normalizeAddressField(input.to);
  if (!to || to.length === 0) {
    throw new PostboteError('At least one recipient in "to" is required', {
      code: "INVALID_MESSAGE",
      provider: "postbote",
    });
  }
  for (const addr of to) validateAddressCRLF(addr, "to");

  if (!input.subject) {
    throw new PostboteError('"subject" is required', {
      code: "INVALID_MESSAGE",
      provider: "postbote",
    });
  }
  checkCRLF(input.subject, "subject");

  if (!input.html && !input.text) {
    throw new PostboteError('At least one of "html" or "text" is required', {
      code: "INVALID_MESSAGE",
      provider: "postbote",
    });
  }

  const cc = normalizeAddressField(input.cc);
  if (cc) for (const addr of cc) validateAddressCRLF(addr, "cc");

  const bcc = normalizeAddressField(input.bcc);
  if (bcc) for (const addr of bcc) validateAddressCRLF(addr, "bcc");

  let replyTo: Address | undefined;
  if (input.replyTo) {
    replyTo = parseAddress(input.replyTo);
    validateAddressCRLF(replyTo, "replyTo");
  }

  if (input.headers) {
    for (const [key, value] of Object.entries(input.headers)) {
      checkCRLF(key, `header key "${key}"`);
      checkCRLF(value, `header "${key}" value`);
    }
  }

  return {
    from,
    to,
    cc,
    bcc,
    replyTo,
    subject: input.subject,
    html: input.html,
    text: input.text,
    attachments: input.attachments ? [...input.attachments] : undefined,
    headers: input.headers ? { ...input.headers } : undefined,
    tags: input.tags ? { ...input.tags } : undefined,
  };
}

export function encodeAttachment(content: Uint8Array): string {
  let binary = "";
  const chunkSize = 8192;
  for (let i = 0; i < content.length; i += chunkSize) {
    const chunk = content.slice(i, i + chunkSize);
    binary += String.fromCharCode(...chunk);
  }
  return btoa(binary);
}
