import type { PluginObject } from "@postbote/core";
import { toPostboteError } from "@postbote/core";
import { render } from "@react-email/render";
import type { ReactElement } from "react";

export interface ReactEmailExt {
  /**
   * React component to render as the email body.
   * Uses ReactElement (not ReactNode) to prevent accidental string usage.
   * When set, the plugin renders it to html (and optionally text).
   */
  body?: ReactElement;
}

export interface ReactEmailOptions {
  /**
   * Whether to also render a plaintext variant.
   * If true and no explicit `text` is provided, `text` is auto-generated.
   * @default true
   */
  plainText?: boolean;
}

export function reactEmail(
  options?: ReactEmailOptions,
): PluginObject<ReactEmailExt> {
  const plainText = options?.plainText ?? true;

  return {
    name: "react-email",
    async transformInput(input) {
      const body = (input as unknown as Record<string, unknown>).body;
      if (!body) return input;

      try {
        const html = await render(body as ReactElement);
        return {
          ...input,
          html,
          ...(plainText && !input.text
            ? { text: await render(body as ReactElement, { plainText: true }) }
            : {}),
        } as typeof input;
      } catch (err) {
        throw toPostboteError(err, "plugin-react-email");
      }
    },
  };
}
