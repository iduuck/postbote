import { toPostboteError } from "./errors.js";
import { normalizeMessage } from "./normalize.js";
import type { SendContext } from "./pipeline.js";
import { compose } from "./pipeline.js";
import type {
  PluginAdapterKeys,
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
  AdapterFromRegistry,
  AdapterKey,
  AdapterName,
  AdapterRegistry,
  BatchItemResult,
  BatchResult,
  EmailMessage,
  EmailMessageInput,
  PluginObject,
  PostbotePlugin,
  SendOptions,
  SendResult,
} from "./types.js";

type HasDuplicateAdapterNames<
  TRegistry extends AdapterRegistry,
  TSeen extends string = never,
> = TRegistry extends readonly [
  infer TAdapter extends Adapter,
  ...infer TRest extends AdapterRegistry,
]
  ? string extends AdapterName<TAdapter>
    ? false
    : AdapterName<TAdapter> extends TSeen
      ? true
      : HasDuplicateAdapterNames<TRest, TSeen | AdapterName<TAdapter>>
  : false;

type RegistrySupportsPluginKeys<
  TRegistry extends AdapterRegistry,
  Ps extends readonly PostbotePlugin<any, any>[],
> = PluginAdapterKeys<Ps> extends AdapterKey<TRegistry> ? unknown : never;

type UniqueAdapterNames<TRegistry extends AdapterRegistry> =
  HasDuplicateAdapterNames<TRegistry> extends true ? never : unknown;

export interface Postbote<
  TExt = {},
  TSend = Promise<SendResult>,
  TAdapter extends Adapter = Adapter,
> {
  send(input: EmailMessageInput & TExt, options?: SendOptions): TSend;
  sendBatch(
    inputs: Array<EmailMessageInput & TExt>,
    options?: SendOptions & { concurrency?: number },
  ): Promise<BatchResult>;
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
  registry?: never;
  plugins?: Ps;
}): Postbote<
  PluginInputExt<Ps>,
  PluginSendReturn<Ps, AdapterName<TAdapter> | PluginProviderNames<Ps>>,
  TAdapter
>;

export function createPostbote<
  const TRegistry extends AdapterRegistry,
  const TAdapterKey extends AdapterKey<TRegistry>,
  const Ps extends readonly PostbotePlugin<any, any>[] = [],
>(
  config: {
    registry: TRegistry;
    adapter: TAdapterKey;
    plugins?: Ps;
  } & UniqueAdapterNames<TRegistry> &
    RegistrySupportsPluginKeys<TRegistry, Ps>,
): Postbote<
  PluginInputExt<Ps>,
  PluginSendReturn<
    Ps,
    | AdapterName<AdapterFromRegistry<TRegistry, TAdapterKey>>
    | PluginProviderNames<Ps>
  >,
  AdapterFromRegistry<TRegistry, TAdapterKey>
>;

export function createPostbote(
  config:
    | {
        adapter: Adapter;
        registry?: never;
        plugins?: readonly PostbotePlugin[];
      }
    | {
        registry: AdapterRegistry;
        adapter: string;
        plugins?: readonly PostbotePlugin[];
      },
): Postbote {
  return createPostboteInternal(config);
}

function createPostboteInternal(
  config:
    | {
        adapter: Adapter;
        registry?: never;
        plugins?: readonly PostbotePlugin[];
      }
    | {
        registry: AdapterRegistry;
        adapter: string;
        plugins?: readonly PostbotePlugin[];
      },
): Postbote {
  const registry = config.registry ?? [config.adapter];
  const adapter =
    typeof config.adapter === "string"
      ? registry.find((candidate) => candidate.name === config.adapter)
      : config.adapter;

  if (!adapter) {
    throw new TypeError(`Adapter "${config.adapter}" is not in the registry`);
  }

  if (
    new Set(registry.map((candidate) => candidate.name)).size !==
    registry.length
  ) {
    throw new TypeError("Adapter registry names must be unique");
  }

  const plugins = config.plugins ?? [];
  const middlewares = getMiddlewares(plugins);
  const pipeline = compose(middlewares);
  const wrapSend = findWrapSend(plugins);

  const runOne = async (
    input: EmailMessageInput,
    options?: SendOptions,
  ): Promise<SendResult> => {
    const transformed = await applyTransforms(input, plugins);
    const message = normalizeMessage(transformed);
    const ctx: SendContext = {
      message,
      adapter,
      registry,
      attempts: [],
      signal: options?.signal,
      idempotencyKey: options?.idempotencyKey,
    };
    return pipeline(ctx);
  };

  return {
    adapter,
    async send(
      input: EmailMessageInput,
      options?: SendOptions,
    ): Promise<SendResult> {
      const run = () => runOne(input, options);
      return wrapSend ? wrapSend(run) : run();
    },
    async sendBatch(
      inputs: EmailMessageInput[],
      options?: SendOptions & { concurrency?: number },
    ): Promise<BatchResult> {
      const results: Array<BatchItemResult | undefined> = new Array(
        inputs.length,
      );
      const valid: Array<{ index: number; message: EmailMessage }> = [];

      await Promise.all(
        inputs.map(async (input, index) => {
          try {
            const transformed = await applyTransforms(input, plugins);
            valid.push({ index, message: normalizeMessage(transformed) });
          } catch (err) {
            results[index] = {
              status: "failed",
              error: toPostboteError(err, "postbote"),
            };
          }
        }),
      );

      valid.sort((a, b) => a.index - b.index);
      if (adapter.sendBatch) {
        const batchResults = await adapter.sendBatch(
          valid.map(({ message }) => message),
          options,
        );
        for (let i = 0; i < valid.length; i++) {
          const entry = valid[i];
          const batchResult = batchResults[i];
          if (entry && batchResult) results[entry.index] = batchResult;
        }
      } else {
        const concurrency = Math.max(1, Math.floor(options?.concurrency ?? 5));
        let cursor = 0;
        const worker = async () => {
          while (cursor < valid.length) {
            const entry = valid[cursor++];
            if (!entry) return;
            try {
              results[entry.index] = {
                status: "sent",
                result: await runOne(inputs[entry.index]!, options),
              };
            } catch (err) {
              results[entry.index] = {
                status: "failed",
                error: toPostboteError(err, adapter.name),
              };
            }
          }
        };
        await Promise.all(
          Array.from({ length: Math.min(concurrency, valid.length) }, worker),
        );
      }

      const completed = results.filter(
        (result): result is BatchItemResult => result !== undefined,
      );
      const sentCount = completed.filter(
        (result) => result.status === "sent",
      ).length;
      return {
        results: completed,
        sentCount,
        failedCount: completed.length - sentCount,
      };
    },
  };
}
