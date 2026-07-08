# @postbote/plugin-failover

Automatisches Ausweichen auf Fallback-Adapter bei Provider-Ausfällen.

```ts
import { createPostbote } from "@postbote/core";
import { resend } from "@postbote/adapter-resend";
import { postmark } from "@postbote/adapter-postmark";
import { failover } from "@postbote/plugin-failover";

const postbote = createPostbote({
  adapter: resend({ apiKey: env.RESEND_KEY }),
  plugins: [
    failover({
      fallbacks: [postmark({ serverToken: env.POSTMARK_TOKEN })],
      onFailover: ({ from, to, error }) =>
        logger.warn(`failover ${from} → ${to}: ${error.code}`),
    }),
  ],
});
```

## Semantik

1. **Adapter-Kette** = `[ctx.adapter, ...fallbacks]` — der primäre Adapter aus der Postbote-Config ist immer der erste Versuch.
2. **Pro Adapter**: `ctx.adapter = adapter; await next()`. Erfolg → Ergebnis sofort zurück.
3. **Fehler** → `shouldFailover(error, ctx)`:
   - `false` (z. B. `INVALID_MESSAGE`, `RECIPIENT_REJECTED`, `AUTH`) → Fehler **sofort unverändert** weiterwerfen. Kein Fallback probiert.
   - `true` → `onFailover` feuern, nächsten Adapter probieren.
4. **Kette erschöpft** → `FailoverExhaustedError` mit komplettem `attempts`-Protokoll.
5. **Kein eigener Retry** auf demselben Adapter — das ist die Aufgabe eines Retry-Plugins (Komposition: `plugins: [failover(...), retry(...)]`).

## Plugin-Reihenfolge

`plugins`-Array = **außen → innen**.

- `failover` möglichst **weit innen** (letztes Element), damit äußere Plugins (Logging, Metriken) den Send als *eine* Operation mit finalem Ergebnis sehen.
- Ein Plugin **hinter** failover (weiter innen) läuft pro `next()`-Aufruf und damit pro Versuch — es muss idempotent sein.

```ts
// Empfohlen: failover innen
plugins: [logging, metrics, failover({ fallbacks: [...] })]

// Nur wenn du jeden Versuch einzeln sehen willst:
plugins: [failover({ fallbacks: [...] }), perAttemptPlugin]
```

## API

### `failover(options)`

| Option | Typ | Default | Beschreibung |
|---|---|---|---|
| `fallbacks` | `Adapter[]` | — | Fallback-Adapter in Prioritäts-Reihenfolge |
| `shouldFailover?` | `(error, ctx) => boolean` | `(e) => e.retryable` | Entscheidet, ob bei einem Fehler der nächste Adapter probiert wird |
| `onFailover?` | `(info) => void` | — | Hook vor jedem Wechsel. Werfende Hooks brechen den Versand nicht ab. |

### `FailoverExhaustedError`

```ts
class FailoverExhaustedError extends PostboteError {
  readonly attempts: readonly SendAttempt[];
  // code: "PROVIDER_UNAVAILABLE", retryable: true, provider: "failover"
}
```

## License

MIT — see [LICENSE.md](LICENSE.md).
