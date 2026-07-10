import type { MetadataRoute } from "next";
import { siteUrl } from "@/lib/layout";
import { source } from "@/lib/source";

export default function sitemap(): MetadataRoute.Sitemap {
  return source.getPages().map((page) => ({
    url: new URL(page.url, siteUrl).toString(),
    lastModified: new Date(),
  }));
}
