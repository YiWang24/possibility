import type { Metadata, Viewport } from "next";
import { Providers } from "@/components/shell/Providers";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "Possibility · 万花筒",
    template: "%s · 万花筒",
  },
  description: "认识你自己，推演你的人生可能性",
};

/* maximumScale: 1 是从 iOS WebView 带过来的习惯，在网页上会禁掉双指缩放，
   属于 WCAG 1.4.4 违规；桌面端更没有理由锁死缩放。 */
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#05070D",
  colorScheme: "dark",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-CN" className="dark">
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
