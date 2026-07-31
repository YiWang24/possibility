import type { MetadataRoute } from "next";
import { PUBLIC_ROUTES, absoluteURL } from "@/lib/site";

export default function sitemap(): MetadataRoute.Sitemap {
  // 构建期求值一次；页面内容随发版变化，用构建时间做 lastModified 是准确的。
  const lastModified = new Date();

  return PUBLIC_ROUTES.map((route) => ({
    url: absoluteURL(route),
    lastModified,
    changeFrequency: "weekly",
    priority: route === "/" ? 1 : 0.7,
  }));
}
