/* 站点级常量 —— 与 lib/config.ts 同策略：env 优先，缺省回落生产域名。
   预览部署想覆盖时设 NEXT_PUBLIC_SITE_URL 即可，无需改代码。 */

export const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://www.maybeio.com";

export const SITE_NAME = "Possibility · 万花筒";
export const SITE_SHORT_NAME = "Possibility";
export const SITE_DESCRIPTION = "认识你自己，推演你的人生可能性";
export const SITE_LOCALE = "zh_CN";

/** 品牌色 —— 与 app/globals.css 的 --color-stage 及 aurora 渐变保持一致 */
export const BRAND_STAGE = "#05070d";
export const BRAND_AURORA: readonly string[] = ["#5e96ff", "#8f7bff", "#e35cc1", "#ff7a4d"];

/**
 * 登录后才有内容的应用路由（对齐 app/ 下的实际路由目录）。
 * 不进 sitemap 也不让爬虫抓：未登录抓到的只是「正在恢复会话…」的空壳，
 * 收录进去反而稀释首页权重。
 */
export const APP_ROUTES: readonly string[] = [
  "/assessment",
  "/bounty",
  "/card-game",
  "/chat",
  "/community",
  "/diary",
  "/lab",
  "/me",
  "/studio",
  "/traveler",
];

/** 可公开索引的路由 */
export const PUBLIC_ROUTES: readonly string[] = ["/"];

/** 把站内路径拼成绝对 URL —— sitemap / canonical / OG 都要求绝对地址 */
export function absoluteURL(path: string): string {
  return new URL(path, SITE_URL).toString();
}
