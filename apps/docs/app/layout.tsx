import "@/app/styles.css";

import { RootProvider } from "fumadocs-ui/provider/next";
import type { Metadata } from "next";
import type { ReactNode } from "react";
import { siteUrl } from "@/lib/layout";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: "Postbote Documentation",
    template: "%s | Postbote",
  },
  description:
    "Provider-agnostic transactional email for TypeScript, with adapters and composable middleware plugins.",
  openGraph: {
    title: "Postbote Documentation",
    description:
      "Provider-agnostic transactional email for TypeScript, with adapters and composable middleware plugins.",
    type: "website",
    url: siteUrl,
  },
};

export default function RootLayout({
  children,
}: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="flex min-h-screen flex-col">
        <RootProvider>{children}</RootProvider>
      </body>
    </html>
  );
}
