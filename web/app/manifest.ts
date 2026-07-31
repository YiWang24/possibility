import type { MetadataRoute } from "next";
import { BRAND_STAGE, SITE_DESCRIPTION, SITE_NAME, SITE_SHORT_NAME } from "@/lib/site";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: SITE_NAME,
    short_name: SITE_SHORT_NAME,
    description: SITE_DESCRIPTION,
    lang: "zh-CN",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: BRAND_STAGE,
    theme_color: BRAND_STAGE,
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      // maskable 直接复用满幅图：图标背景是四角不同色的渐变，纯色补边必然在某一侧
      // 露出方形接缝；而主体本身留了约 15% 空白，被圆形遮罩切掉的只是辉光边缘。
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
