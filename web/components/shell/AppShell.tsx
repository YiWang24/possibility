"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { TabIcon } from "./TabIcon";

const TABS = [
  { key: "home", href: "/", label: "认识你自己" },
  { key: "lab", href: "/lab", label: "人生实验室" },
  { key: "community", href: "/community", label: "万花筒社区" },
  { key: "me", href: "/me", label: "我的主页" },
];

function isActive(pathname: string, href: string) {
  return href === "/" ? pathname === "/" : pathname.startsWith(href);
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <div className="min-h-dvh screen-bg md:flex">
      {/* 桌面侧边导航 */}
      <aside className="hidden md:flex flex-col w-[224px] shrink-0 border-r border-line px-4 py-8 gap-1 sticky top-0 h-dvh">
        <div className="px-3 mb-8">
          <div className="text-[11px] tracking-[3.5px] text-faint">POSSIBILITY</div>
          <div className="text-[19px] font-bold text-aurora mt-1">万花筒</div>
        </div>
        {TABS.map((tab) => {
          const active = isActive(pathname, tab.href);
          return (
            <Link
              key={tab.key}
              href={tab.href}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-[14px] transition ${
                active ? "bg-raised text-ink" : "text-sub hover:bg-raised/50"
              }`}
            >
              <TabIcon name={tab.key} active={active} />
              <span className="text-[14px]">{tab.label}</span>
            </Link>
          );
        })}
      </aside>

      {/* 内容区 */}
      <main className="flex-1 min-w-0 pb-[86px] md:pb-0">{children}</main>

      {/* 移动端底部 TabBar */}
      <nav className="md:hidden fixed inset-x-0 bottom-0 z-50 bg-paper/92 backdrop-blur-xl border-t border-line pb-[env(safe-area-inset-bottom)]">
        <div className="grid grid-cols-4">
          {TABS.map((tab) => {
            const active = isActive(pathname, tab.href);
            return (
              <Link
                key={tab.key}
                href={tab.href}
                className="flex flex-col items-center gap-1 pt-2.5 pb-2"
              >
                <TabIcon name={tab.key} active={active} />
                <span className={`text-[10px] ${active ? "text-brand" : "text-faint"}`}>
                  {tab.label}
                </span>
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
