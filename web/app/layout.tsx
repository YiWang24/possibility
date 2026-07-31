import type { Metadata, Viewport } from "next";
import { Providers } from "@/components/shell/Providers";
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

/* 根布局只负责 html/body 与全站 Provider。导航外壳挂在 (app) route group 的
   layout 里，而不是这里 —— 否则将来任何一条落在 (app) 之外的路由（独立落地页、
   分享页…）都会被迫套上主导航。 */
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-CN" className="dark">
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
