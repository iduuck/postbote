# @postbote/plugin-logger

Structured lifecycle events for Postbote. The plugin does not choose a logging framework or write to the console.

```ts
import { logger } from "@postbote/plugin-logger";

const logging = logger({
  capture: "counts",
  onEvent: (event) => appLogger.info(event),
});
```

## Capture

| Value | Recipient data on `send:start` |
|---|---|
| `"none"` | No recipient fields |
| `"counts"` | `toCount` only (default) |
| `"full"` | `toCount` and `to` addresses |

## Events

- `send:start`: initial provider, timestamp, and configured recipient data.
- `send:success`: final provider, message ID, duration, and attempt count.
- `send:error`: normalized error data, duration, and attempt count.
- `attempt:error`: adapter, attempt index, error code, and retryability.

Events contain plain JSON-compatible data, not `Error` instances. Exceptions from `onEvent` are ignored. Place `logger()` before `failover()` to observe one logical send and receive post-hoc events for failed attempts.

## License

MIT - see [LICENSE.md](LICENSE.md).
