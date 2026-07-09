import type { Middleware, SendContext } from "./pipeline.js";
import type {
  EmailMessageInput,
  PluginObject,
  PostbotePlugin,
  SendResult,
} from "./types.js";

type ExtOf<P> = P extends PluginObject<infer E, unknown> ? E : {};
type UnionToIntersection<U> = (
  U extends unknown ? (k: U) => void : never
) extends (k: infer I) => void
  ? I
  : {};

export type PluginInputExt<Ps extends readonly PostbotePlugin[]> =
  UnionToIntersection<ExtOf<Ps[number]> extends infer R
    ? R extends Record<string, unknown>
      ? R
      : {}
    : {}>;

type SendReturnOf<P> = P extends PluginObject<unknown, infer R> ? R : never;

export type PluginSendReturn<Ps extends readonly PostbotePlugin[]> =
  [SendReturnOf<Ps[number]>] extends [never]
    ? Promise<SendResult>
    : SendReturnOf<Ps[number]>;

export function isPluginObject(
  plugin: PostbotePlugin,
): plugin is PluginObject {
  return typeof plugin === "object" && plugin !== null && "name" in plugin;
}

export function getMiddlewares(plugins: readonly PostbotePlugin[]): Middleware[] {
  return plugins.map((p) => {
    if (isPluginObject(p)) {
      return p.middleware ?? ((_ctx: SendContext, next: () => Promise<SendResult>) => next());
    }
    return p;
  });
}

export async function applyTransforms(
  input: EmailMessageInput,
  plugins: readonly PostbotePlugin[],
): Promise<EmailMessageInput> {
  let current = input;
  for (const plugin of plugins) {
    if (isPluginObject(plugin) && plugin.transformInput) {
      current = await plugin.transformInput(current);
    }
  }
  return current;
}