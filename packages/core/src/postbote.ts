import { normalizeMessage } from "./normalize.js";
import type { SendContext } from "./pipeline.js";
import { compose } from "./pipeline.js";
import type {
  PluginInputExt,
  PluginProviderNames,
  PluginSendReturn,
} from "./plugin-types.js";
import {
  applyTransforms,
  getMiddlewares,
  isPluginObject,
} from "./plugin-types.js";
import type {
  Adapter,
  AdapterName,
  EmailMessageInput,
  PluginObject,
  PostbotePlugin,
  SendOptions,
  SendResult,
} from "./types.js";

export interface Postbote<
  TExt = {},
  TSend = Promise<SendResult>,
  TAdapter extends Adapter = Adapter,
> {
  send(input: EmailMessageInput & TExt, options?: SendOptions): TSend;
  readonly adapter: TAdapter;
}

function findWrapSend(
  plugins: readonly any[],
): PluginObject<{}, never>["wrapSend"] | undefined {
  const wrapSends = plugins.filter(
    (
      p,
    ): p is PluginObject & {
      wrapSend: NonNullable<PluginObject["wrapSend"]>;
    } => isPluginObject(p) && typeof p.wrapSend === "function",
  );
  if (wrapSends.length > 1) {
    const names = wrapSends.map((p) => p.name).join(", ");
    throw new TypeError(
      `At most one plugin with wrapSend is allowed, but found ${wrapSends.length}: ${names}`,
    );
  }
  return wrapSends[0]?.wrapSend;
}

export function createPostbote<
  const TAdapter extends Adapter,
  const Ps extends readonly PostbotePlugin<any, any>[] = [],
>(config: {
  adapter: TAdapter;
  plugins?: Ps;
}): Postbote<
  PluginInputExt<Ps>,
  PluginSendReturn<Ps, AdapterName<TAdapter> | PluginProviderNames<Ps>>,
  TAdapter
> {
  const plugins = config.plugins ?? [];
  const middlewares = getMiddlewares(plugins);
  const pipeline = compose(middlewares);
  const wrapSend = findWrapSend(plugins);

  return {
    adapter: config.adapter,
    async send(
      input: EmailMessageInput,
      options?: SendOptions,
    ): Promise<SendResult> {
      const run = async (): Promise<SendResult> => {
        const transformed = await applyTransforms(input, plugins);
        const message = normalizeMessage(transformed);
        const ctx: SendContext = {
          message,
          adapter: config.adapter,
          attempts: [],
          signal: options?.signal,
        };
        return pipeline(ctx);
      };
      return wrapSend ? wrapSend(run) : run();
    },
  } as unknown as Postbote<
    PluginInputExt<Ps>,
    PluginSendReturn<Ps, AdapterName<TAdapter> | PluginProviderNames<Ps>>,
    TAdapter
  >;
}
