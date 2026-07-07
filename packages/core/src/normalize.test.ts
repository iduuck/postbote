import { describe, expect, it } from "vitest";
import { isPostboteError, PostboteError } from "./errors.js";
import { normalizeMessage, parseAddress } from "./normalize.js";

describe("parseAddress", () => {
  it("parses plain email string", () => {
    expect(parseAddress("a@b.c")).toEqual({ email: "a@b.c" });
  });

  it("parses name + email in angle brackets", () => {
    expect(parseAddress("Nick Mustermann <a@b.c>")).toEqual({
      email: "a@b.c",
      name: "Nick Mustermann",
    });
  });

  it("trims whitespace around address", () => {
    expect(parseAddress("  a@b.c  ")).toEqual({ email: "a@b.c" });
  });

  it("passes Address object through unchanged", () => {
    const addr = { email: "x@y.z", name: "Test" };
    expect(parseAddress(addr)).toBe(addr);
  });

  it("throws INVALID_MESSAGE for address without @", () => {
    try {
      parseAddress("not-an-email");
      expect.unreachable();
    } catch (e) {
      expect(isPostboteError(e)).toBe(true);
      if (e instanceof PostboteError) {
        expect(e.code).toBe("INVALID_MESSAGE");
        expect(e.provider).toBe("postbote");
      }
    }
  });
});

describe("normalizeMessage", () => {
  const minimal = {
    from: "from@test.com",
    to: "to@test.com",
    subject: "Hello",
    text: "Body",
  };

  it("normalizes string from to Address", () => {
    const msg = normalizeMessage(minimal);
    expect(msg.from).toEqual({ email: "from@test.com" });
  });

  it("normalizes single to string to array", () => {
    const msg = normalizeMessage(minimal);
    expect(msg.to).toHaveLength(1);
    expect(msg.to[0]).toEqual({ email: "to@test.com" });
  });

  it("normalizes mixed to array", () => {
    const msg = normalizeMessage({
      ...minimal,
      to: ["a@b.com", { email: "c@d.com", name: "N" }],
    });
    expect(msg.to).toHaveLength(2);
    expect(msg.to[0]).toEqual({ email: "a@b.com" });
    expect(msg.to[1]).toEqual({ email: "c@d.com", name: "N" });
  });

  it("normalizes cc, bcc, replyTo when present", () => {
    const msg = normalizeMessage({
      ...minimal,
      cc: "cc@test.com",
      bcc: ["bcc1@test.com", "bcc2@test.com"],
      replyTo: "reply@test.com",
    });
    expect(msg.cc).toHaveLength(1);
    expect(msg.cc![0]).toEqual({ email: "cc@test.com" });
    expect(msg.bcc).toHaveLength(2);
    expect(msg.replyTo).toEqual({ email: "reply@test.com" });
  });

  it("passes headers and tags through unchanged", () => {
    const headers = { "X-Custom": "value" };
    const tags = { category: "test" };
    const msg = normalizeMessage({ ...minimal, headers, tags });
    expect(msg.headers).toEqual(headers);
    expect(msg.tags).toEqual(tags);
  });

  it("handles Address object in from", () => {
    const msg = normalizeMessage({
      ...minimal,
      from: { email: "obj@test.com", name: "Object" },
    });
    expect(msg.from).toEqual({ email: "obj@test.com", name: "Object" });
  });

  it("throws INVALID_MESSAGE when from is missing", () => {
    const { from, ...rest } = minimal;
    expect(() => normalizeMessage(rest as typeof minimal)).toThrow(
      PostboteError,
    );
  });

  it("throws INVALID_MESSAGE when to is empty", () => {
    expect(() => normalizeMessage({ ...minimal, to: [] })).toThrow(
      PostboteError,
    );
  });

  it("throws INVALID_MESSAGE when subject is missing", () => {
    const { subject, ...rest } = minimal;
    expect(() => normalizeMessage(rest as typeof minimal)).toThrow(
      PostboteError,
    );
  });

  it("throws INVALID_MESSAGE when neither html nor text is present", () => {
    const { text, ...rest } = minimal;
    expect(() => normalizeMessage(rest as typeof minimal)).toThrow(
      PostboteError,
    );
  });

  it("throws INVALID_MESSAGE with correct code for all validation errors", () => {
    const { from, ...rest } = minimal;
    try {
      normalizeMessage(rest as typeof minimal);
      expect.unreachable();
    } catch (e) {
      expect(isPostboteError(e)).toBe(true);
      if (e instanceof PostboteError) {
        expect(e.code).toBe("INVALID_MESSAGE");
        expect(e.retryable).toBe(false);
      }
    }
  });
});
