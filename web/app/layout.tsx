import type { Metadata, Viewport } from "next";
import { Providers } from "@/components/shell/Providers";
import { bootScript } from "@/lib/boot-prefetch";
import { SUPABASE_ANON_KEY, SUPABASE_URL } from "@/lib/config";
import {
  BRAND_STAGE,
  SITE_DESCRIPTION,
  SITE_LOCALE,
  SITE_NAME,
  SITE_SHORT_NAME,
  SITE_URL,
} from "@/lib/site";
import "./globals.css";

export const metadata: Metadata = {
  // 有了 metadataBase，OG / canonical 里的相对路径才会展开成绝对地址。
  metadataBase: new URL(SITE_URL),
  title: {
    default: SITE_NAME,
    template: `%s · ${SITE_SHORT_NAME}`,
  },
  description: SITE_DESCRIPTION,
  applicationName: SITE_SHORT_NAME,
  alternates: { canonical: "/" },
  openGraph: {
    type: "website",
    url: SITE_URL,
    siteName: SITE_SHORT_NAME,
    locale: SITE_LOCALE,
    title: SITE_NAME,
    description: SITE_DESCRIPTION,
    // 图片由 app/opengraph-image.tsx 自动注入，此处不重复声明。
  },
  twitter: {
    card: "summary_large_image",
    title: SITE_NAME,
    description: SITE_DESCRIPTION,
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-image-preview": "large",
      "max-snippet": -1,
      "max-video-preview": -1,
    },
  },
  appleWebApp: {
    capable: true,
    title: SITE_SHORT_NAME,
    statusBarStyle: "black-translucent",
  },
  formatDetection: { telephone: false },
  // 站长验证串按需注入，不写死在仓库里。
  verification: process.env.NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION
    ? { google: process.env.NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION }
    : undefined,
};

/* maximumScale: 1 是从 iOS WebView 带过来的习惯，在网页上会禁掉双指缩放，
   属于 WCAG 1.4.4 违规；桌面端更没有理由锁死缩放。 */
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: BRAND_STAGE,
  colorScheme: "dark",
};

/* 引导脚本见 lib/boot-prefetch.ts，一段脚本担两件事：
 *
 * 1. 首屏分支提示 —— 给 <html> 打上 data-auth。服务端读不到 localStorage 里的会话，
 *    所以 SSR 产物同时包含「登录墙」和「应用外壳」两个分支（见 AuthWall），由这段
 *    脚本决定先显示哪一个，globals.css 负责隐藏另一个。没有它就只能二选一：要么
 *    已登录用户闪一下登录页，要么未登录用户先看空白。
 *
 *    只作为绘制提示：key 存在不等于会话有效（可能已过期且刷不动）。真实状态仍由
 *    supabase-js 解析，AuthWall 在 ready 之后收敛，最坏情况是外壳闪一下转登录页。
 *
 * 2. 首屏取数抢跑 —— 顺手用同一份会话把 get-profile / list-diary 提前发出去，
 *    不必等 ~270KB JS 下完再水合。
 *
 * 关于执行时机：这里原本记的是「React 连 body 里的裸内联 script 也会转成 __next_s
 * 队列形式，所以只是尽早、不保证首绘前」。在当前 Next 15 的生产产物里核对过，结论
 * 已经不成立 —— 产物中 __next_s 出现 0 次，这段是货真价实的解析阻塞内联 script，
 * 位置在 <body> 首节点，早于那 16 个 async chunk 的下载。抢跑正是靠这一点成立。
 *
 * globals.css 的中性缺省仍然保留：它兜的是「脚本被 CSP/插件拦掉」这类情形，代价为零。
 * 想要真正的服务端分支判定，得把会话从 localStorage 挪到 cookie。
 */

/* 根布局只负责 html/body 与全站 Provider。导航外壳挂在 (app) route group 的
   layout 里，而不是这里 —— 否则将来任何一条落在 (app) 之外的路由（独立落地页、
   分享页…）都会被迫套上主导航。

   suppressHydrationWarning：data-auth 由 auth-branch-hint 在 hydrate 之前写到
   <html> 上，服务端产物里没有，不声明就会报 mismatch。 */
export default function RootLayout({ children }: { children: React.ReactNode }) {
  /* 全站纯 dark：color-scheme 由 globals.css 声明，Tailwind v4 下 `.dark` class
     没有任何消费者（dark: 变体全站零使用），不再保留 shadcn v3 模板的残留。 */
  return (
    <html lang="zh-CN" suppressHydrationWarning>
      <head>
        {/* 会话恢复是 hydrate 之后的第一件事，握手却要等到那一刻才开始做。
            提前 preconnect，DNS + TCP + TLS 与 JS 下载并行，省掉首个 API 前的串行等待。
            crossOrigin 必须带：后续请求都是 CORS 的，不带的话连接不会被复用。 */}
        <link rel="preconnect" href={SUPABASE_URL} crossOrigin="anonymous" />
        <link rel="dns-prefetch" href={SUPABASE_URL} />
      </head>
      <body>
        {/* 必须是 body 第一个节点：抢跑越早发出，能与 JS 下载重叠的部分越多。 */}
        <script
          dangerouslySetInnerHTML={{ __html: bootScript(SUPABASE_URL, SUPABASE_ANON_KEY) }}
        />
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
