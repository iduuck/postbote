# @postbote/plugin-hooks

Lifecycle hooks for inspecting, modifying, or cancelling a Postbote send.

```ts
import { createPostbote } from "@postbote/core";
import { hooks } from "@postbote/plugin-hooks";

const postbote = createPostbote({
  adapter,
  plugins: [
    hooks({
      transformMessage: (message) => ({
        ...message,
        headers: { ...message.headers, "X-Campaign": "onboarding" },
        tags: { ...message.tags, campaign: "onboarding" },
      }),
      beforeSend: async (ctx, { cancel }) => {
        if (await isSuppressed(ctx.message.to[0]?.email)) {
          cancel("recipient is suppressed");
        }
      },
      afterSend: (_ctx, result) => audit(result.messageId),
      onError: (_ctx, error) => report(error.code),
    }),
  ],
});
```

## Semantics

- `transformMessage` replaces the normalized email payload before `beforeSend` and the adapter. It can adjust recipients, subject, HTML/text, attachments, headers, and tags. Its return value is normalized again, including CRLF protection.
- `beforeSend` may mutate `ctx.message` or `ctx.adapter`. Errors stop the send.
- `cancel(reason)` stops the send with a non-retryable `CANCELLED` `PostboteError`.
- `afterSend` receives the final `SendResult`.
- `onError` receives the final `PostboteError`.
- Errors thrown by `afterSend` and `onError` are ignored so observers cannot change the send outcome.

Place `hooks()` before `failover()` when the hooks should observe one logical send. Plugin order is outer to inner.

`transformMessage` operates on Postbote's provider-agnostic email model. Provider-specific request fields belong in the relevant adapter or a custom adapter, because only that adapter knows its provider's payload format.

## License

MIT - see [LICENSE.md](LICENSE.md).
