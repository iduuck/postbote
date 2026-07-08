import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createInbox, type RecordedEmail, type TestInbox } from "./inbox.js";

function makeMinimalEmail(overrides?: Partial<RecordedEmail>): RecordedEmail {
  return {
    from: { email: "alice@test.com", name: "Alice" },
    to: [{ email: "bob@test.com", name: "Bob" }],
    cc: [{ email: "carol@test.com", name: "Carol" }],
    bcc: [{ email: "dave@test.com" }],
    subject: "Hello",
    text: "body",
    messageId: "test-1",
    sentAt: new Date("2025-01-01"),
    attempt: 1,
    ...overrides,
  };
}

describe("TestInbox", () => {
  let inbox: TestInbox;
  let add: (msg: RecordedEmail) => void;

  beforeEach(() => {
    const state = createInbox();
    inbox = state.inbox;
    add = state.add;
  });

  afterEach(() => {
    inbox.clear();
  });

  describe("all", () => {
    it("returns an empty array for empty inbox", () => {
      expect(inbox.all()).toEqual([]);
    });

    it("returns all emails", () => {
      add(makeMinimalEmail({ messageId: "test-1", attempt: 1 }));
      add(
        makeMinimalEmail({ messageId: "test-2", attempt: 2, subject: "World" }),
      );
      expect(inbox.all()).toHaveLength(2);
    });

    it("returns a defensive copy — push has no effect", () => {
      add(makeMinimalEmail());
      const snapshot = inbox.all();
      snapshot.push({} as never);
      expect(inbox.all()).toHaveLength(1);
    });
  });

  describe("count", () => {
    it("returns 0 for empty inbox", () => {
      expect(inbox.count()).toBe(0);
    });

    it("returns the number of emails", () => {
      add(makeMinimalEmail());
      expect(inbox.count()).toBe(1);
      add(makeMinimalEmail());
      expect(inbox.count()).toBe(2);
    });
  });

  describe("last", () => {
    it("returns the most recent email", () => {
      add(makeMinimalEmail({ messageId: "test-1", attempt: 1 }));
      add(makeMinimalEmail({ messageId: "test-2", attempt: 2 }));
      expect(inbox.last().messageId).toBe("test-2");
    });

    it("throws with descriptive message when inbox is empty", () => {
      expect(() => inbox.last()).toThrow("inbox is empty");
    });
  });

  describe("first", () => {
    it("returns the first email", () => {
      add(makeMinimalEmail({ messageId: "test-1", attempt: 1 }));
      add(makeMinimalEmail({ messageId: "test-2", attempt: 2 }));
      expect(inbox.first().messageId).toBe("test-1");
    });

    it("throws with descriptive message when inbox is empty", () => {
      expect(() => inbox.first()).toThrow("inbox is empty");
    });
  });

  describe("at", () => {
    it("returns email at given index", () => {
      add(makeMinimalEmail({ messageId: "test-1", attempt: 1 }));
      add(makeMinimalEmail({ messageId: "test-2", attempt: 2 }));
      expect(inbox.at(0).messageId).toBe("test-1");
      expect(inbox.at(1).messageId).toBe("test-2");
    });

    it("throws with descriptive message for out-of-range", () => {
      add(makeMinimalEmail());
      expect(() => inbox.at(-1)).toThrow("out of range");
      expect(() => inbox.at(1)).toThrow("out of range");
    });
  });

  describe("to", () => {
    it("matches to recipient", () => {
      add(makeMinimalEmail());
      expect(inbox.to("bob@test.com")).toHaveLength(1);
    });

    it("matches cc recipient", () => {
      add(makeMinimalEmail());
      expect(inbox.to("carol@test.com")).toHaveLength(1);
    });

    it("matches bcc recipient", () => {
      add(makeMinimalEmail());
      expect(inbox.to("dave@test.com")).toHaveLength(1);
    });

    it("is case-insensitive", () => {
      add(makeMinimalEmail());
      expect(inbox.to("BOB@test.com")).toHaveLength(1);
    });

    it("returns empty array when no match", () => {
      add(makeMinimalEmail());
      expect(inbox.to("nobody@test.com")).toEqual([]);
    });
  });

  describe("from", () => {
    it("matches sender", () => {
      add(makeMinimalEmail());
      expect(inbox.from("alice@test.com")).toHaveLength(1);
    });

    it("is case-insensitive", () => {
      add(makeMinimalEmail());
      expect(inbox.from("ALICE@test.com")).toHaveLength(1);
    });

    it("returns empty array when no match", () => {
      add(makeMinimalEmail());
      expect(inbox.from("mallory@test.com")).toEqual([]);
    });
  });

  describe("withSubject", () => {
    it("matches exact subject as string", () => {
      add(makeMinimalEmail({ subject: "Welcome" }));
      expect(inbox.withSubject("Welcome")).toHaveLength(1);
    });

    it("does not match different subject", () => {
      add(makeMinimalEmail({ subject: "Welcome" }));
      expect(inbox.withSubject("Goodbye")).toHaveLength(0);
    });

    it("matches regex", () => {
      add(makeMinimalEmail({ subject: "Your order #12345" }));
      expect(inbox.withSubject(/order/)).toHaveLength(1);
      expect(inbox.withSubject(/^Your/)).toHaveLength(1);
      expect(inbox.withSubject(/^Goodbye/)).toHaveLength(0);
    });
  });

  describe("find", () => {
    it("finds emails matching predicate", () => {
      add(makeMinimalEmail({ messageId: "test-1", attempt: 1 }));
      add(
        makeMinimalEmail({
          messageId: "test-2",
          attempt: 2,
          subject: "Special",
        }),
      );
      const result = inbox.find((e) => e.subject === "Special");
      expect(result).toHaveLength(1);
      expect(result[0]?.messageId).toBe("test-2");
    });

    it("returns empty array when no match", () => {
      add(makeMinimalEmail());
      expect(inbox.find(() => false)).toEqual([]);
    });
  });

  describe("clear", () => {
    it("removes all emails", () => {
      add(makeMinimalEmail());
      inbox.clear();
      expect(inbox.count()).toBe(0);
    });
  });
});
