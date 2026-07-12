import type { Address, Middleware } from "@postbote/core";
import { formatAddress, parseAddress } from "@postbote/core";

export interface RedirectOptions {
  to: string | Address | Array<string | Address>;
  subjectPrefix?: string;
  preserveHeaders?: boolean;
}

export function redirect(options: RedirectOptions): Middleware {
  const destinations = (
    Array.isArray(options.to) ? options.to : [options.to]
  ).map(parseAddress);
  if (destinations.length === 0)
    throw new TypeError("At least one redirect recipient is required");
  return async (ctx, next) => {
    const headers = { ...ctx.message.headers };
    if (options.preserveHeaders !== false) {
      headers["X-Original-To"] = ctx.message.to.map(formatAddress).join(", ");
      if (ctx.message.cc?.length)
        headers["X-Original-Cc"] = ctx.message.cc.map(formatAddress).join(", ");
      if (ctx.message.bcc?.length)
        headers["X-Original-Bcc"] = ctx.message.bcc
          .map(formatAddress)
          .join(", ");
    }
    ctx.message = {
      ...ctx.message,
      to: destinations.map((address) => ({ ...address })),
      cc: undefined,
      bcc: undefined,
      subject: `${options.subjectPrefix ?? ""}${ctx.message.subject}`,
      headers: Object.keys(headers).length ? headers : undefined,
    };
    return next();
  };
}
