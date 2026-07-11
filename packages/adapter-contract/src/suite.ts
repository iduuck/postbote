import type { Adapter, ErrorCode } from "@postbote/core";
import { isPostboteError } from "@postbote/core";
import { beforeEach, describe, expect, it } from "vitest";
import { fixtures } from "./fixtures.js";

export type FailureKind =
  | "auth"
  | "rateLimited"
  | "unavailable"
  | "timeout"
  | "invalidMessage"
  | "recipientRejected"
  | "networkError";

export interface AdapterContractOptions {
  name: string;
  createAdapter: () => Adapter;
  interceptor: {
    success(messageId: string): void;
    failure(kind: FailureKind): void;
    reset(): void;
  };
  skip?: FailureKind[];
  /** Some transports generate their message ID client-side. */
  skipMessageIdEquality?: boolean;
  secret?: string;
  retryAfterMs?: number;
}

const expectedCode: Record<FailureKind, ErrorCode> = {
  auth: "AUTH",
  rateLimited: "RATE_LIMITED",
  unavailable: "PROVIDER_UNAVAILABLE",
  timeout: "TIMEOUT",
  invalidMessage: "INVALID_MESSAGE",
  recipientRejected: "RECIPIENT_REJECTED",
  networkError: "PROVIDER_UNAVAILABLE",
};

const expectedRetryable: Record<FailureKind, boolean> = {
  auth: false,
  rateLimited: true,
  unavailable: true,
  timeout: true,
  invalidMessage: false,
  recipientRejected: false,
  networkError: true,
};

export function runAdapterContractTests(opts: AdapterContractOptions): void {
  const { name, createAdapter, interceptor, skip = [] } = opts;

  describe(`Adapter contract: ${name}`, () => {
    beforeEach(() => {
      interceptor.reset();
    });

    describe("successful sends", () => {
      for (const [label, message] of Object.entries(fixtures)) {
        it(`sends "${label}" message successfully`, async () => {
          const adapter = createAdapter();
          const messageId = `${label}-id`;
          interceptor.success(messageId);

          const result = await adapter.send(message);

          expect(result).toBeDefined();
          if (!opts.skipMessageIdEquality) {
            expect(result.messageId).toBe(messageId);
          }
          expect(result.provider).toBe(adapter.name);
          expect(result.raw).toBeDefined();
        });
      }
    });

    describe("error handling", () => {
      const kinds: FailureKind[] = [
        "auth",
        "rateLimited",
        "unavailable",
        "timeout",
        "invalidMessage",
        "recipientRejected",
        "networkError",
      ];

      for (const kind of kinds) {
        if (skip.includes(kind)) {
          continue;
        }

        it(`handles "${kind}" error`, async () => {
          const adapter = createAdapter();
          interceptor.failure(kind);

          let err: unknown;
          try {
            await adapter.send(fixtures.minimal);
            expect.unreachable("adapter should have thrown");
          } catch (caught) {
            err = caught;
          }

          expect(isPostboteError(err)).toBe(true);
          if (!isPostboteError(err)) return;

          expect(err.code).toBe(expectedCode[kind]);
          expect(err.retryable).toBe(expectedRetryable[kind]);
          expect(err.provider).toBe(adapter.name);
          expect(err.cause).toBeDefined();
          if (kind === "rateLimited" && opts.retryAfterMs !== undefined) {
            expect(err.retryAfterMs).toBe(opts.retryAfterMs);
          }
        });
      }

      it("never throws raw errors", async () => {
        const adapter = createAdapter();
        interceptor.failure("auth");

        try {
          await adapter.send(fixtures.minimal);
          expect.unreachable();
        } catch (err) {
          expect(isPostboteError(err)).toBe(true);
        }
      });
    });

    describe("behavioural rules", () => {
      it("has stable lowercase name", () => {
        const adapter = createAdapter();
        expect(adapter.name).toBe(name);
      });

      it("does not mutate the message (deep-freeze)", async () => {
        const adapter = createAdapter();
        interceptor.success("frozen-id");

        const message = deepFreeze(structuredClone(fixtures.minimal));

        await expect(adapter.send(message)).resolves.toBeDefined();
      });

      it("does not leak API key in errors", async () => {
        const adapter = createAdapter();
        interceptor.failure("auth");

        try {
          await adapter.send(fixtures.minimal);
          expect.unreachable();
        } catch (err) {
          const serialized =
            JSON.stringify(err) +
            String((err as { cause?: unknown }).cause ?? "");
          if (opts.secret) {
            expect(serialized).not.toContain(opts.secret);
          } else {
            expect(serialized).not.toMatch(/sk_live|sk_test|re_|SG\.|pma_/);
          }
        }
      });

      it("respects already-aborted AbortSignal", async () => {
        const adapter = createAdapter();
        const ac = new AbortController();
        ac.abort(new DOMException("Aborted", "AbortError"));

        await expect(
          adapter.send(fixtures.minimal, { signal: ac.signal }),
        ).rejects.toMatchObject({
          code: "ABORTED",
          provider: adapter.name,
        });
      });
    });
  });
}

function deepFreeze<T>(obj: T): T {
  if (obj === null || typeof obj !== "object") {
    return obj;
  }
  if (obj instanceof Uint8Array || obj instanceof ArrayBuffer) {
    return obj;
  }
  if (Array.isArray(obj)) {
    for (const item of obj) {
      deepFreeze(item);
    }
    return Object.freeze(obj) as unknown as T;
  }
  for (const value of Object.values(obj as Record<string, unknown>)) {
    deepFreeze(value);
  }
  return Object.freeze(obj);
}
