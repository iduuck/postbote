# @postbote/plugin-otel

OpenTelemetry tracing for Postbote sends.

```ts
import { otel } from "@postbote/plugin-otel";

const tracing = otel({
  tracer: tracerProvider.getTracer("mail"),
  captureRecipients: "count",
});
```

If no tracer is provided, the plugin uses `trace.getTracer("@postbote/plugin-otel")`. The OpenTelemetry API is a no-op when no provider is registered.

## Span Reference

Each send creates one `postbote.send` client span.

| Attribute | Description |
|---|---|
| `postbote.provider` | Adapter used by the send |
| `postbote.message_id` | Provider message ID on success |
| `postbote.attempt_count` | Number of adapter attempts |
| `postbote.recipient_count` | Recipient count unless capture is `"none"` |
| `postbote.error_code` | Postbote error code on failure |

Failed attempts are recorded as `postbote.attempt` span events. Errors are recorded as exceptions and set the span status to `ERROR`. Addresses, subject, and body are never captured.

Place `otel()` before `failover()` to trace one logical send.

## License

MIT - see [LICENSE.md](LICENSE.md).
