# @postbote/plugin-better-result

Return `better-result` values from `postbote.send()` instead of throwing.

```ts
import { createPostbote } from "@postbote/core";
import { betterResult } from "@postbote/plugin-better-result";

const postbote = createPostbote({ adapter, plugins: [betterResult()] });
const result = await postbote.send(message);

const messageId = result.match({
  ok: (sent) => sent.messageId,
  err: (error) => `failed: ${error.code}`,
});
```

The inferred return type is `Promise<Result<SendResult, PostboteError>>`. Without the plugin, `send()` remains `Promise<SendResult>` and rejects on failure.

The wrapper covers input transformation, validation, middleware, and adapter execution. Consequently aborts and hook cancellations become `Err` values with code `ABORTED` or `CANCELLED`, not exceptions.
It uses `better-result@^2.9.2` and its object-form `Result.tryPromise({ try, catch })` API; the package is ESM and runtime-neutral.

Only one plugin with the core `wrapSend` capability may be configured. Combining independent capabilities works in either tuple order:

```ts
plugins: [reactEmail(), betterResult()]
```

This adds the React `body` input and the `Result` return type simultaneously.

## License

MIT - see [LICENSE.md](LICENSE.md).
