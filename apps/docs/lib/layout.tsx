import type { BaseLayoutProps } from "fumadocs-ui/layouts/shared";

export const siteUrl =
  process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

export const baseOptions: BaseLayoutProps = {
  nav: {
    title: "Postbote",
    url: "/",
  },
  links: [
    {
      text: "GitHub",
      url: "https://github.com/iduuck/postbote",
      external: true,
    },
    {
      text: "npm",
      url: "https://www.npmjs.com/search?q=%40postbote",
      external: true,
    },
  ],
};
