import type { Address, EmailMessage } from "@postbote/core";

export interface RecordedEmail extends EmailMessage {
  messageId: string;
  sentAt: Date;
  attempt: number;
}

function copyAddress(addr: Address): Address {
  return { email: addr.email, name: addr.name };
}

function copyRecordedEmail(e: RecordedEmail): RecordedEmail {
  return {
    ...e,
    from: copyAddress(e.from),
    to: e.to.map(copyAddress),
    cc: e.cc?.map(copyAddress),
    bcc: e.bcc?.map(copyAddress),
    replyTo: e.replyTo ? copyAddress(e.replyTo) : undefined,
    headers: e.headers ? { ...e.headers } : undefined,
    tags: e.tags ? { ...e.tags } : undefined,
    attachments: e.attachments?.map((a) => ({ ...a })),
  };
}

export interface TestInbox {
  all(): RecordedEmail[];
  count(): number;
  last(): RecordedEmail;
  first(): RecordedEmail;
  at(index: number): RecordedEmail;
  to(email: string): RecordedEmail[];
  from(email: string): RecordedEmail[];
  withSubject(subject: string | RegExp): RecordedEmail[];
  find(predicate: (m: RecordedEmail) => boolean): RecordedEmail[];
  clear(): void;
}

export interface InboxState {
  inbox: TestInbox;
  add(msg: RecordedEmail): void;
}

export function createInbox(): InboxState {
  const emails: RecordedEmail[] = [];

  const inbox: TestInbox = {
    all(): RecordedEmail[] {
      return emails.map(copyRecordedEmail);
    },

    count(): number {
      return emails.length;
    },

    last(): RecordedEmail {
      if (emails.length === 0) {
        throw new Error("inbox is empty — no email was sent");
      }
      return copyRecordedEmail(emails[emails.length - 1] as RecordedEmail);
    },

    first(): RecordedEmail {
      if (emails.length === 0) {
        throw new Error("inbox is empty — no email was sent");
      }
      return copyRecordedEmail(emails[0] as RecordedEmail);
    },

    at(index: number): RecordedEmail {
      if (index < 0 || index >= emails.length) {
        throw new Error(
          `inbox index ${index} out of range — inbox has ${emails.length} email(s)`,
        );
      }
      return copyRecordedEmail(emails[index] as RecordedEmail);
    },

    to(email: string): RecordedEmail[] {
      const lower = email.toLowerCase();
      return emails
        .filter(
          (e) =>
            e.to.some((a) => a.email.toLowerCase() === lower) ||
            e.cc?.some((a) => a.email.toLowerCase() === lower) ||
            e.bcc?.some((a) => a.email.toLowerCase() === lower),
        )
        .map(copyRecordedEmail);
    },

    from(email: string): RecordedEmail[] {
      const lower = email.toLowerCase();
      return emails
        .filter((e) => e.from.email.toLowerCase() === lower)
        .map(copyRecordedEmail);
    },

    withSubject(subject: string | RegExp): RecordedEmail[] {
      if (typeof subject === "string") {
        return emails
          .filter((e) => e.subject === subject)
          .map(copyRecordedEmail);
      }
      return emails
        .filter((e) => subject.test(e.subject))
        .map(copyRecordedEmail);
    },

    find(predicate: (m: RecordedEmail) => boolean): RecordedEmail[] {
      return emails.filter(predicate).map(copyRecordedEmail);
    },

    clear(): void {
      emails.length = 0;
    },
  };

  return {
    inbox,
    add(msg: RecordedEmail): void {
      emails.push(msg);
    },
  };
}
