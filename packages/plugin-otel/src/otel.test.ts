import {
  BasicTracerProvider,
  InMemorySpanExporter,
  SimpleSpanProcessor,
} from "@opentelemetry/sdk-trace-base";
import { createPostbote, type SendContext } from "@postbote/core";
import { failover } from "@postbote/plugin-failover";
import { createTestAdapter } from "@postbote/testing";
import { describe, expect, it } from "vitest";
import { otel } from "./index.js";

describe("otel", () => {
  it("creates a span with OK status on success", async () => {
    const exporter = new InMemorySpanExporter();
    const provider = new BasicTracerProvider();
    provider.addSpanProcessor(new SimpleSpanProcessor(exporter));

    const pb = createPostbote({
      adapter: createTestAdapter({ name: "test" }),
      plugins: [otel({ tracer: provider.getTracer("test") })],
    });
    await pb.send({
      from: "f@t.com",
      to: "t@t.com",
      subject: "s",
      html: "<p>hi</p>",
    });

    await new Promise((r) => setTimeout(r, 50));
    const spans = exporter.getFinishedSpans();
    expect(spans.length).toBe(1);
    expect(spans[0]?.name).toBe("postbote.send");
    expect(spans[0]?.status.code).toBe(1);
    expect(spans[0]?.attributes["postbote.provider"]).toBe("test");
  });

  it("sets status ERROR on failure", async () => {
    const exporter = new InMemorySpanExporter();
    const provider = new BasicTracerProvider();
    provider.addSpanProcessor(new SimpleSpanProcessor(exporter));
    const tracer = provider.getTracer("test");

    const badAdapter = createTestAdapter({ name: "bad" });
    badAdapter.failAlways("PROVIDER_UNAVAILABLE");
    const pb = createPostbote({
      adapter: badAdapter,
      plugins: [otel({ tracer })],
    });
    await expect(
      pb.send({
        from: "f@t.com",
        to: "t@t.com",
        subject: "s",
        html: "<p>hi</p>",
      }),
    ).rejects.toMatchObject({ code: "PROVIDER_UNAVAILABLE" });

    await new Promise((r) => setTimeout(r, 50));
    const spans = exporter.getFinishedSpans();
    expect(spans.length).toBe(1);
    expect(spans[0]?.status.code).toBe(2);
    expect(spans[0]?.attributes["postbote.error_code"]).toBe(
      "PROVIDER_UNAVAILABLE",
    );
  });

  it("works without a registered tracer provider (no-op)", async () => {
    const pb = createPostbote({
      adapter: createTestAdapter({ name: "test" }),
      plugins: [otel()],
    });
    const result = await pb.send({
      from: "f@t.com",
      to: "t@t.com",
      subject: "s",
      html: "<p>hi</p>",
    });
    expect(result.messageId).toBeTruthy();
  });

  it("captureRecipients: none omits recipient_count", async () => {
    const exporter = new InMemorySpanExporter();
    const provider = new BasicTracerProvider();
    provider.addSpanProcessor(new SimpleSpanProcessor(exporter));

    const pb = createPostbote({
      adapter: createTestAdapter({ name: "test" }),
      plugins: [
        otel({
          tracer: provider.getTracer("test"),
          captureRecipients: "none",
        }),
      ],
    });
    await pb.send({
      from: "f@t.com",
      to: "t@t.com",
      subject: "s",
      html: "<p>hi</p>",
    });

    await new Promise((r) => setTimeout(r, 50));
    const spans = exporter.getFinishedSpans();
    expect(spans.length).toBe(1);
    expect(spans[0]?.attributes["postbote.recipient_count"]).toBeUndefined();
  });

  it("records failed attempts and the final failover provider", async () => {
    const exporter = new InMemorySpanExporter();
    const provider = new BasicTracerProvider();
    provider.addSpanProcessor(new SimpleSpanProcessor(exporter));
    const primary = createTestAdapter({ name: "primary" });
    const fallback = createTestAdapter({ name: "fallback" });
    primary.failNext("PROVIDER_UNAVAILABLE");

    const pb = createPostbote({
      adapter: primary,
      plugins: [
        otel({ tracer: provider.getTracer("test") }),
        failover({ fallbacks: [fallback] }),
      ],
    });
    await pb.send({
      from: "f@t.com",
      to: "t@t.com",
      subject: "s",
      html: "<p>hi</p>",
    });

    await new Promise((resolve) => setTimeout(resolve, 50));
    const span = exporter.getFinishedSpans()[0];
    expect(span?.attributes["postbote.provider"]).toBe("fallback");
    expect(span?.attributes["postbote.attempt_count"]).toBe(2);
    expect(span?.events).toContainEqual(
      expect.objectContaining({
        name: "postbote.attempt",
        attributes: expect.objectContaining({
          adapter: "primary",
          "error.code": "PROVIDER_UNAVAILABLE",
        }),
      }),
    );
  });

  it("records raw errors as UNKNOWN", async () => {
    const exporter = new InMemorySpanExporter();
    const provider = new BasicTracerProvider();
    provider.addSpanProcessor(new SimpleSpanProcessor(exporter));
    const adapter = createTestAdapter({ name: "test" });
    const ctx: SendContext = {
      adapter,
      attempts: [],
      message: {
        from: { email: "f@t.com" },
        to: [{ email: "t@t.com" }],
        subject: "s",
        html: "<p>hi</p>",
      },
    };

    await expect(
      otel({ tracer: provider.getTracer("test") })(ctx, async () => {
        throw "raw error";
      }),
    ).rejects.toBe("raw error");

    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(
      exporter.getFinishedSpans()[0]?.attributes["postbote.error_code"],
    ).toBe("UNKNOWN");
  });
});
