import type { EmailMessage, Middleware } from "@postbote/core";

export interface DryRunOptions {
  enabled?: boolean;
  onSend?: (message: EmailMessage) => void;
}

export function dryRun(options: DryRunOptions = {}): Middleware {
  let counter = 0;
  return async (ctx, next) => {
    if (options.enabled === false) return next();
    try {
      options.onSend?.(ctx.message);
    } catch {}
    ctx.attempts.push({ adapter: "dry-run" });
    return {
      messageId: `dry-run-${++counter}`,
      provider: "dry-run",
      raw: { dryRun: true },
    };
  };
}
