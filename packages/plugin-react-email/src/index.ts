import { type PluginObject, PostboteError } from "@postbote/core";
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
      const { body, ...message } = input;
      if (!body) return input;

      try {
        const html = await render(body);
        return {
          ...message,
          html,
          ...(plainText && !message.text
            ? { text: await render(body, { plainText: true }) }
            : {}),
        };
      } catch (err) {
        throw new PostboteError(
          err instanceof Error ? err.message : "Failed to render email",
          {
            code: "INVALID_MESSAGE",
            provider: "plugin-react-email",
            cause: err,
          },
        );
      }
    },
  };
}
