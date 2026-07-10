import { createPostbote } from "@postbote/core";
import { reactEmail } from "@postbote/plugin-react-email";
import { createTestAdapter } from "@postbote/testing";
import React from "react";

function Welcome({ name }: { name: string }) {
  return React.createElement("h1", null, `Welcome ${name}!`);
}

export async function runReactEmailExample() {
  const adapter = createTestAdapter();
  const postbote = createPostbote({
    adapter,
    plugins: [reactEmail()],
  });

  await postbote.send({
    from: "sender@example.com",
    to: "recipient@example.com",
    subject: "Welcome",
    body: React.createElement(Welcome, { name: "Nick" }),
  });

  return adapter.inbox.last();
}
