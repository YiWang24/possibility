"use client";
/* 应用外壳 —— 桌面持久侧栏 + 移动底部 TabBar。
   桌面侧栏除 4 个主 Tab 外还挂了二级入口：对话 / 卡牌 / 工作室 / 日记 这几条路由
   原本只能从首页卡片点进去，桌面上一旦深入就彻底失去导航，只剩一个 iOS 返回箭头。
   沉浸式路由（对话、卡牌、测评…）自带返回顶栏，移动端隐去底栏避免与其输入区打架，
   桌面仍保留侧栏 —— 网页不该像 App 那样把用户关进单页。 */
import Link from "next/link";
import { usePathname } from "next/navigation";
import { TabIcon } from "./TabIcon";

interface NavItem {
  key: string;
  href: string;
  label: string;
  /** 桌面宽屏下的一行说明，窄屏隐藏 */
  hint?: string;
}

const PRIMARY_NAV: NavItem[] = [
  { key: "home", href: "/", label: "认识你自己", hint: "日记 · 发问 · 画像" },
  { key: "lab", href: "/lab", label: "人生实验室", hint: "选择推演与对照" },
  { key: "community", href: "/community", label: "万花筒社区", hint: "旅人与悬赏" },
  { key: "me", href: "/me", label: "我的主页", hint: "公开名片与账号" },
];

const SECONDARY_NAV: NavItem[] = [
  { key: "chat", href: "/chat", label: "探索对话" },
  { key: "cards", href: "/card-game", label: "人生卡牌" },
  { key: "studio", href: "/studio", label: "画像工作室" },
  { key: "diary", href: "/diary", label: "语音日记" },
];

/** 自带返回顶栏的沉浸式路由：移动端不叠底部 TabBar */
const IMMERSIVE_PREFIXES = [
  "/chat",
  "/card-game",
  "/assessment",
  "/studio",
  "/diary",
  "/traveler",
  "/bounty",
];

function isActive(pathname: string, href: string): boolean {
  return href === "/" ? pathname === "/" : pathname.startsWith(href);
}

function isImmersive(pathname: string): boolean {
  return IMMERSIVE_PREFIXES.some((prefix) => pathname.startsWith(prefix));
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const immersive = isImmersive(pathname);

  return (
    <div className="screen-bg min-h-dvh md:flex">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[100] focus:rounded-chip focus:bg-brand focus:px-4 focus:py-2 focus:text-[13px] focus:font-semibold focus:text-white"
      >
        跳到主要内容
      </a>

      {/* 桌面侧边导航：自成滚动区，主区滚动时不动 */}
      {/* 宽度取自 --shell-sidebar，与页面级 fixed 底栏共用同一个值，不会各写各的 */}
      <aside className="no-scrollbar sticky top-0 hidden h-dvh w-[var(--shell-sidebar)] shrink-0 flex-col overflow-y-auto border-r border-line px-3 py-7 md:flex xl:px-4">
        <Link href="/" className="mb-9 flex gap-3 px-2">
          <span className="bg-aurora mt-1 w-[3px] shrink-0 rounded-chip" aria-hidden />
          <span className="flex flex-col gap-1">
            <span className="text-[10px] tracking-[0.32em] text-faint">POSSIBILITY</span>
            <span className="text-aurora text-[20px] font-bold leading-none">万花筒</span>
          </span>
        </Link>

        <nav aria-label="主导航" className="flex flex-col gap-1">
          {PRIMARY_NAV.map((item) => (
            <NavLink key={item.key} item={item} active={isActive(pathname, item.href)} showHint />
          ))}
        </nav>

        <div className="mx-2 my-6 h-px bg-line" />

        <nav aria-label="探索入口" className="flex flex-col gap-0.5">
          <span className="mb-2 px-3 text-[10px] tracking-[0.28em] text-faint">深入探索</span>
          {SECONDARY_NAV.map((item) => (
            <NavLink key={item.key} item={item} active={isActive(pathname, item.href)} compact />
          ))}
        </nav>

        <p className="mt-auto px-3 pt-8 font-serif text-[11px] leading-[1.8] text-faint">
          离每个人最远的，
          <br />
          就是他自己。
        </p>
      </aside>

      {/* 内容区 */}
      <main
        id="main"
        className={`min-w-0 flex-1 ${
          immersive ? "" : "pb-[calc(86px+env(safe-area-inset-bottom))] md:pb-0"
        }`}
      >
        {children}
      </main>

      {/* 移动端底部 TabBar */}
      {!immersive && (
        <nav
          aria-label="主导航"
          className="fixed inset-x-0 bottom-0 z-50 border-t border-line bg-paper/92 pb-[env(safe-area-inset-bottom)] backdrop-blur-xl md:hidden"
        >
          <div className="grid grid-cols-4">
            {PRIMARY_NAV.map((item) => {
              const active = isActive(pathname, item.href);
              return (
                <Link
                  key={item.key}
                  href={item.href}
                  aria-current={active ? "page" : undefined}
                  className={`flex flex-col items-center gap-1 pb-2 pt-2.5 transition ${
                    active ? "text-brand" : "text-faint"
                  }`}
                >
                  <TabIcon name={item.key} active={active} />
                  <span className="text-[10px]">{item.label}</span>
                </Link>
              );
            })}
          </div>
        </nav>
      )}
    </div>
  );
}

/* 侧栏条目：选中态用左侧极光竖条 + 渐变洗底，而不是一块灰色圆角填充 ——
   后者在深色底上几乎读不出层级。 */
function NavLink({
  item,
  active,
  showHint = false,
  compact = false,
}: {
  item: NavItem;
  active: boolean;
  showHint?: boolean;
  compact?: boolean;
}) {
  return (
    <Link
      href={item.href}
      aria-current={active ? "page" : undefined}
      className={`group relative flex items-center gap-3 rounded-[14px] pl-3 pr-2.5 transition ${
        compact ? "py-2" : "py-2.5"
      } ${active ? "text-ink" : "text-sub hover:bg-raised/60 hover:text-ink"}`}
      style={
        active
          ? {
              background:
                "linear-gradient(90deg, rgba(94,150,255,0.16) 0%, rgba(143,123,255,0.07) 55%, transparent 100%)",
            }
          : undefined
      }
    >
      {active && (
        <span aria-hidden className="bg-aurora absolute inset-y-1.5 left-0 w-[2.5px] rounded-chip" />
      )}
      <span
        className={`shrink-0 transition ${active ? "text-brand" : "text-faint group-hover:text-sub"}`}
      >
        <TabIcon name={item.key} active={active} size={compact ? 19 : 22} />
      </span>
      <span className="flex min-w-0 flex-col">
        <span className={`truncate ${compact ? "text-[13px]" : "text-[14px]"}`}>{item.label}</span>
        {showHint && item.hint && (
          <span className="mt-0.5 hidden truncate text-[11px] text-faint xl:block">{item.hint}</span>
        )}
      </span>
    </Link>
  );
}
