import { describe, expect, it } from "vitest";
import { isPostboteError, PostboteError } from "./errors.js";
import {
  encodeAttachment,
  formatAddress,
  normalizeMessage,
  parseAddress,
} from "./normalize.js";

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

  it("throws INVALID_MESSAGE when angle bracket content has no @", () => {
    expect(() => parseAddress("Nick <keine-email>")).toThrow(PostboteError);
  });

  it("allows @ in display name when email is valid", () => {
    const result = parseAddress('"Nick @ Home" <n@t.com>');
    expect(result.email).toBe("n@t.com");
  });

  it("throws INVALID_MESSAGE for Address object with empty email", () => {
    expect(() => parseAddress({ email: "" })).toThrow(PostboteError);
  });

  it("throws INVALID_MESSAGE for Address object without @ in email", () => {
    expect(() => parseAddress({ email: "no-at" })).toThrow(PostboteError);
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
    expect(msg.cc?.[0]).toEqual({ email: "cc@test.com" });
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
    const { from: _, ...rest } = minimal;
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
    const { subject: _, ...rest } = minimal;
    expect(() => normalizeMessage(rest as typeof minimal)).toThrow(
      PostboteError,
    );
  });

  it("throws INVALID_MESSAGE when neither html nor text is present", () => {
    const { text: _, ...rest } = minimal;
    expect(() => normalizeMessage(rest as typeof minimal)).toThrow(
      PostboteError,
    );
  });

  it("throws INVALID_MESSAGE with correct code for all validation errors", () => {
    const { from: _, ...rest } = minimal;
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

describe("CRLF injection protection", () => {
  const minimal = {
    from: "f@t.com",
    to: "t@t.com",
    subject: "S",
    text: "B",
  };

  it("rejects subject with CR", () => {
    expect(() =>
      normalizeMessage({ ...minimal, subject: "bad\rsubject" }),
    ).toThrow(PostboteError);
  });

  it("rejects subject with LF", () => {
    expect(() =>
      normalizeMessage({ ...minimal, subject: "bad\nsubject" }),
    ).toThrow(PostboteError);
  });

  it("rejects from name with CRLF", () => {
    expect(() =>
      normalizeMessage({
        ...minimal,
        from: { email: "f@t.com", name: "foo\r\nbar" },
      }),
    ).toThrow(PostboteError);
  });

  it("rejects to name with CRLF", () => {
    expect(() =>
      normalizeMessage({
        ...minimal,
        to: [{ email: "t@t.com", name: "inject\n" }],
      }),
    ).toThrow(PostboteError);
  });

  it("rejects header key with CRLF", () => {
    expect(() =>
      normalizeMessage({
        ...minimal,
        headers: { "X-Injected\r\n": "value" },
      }),
    ).toThrow(PostboteError);
  });

  it("rejects header value with CRLF", () => {
    expect(() =>
      normalizeMessage({
        ...minimal,
        headers: { "X-Custom": "safe\r\ninjected" },
      }),
    ).toThrow(PostboteError);
  });

  it("rejects from email with embedded CRLF (object form)", () => {
    expect(() =>
      normalizeMessage({
        ...minimal,
        from: { email: "a@b.c\r\nBcc: evil@x.com" },
      }),
    ).toThrow(PostboteError);
  });

  it("rejects to email with embedded CRLF (object form)", () => {
    expect(() =>
      normalizeMessage({
        ...minimal,
        to: [{ email: "a@b.c\nCc: evil@x.com" }],
      }),
    ).toThrow(PostboteError);
  });

  it("rejects from string with CRLF before @", () => {
    expect(() =>
      normalizeMessage({
        ...minimal,
        from: "a\r@b.c",
      }),
    ).toThrow(PostboteError);
  });

  it("rejects angle-bracket address with CRLF in email part", () => {
    expect(() =>
      normalizeMessage({
        ...minimal,
        from: "Name <a@b.c\n>",
      }),
    ).toThrow(PostboteError);
  });
});

describe("formatAddress", () => {
  it("returns email only when no name", () => {
    expect(formatAddress({ email: "a@b.com" })).toBe("a@b.com");
  });

  it("formats with simple name (no quoting)", () => {
    expect(formatAddress({ email: "a@b.com", name: "Max" })).toBe(
      "Max <a@b.com>",
    );
  });

  it("quotes name containing comma", () => {
    expect(formatAddress({ email: "a@b.com", name: "Muster, Max" })).toBe(
      '"Muster, Max" <a@b.com>',
    );
  });

  it("quotes name containing special characters", () => {
    expect(formatAddress({ email: "a@b.com", name: "Smith; John" })).toBe(
      '"Smith; John" <a@b.com>',
    );
    expect(formatAddress({ email: "a@b.com", name: "IT Dept." })).toBe(
      '"IT Dept." <a@b.com>',
    );
  });

  it("escapes embedded quotes in name", () => {
    expect(formatAddress({ email: "a@b.com", name: 'Max "The Man"' })).toBe(
      '"Max \\"The Man\\"" <a@b.com>',
    );
  });
});

describe("encodeAttachment", () => {
  it("encodes a simple Uint8Array to base64", () => {
    const input = new Uint8Array([104, 101, 108, 108, 111]);
    expect(encodeAttachment(input)).toBe("aGVsbG8=");
  });

  it("handles empty input", () => {
    expect(encodeAttachment(new Uint8Array([]))).toBe("");
  });

  it("handles large content (>= 8192 bytes)", () => {
    const input = new Uint8Array(16384);
    for (let i = 0; i < input.length; i++) input[i] = i & 0xff;
    const result = encodeAttachment(input);
    expect(typeof result).toBe("string");
    expect(result.length).toBeGreaterThan(0);
    expect(btoa(String.fromCharCode(...input))).toBe(result);
  });
});
