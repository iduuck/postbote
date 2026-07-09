import { describe, expect, it } from "vitest";
import { otel } from "./index.js";
import { createPostbote } from "@postbote/core";
import { createTestAdapter } from "@postbote/testing";
import {
  InMemorySpanExporter,
  SimpleSpanProcessor,
  BasicTracerProvider,
} from "@opentelemetry/sdk-trace-base";

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
      plugins: [otel({
        tracer: provider.getTracer("test"),
        captureRecipients: "none",
      })],
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
    expect(
      spans[0]?.attributes["postbote.recipient_count"],
    ).toBeUndefined();
  });
});