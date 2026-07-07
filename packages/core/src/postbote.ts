import { normalizeMessage } from "./normalize.js";
import type { Middleware, SendContext } from "./pipeline.js";
import { compose } from "./pipeline.js";
import type { Adapter, EmailMessageInput, SendResult } from "./types.js";

export interface PostboteConfig {
  adapter: Adapter;
  plugins?: Middleware[];
}

export interface Postbote {
  send(input: EmailMessageInput): Promise<SendResult>;
  readonly adapter: Adapter;
}

export function createPostbote(config: PostboteConfig): Postbote {
  const pipeline = compose(config.plugins ?? []);

  return {
    adapter: config.adapter,
    async send(input: EmailMessageInput): Promise<SendResult> {
      const message = normalizeMessage(input);
      const ctx: SendContext = {
        message,
        adapter: config.adapter,
        attempts: [],
      };
      return pipeline(ctx);
    },
  };
}
