import { normalizeMessage } from "./normalize.js";
import type { Middleware, SendContext } from "./pipeline.js";
import { compose } from "./pipeline.js";
import type {
  Adapter,
  EmailMessageInput,
  SendOptions,
  SendResult,
} from "./types.js";

export interface PostboteConfig {
  adapter: Adapter;
  plugins?: Middleware[];
}

export interface Postbote {
  send(input: EmailMessageInput, options?: SendOptions): Promise<SendResult>;
  readonly adapter: Adapter;
}

export function createPostbote(config: PostboteConfig): Postbote {
  const pipeline = compose(config.plugins ?? []);

  return {
    adapter: config.adapter,
    async send(
      input: EmailMessageInput,
      options?: SendOptions,
    ): Promise<SendResult> {
      const message = normalizeMessage(input);
      const ctx: SendContext = {
        message,
        adapter: config.adapter,
        attempts: [],
        signal: options?.signal,
      };
      return pipeline(ctx);
    },
  };
}
