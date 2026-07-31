import type { NextConfig } from "next";
import { SUPABASE_URL } from "./lib/config";

const IS_DEV = process.env.NODE_ENV === "development";

/**
 * CSP。
 *
 * script-src 用的是 'unsafe-inline' 而不是 nonce + strict-dynamic —— 这是有意的：
 * 本站绝大多数路由是静态预渲染的，而 nonce 必须逐请求生成，Next 无法把它注入
 * 预渲染好的 HTML（实测：CSP 头带 nonce 时 23 个 script 标签拿到 0 个）。
 * 那样上线会被 strict-dynamic 全量拦掉，整站白屏。
 *
 * 现在这份的实际防护面：外部脚本只能来自本站、连接目标只有 Supabase、
 * 禁用 object/base/iframe 嵌入。HTML 是纯静态壳、不插任何用户数据，
 * 没有服务端注入面，'unsafe-inline' 的额外风险很小。
 *
 * 什么时候该升级成 nonce：一旦开始服务端渲染用户产生的内容（SSR 的社区帖子、
 * traveler 主页等），HTML 就有了注入面，那时改成 middleware 下发 nonce
 * 并给相关路由加 `export const dynamic = "force-dynamic"`。
 */
function buildCSP(): string {
  const supabase = new URL(SUPABASE_URL);
  const supabaseOrigin = supabase.origin;
  const supabaseSocket = `wss://${supabase.host}`;

  const directives: Array<string | false> = [
    "default-src 'self'",
    `script-src 'self' 'unsafe-inline'${IS_DEV ? " 'unsafe-eval'" : ""}`,
    // framer-motion 直接写 element.style，样式只能放开 inline。
    "style-src 'self' 'unsafe-inline'",
    `img-src 'self' data: blob: ${supabaseOrigin}`,
    "font-src 'self' data:",
    `connect-src 'self' ${supabaseOrigin} ${supabaseSocket}${IS_DEV ? " ws://localhost:* http://localhost:*" : ""}`,
    `media-src 'self' ${supabaseOrigin}`,
    "worker-src 'self' blob:",
    "manifest-src 'self'",
    "frame-ancestors 'none'",
    "frame-src 'none'",
    "base-uri 'none'",
    "form-action 'self'",
    "object-src 'none'",
    // 本地是 http://localhost，强制升级会把请求打断，只在生产开。
    !IS_DEV && "upgrade-insecure-requests",
  ];

  return directives.filter((d): d is string => Boolean(d)).join("; ");
}

/**
 * HSTS 没有加 `preload`：那需要主动提交到 hstspreload.org，且撤销要等数月，
 * 属于不可逆动作，等子域规划定下来再手动加。
 */
const SECURITY_HEADERS = [
  { key: "Content-Security-Policy", value: buildCSP() },
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(), payment=(), usb=(), browsing-topics=()",
  },
  // same-origin 会掐断 OAuth 弹窗的 window.opener，用 allow-popups 保住登录流程。
  { key: "Cross-Origin-Opener-Policy", value: "same-origin-allow-popups" },
  { key: "X-Permitted-Cross-Domain-Policies", value: "none" },
  { key: "X-DNS-Prefetch-Control", value: "on" },
];

const nextConfig: NextConfig = {
  transpilePackages: ["@possibility/shared-types", "@possibility/api-client"],

  async headers() {
    return [{ source: "/:path*", headers: SECURITY_HEADERS }];
  },
};

export default nextConfig;
