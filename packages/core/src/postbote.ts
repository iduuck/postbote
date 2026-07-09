import { normalizeMessage } from "./normalize.js";
import type { Middleware, SendContext } from "./pipeline.js";
import { compose } from "./pipeline.js";
import type { PluginInputExt, PluginSendReturn } from "./plugin-types.js";
import { applyTransforms, getMiddlewares } from "./plugin-types.js";
import type {
  Adapter,
  EmailMessageInput,
  PostbotePlugin,
  SendOptions,
  SendResult,
} from "./types.js";

export interface Postbote<TExt = {}, TSend = Promise<SendResult>> {
  send(
    input: EmailMessageInput & TExt,
    options?: SendOptions,
  ): TSend;
  readonly adapter: Adapter;
}

export function createPostbote<
  const Ps extends readonly PostbotePlugin[] = [],
>(
  config: { adapter: Adapter; plugins?: Ps },
): Postbote<PluginInputExt<Ps>, PluginSendReturn<Ps>> {
  const middlewares = getMiddlewares(config.plugins ?? []);
  const pipeline = compose(middlewares);

  return {
    adapter: config.adapter,
    async send(
      input: EmailMessageInput,
      options?: SendOptions,
    ): Promise<SendResult> {
      const transformed = await applyTransforms(
        input,
        config.plugins ?? [],
      );
      const message = normalizeMessage(transformed);
      const ctx: SendContext = {
        message,
        adapter: config.adapter,
        attempts: [],
        signal: options?.signal,
      };
      return pipeline(ctx);
    },
  } as Postbote<PluginInputExt<Ps>, PluginSendReturn<Ps>>;
}