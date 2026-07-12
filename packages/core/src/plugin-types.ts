import { toPostboteError } from "./errors.js";
import type { Middleware, SendContext } from "./pipeline.js";
import type {
  EmailMessageInput,
  PluginObject,
  PostbotePlugin,
  SendResult,
} from "./types.js";

type ExtOf<P> = P extends { readonly __inputExt?: infer E } ? E : {};
type UnionToIntersection<U> = (
  U extends unknown
    ? (k: U) => void
    : never
) extends (k: infer I) => void
  ? I
  : {};

export type PluginInputExt<Ps extends readonly any[]> = UnionToIntersection<
  ExtOf<Ps[number]> extends infer R ? (R extends object ? R : {}) : {}
>;

type SendReturnOf<P> = P extends {
  wrapSend?: (run: () => Promise<SendResult>) => infer R;
}
  ? R
  : never;

export type PluginProviderNames<Ps extends readonly any[]> =
  Ps[number] extends infer P
    ? P extends unknown
      ? "__providerNames" extends keyof P
        ? P extends { readonly __providerNames?: infer TNames }
          ? Extract<TNames, string>
          : never
        : never
      : never
    : never;

/** Adapter registry keys referenced by plugins in a tuple. */
export type PluginAdapterKeys<Ps extends readonly any[]> =
  Ps[number] extends infer P
    ? P extends unknown
      ? "__adapterKeys" extends keyof P
        ? P extends { readonly __adapterKeys?: infer TKeys }
          ? Extract<TKeys, string>
          : never
        : never
      : never
    : never;

export type PluginSendReturn<
  Ps extends readonly any[],
  TProvider extends string = string,
> = [SendReturnOf<Ps[number]>] extends [never]
  ? Promise<SendResult<TProvider>>
  : SendReturnOf<Ps[number]>;

export function isPluginObject(plugin: PostbotePlugin): plugin is PluginObject {
  return typeof plugin === "object" && plugin !== null && "name" in plugin;
}

export function getMiddlewares(plugins: readonly any[]): Middleware[] {
  return plugins.map((p) => {
    if (isPluginObject(p)) {
      return (
        p.middleware ??
        ((_ctx: SendContext, next: () => Promise<SendResult>) => next())
      );
    }
    return p;
  });
}

export async function applyTransforms(
  input: EmailMessageInput,
  plugins: readonly any[],
): Promise<EmailMessageInput> {
  let current = input;
  for (const plugin of plugins) {
    if (isPluginObject(plugin) && plugin.transformInput) {
      try {
        current = await plugin.transformInput(current);
      } catch (err) {
        throw toPostboteError(err, "postbote");
      }
    }
  }
  return current;
}
