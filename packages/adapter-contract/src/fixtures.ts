import type { EmailMessage } from "@postbote/core";

export const fixtures = {
  minimal: {
    from: { email: "sender@example.com" },
    to: [{ email: "recipient@example.com" }],
    subject: "Hello World",
    text: "This is a plain text body.",
  },

  htmlOnly: {
    from: { email: "sender@example.com" },
    to: [{ email: "recipient@example.com" }],
    subject: "HTML Only",
    html: "<h1>Hello</h1><p>This is HTML content.</p>",
  },

  textOnly: {
    from: { email: "sender@example.com" },
    to: [{ email: "recipient@example.com" }],
    subject: "Text Only",
    text: "This is only text.",
  },

  full: {
    from: { email: "max@example.com", name: "Max Muster" },
    to: [{ email: "anna@example.com", name: "Anna Beispiel" }],
    cc: [{ email: "cc@example.com", name: "CC Person" }],
    bcc: [{ email: "bcc@example.com" }],
    replyTo: { email: "noreply@example.com" },
    subject: "Grüße aus Köln — wichtige Informationen",
    html: "<p>Grüße aus Köln!</p>",
    attachments: [
      {
        filename: "readme.txt",
        content: "SGVsbG8gV29ybGQ=",
        contentType: "text/plain",
      },
      {
        filename: "photo.png",
        content: new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]),
        contentType: "image/png",
      },
    ],
    headers: {
      "X-Custom-Header": "custom-value",
      "X-Priority": "high",
    },
    tags: {
      campaign: "onboarding",
      environment: "test",
    },
  },

  manyRecipients: {
    from: { email: "sender@example.com" },
    to: [
      { email: "r1@example.com" },
      { email: "r2@example.com" },
      { email: "r3@example.com" },
      { email: "r4@example.com", name: "Fourth Recipient" },
      { email: "r5@example.com" },
    ],
    cc: [{ email: "cc1@example.com" }, { email: "cc2@example.com" }],
    bcc: [{ email: "bcc1@example.com" }, { email: "bcc2@example.com" }],
    subject: "Many Recipients",
    text: "This message has many recipients.",
  },
} satisfies Record<string, EmailMessage>;
