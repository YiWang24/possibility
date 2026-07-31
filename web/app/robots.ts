import type { MetadataRoute } from "next";
import { APP_ROUTES, SITE_URL, absoluteURL } from "@/lib/site";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: [...APP_ROUTES],
    },
    sitemap: absoluteURL("/sitemap.xml"),
    host: SITE_URL,
  };
}
