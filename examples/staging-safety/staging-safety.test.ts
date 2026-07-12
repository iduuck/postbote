import { createPostbote } from "@postbote/core";
import { dryRun } from "@postbote/plugin-dry-run";
import { redirect } from "@postbote/plugin-redirect";
import { createTestAdapter } from "@postbote/testing";
import { expect, it } from "vitest";

it("previews a safely redirected staging email without delivery", async () => {
  const adapter = createTestAdapter();
  const previewed: string[] = [];
  const postbote = createPostbote({
    adapter,
    plugins: [
      redirect({ to: "staging@example.com", subjectPrefix: "[staging] " }),
      dryRun({
        onSend: (message) => previewed.push(message.to[0]?.email ?? ""),
      }),
    ] as const,
  });
  await expect(
    postbote.send({
      from: "from@example.com",
      to: "customer@example.com",
      subject: "Receipt",
      text: "Thanks",
    }),
  ).resolves.toMatchObject({ provider: "dry-run" });
  expect(previewed).toEqual(["staging@example.com"]);
  expect(adapter.inbox.count()).toBe(0);
});
