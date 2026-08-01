"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  NavigationMenu,
  NavigationMenuItem,
  NavigationMenuLink,
  NavigationMenuList,
} from "@/components/ui/navigation-menu";
import { cn } from "@/lib/utils";
import { isActiveSection, isFocusRoute, PRIMARY_ROUTES, TABS } from "@/lib/nav";
import { TabIcon } from "./TabIcon";

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  /* 任务流（测评、卡牌局中）收起全站导航：它是一个模式而不是一个页面，
     顶着导航既削弱专注，也正是「第二 navbar」观感的来源。 */
  const focus = isFocusRoute(pathname);
  const showMobileNav = !focus && PRIMARY_ROUTES.has(pathname);
  const isActive = isActiveSection;

  return (
    <div className="min-h-dvh screen-bg">
      <a
        href="#main-content"
        className="sr-only fixed left-4 top-3 z-[60] rounded-lg bg-raised px-4 py-2 text-sm text-ink shadow-lg focus:not-sr-only"
      >
        跳到主要内容
      </a>

      {/* 桌面顶部导航：品牌、主导航与一句轻量状态各占一列，主导航始终居中。
          容器与页面内容共用 max-w-shell + shell-gutter —— 原来顶栏锁 1280px、
          页面锁 1184/1536，logo 与其正下方的内容差出 78px，桌面上没有一条对得齐的竖线。 */}
      {!focus && (
      <header className="sticky top-0 z-50 hidden border-b border-white/[0.06] bg-paper/78 backdrop-blur-2xl md:block">
        <div className="shell-gutter relative mx-auto grid h-[var(--nav-h)] w-full max-w-shell grid-cols-[150px_1fr_150px] items-center lg:grid-cols-[190px_1fr_190px]">
          <Link
            href="/"
            aria-label="万花筒首页"
            className="group flex w-max items-center gap-3 rounded-xl outline-none focus-visible:ring-2 focus-visible:ring-brand/60"
          >
            <span className="relative grid size-9 place-items-center rounded-[13px] border border-white/10 bg-raised/70 shadow-[0_8px_30px_rgb(0_0_0/0.25)]">
              <span className="size-[18px] rotate-45 rounded-[6px] bg-aurora opacity-90 transition-transform duration-300 group-hover:rotate-[55deg] group-hover:scale-105" />
              <span className="absolute size-2 rounded-full bg-paper shadow-[0_0_12px_rgb(143_123_255/0.8)]" />
            </span>
            <span className="leading-none">
              <span className="block text-[9px] tracking-[2.8px] text-faint">POSSIBILITY</span>
              <span className="mt-1.5 block text-[16px] font-semibold tracking-[0.08em] text-ink">
                万花筒
              </span>
            </span>
          </Link>

          <NavigationMenu
            viewport={false}
            aria-label="主导航"
            className="mx-auto max-w-none"
          >
            <NavigationMenuList className="gap-0.5 rounded-[18px] border border-white/[0.07] bg-white/[0.035] p-1 shadow-[inset_0_1px_0_rgb(255_255_255/0.035),0_12px_36px_rgb(0_0_0/0.16)]">
              {TABS.map((tab) => {
                const active = isActive(pathname, tab.key);
                return (
                  <NavigationMenuItem key={tab.key}>
                    <NavigationMenuLink
                      asChild
                      active={active}
                      className={cn(
                        "relative flex h-10 min-w-[82px] flex-row items-center justify-center gap-0 rounded-[14px] px-3 py-0 text-[13px] font-medium tracking-[0.01em] text-sub outline-none transition-all duration-200",
                        "hover:bg-white/[0.045] hover:text-ink focus-visible:ring-2 focus-visible:ring-brand/45",
                        active &&
                          "bg-raised/90 text-ink shadow-[0_6px_18px_rgb(0_0_0/0.24),inset_0_1px_0_rgb(255_255_255/0.06)] data-[active=true]:bg-raised/90 data-[active=true]:text-ink data-[active=true]:hover:bg-raised/90"
                      )}
                    >
                      <Link
                        href={tab.href}
                        aria-current={active ? "page" : undefined}
                      >
                        {tab.label}
                        <span
                          aria-hidden="true"
                          className={cn(
                            "absolute inset-x-4 -bottom-1 h-px origin-center scale-x-0 rounded-full bg-aurora opacity-0 transition-all duration-300",
                            active && "scale-x-100 opacity-100"
                          )}
                        />
                      </Link>
                    </NavigationMenuLink>
                  </NavigationMenuItem>
                );
              })}
            </NavigationMenuList>
          </NavigationMenu>

          <div className="hidden items-center justify-self-end gap-2 text-[11px] text-faint lg:flex">
            <span className="size-1.5 rounded-full bg-teal shadow-[0_0_10px_rgb(62_217_164/0.7)]" />
            今天也有可能
          </div>
        </div>
      </header>
      )}

      {/* 内容区 */}
      <main
        id="main-content"
        tabIndex={-1}
        className={cn(
          "min-h-dvh min-w-0 outline-none",
          !focus && "md:min-h-[calc(100dvh-var(--nav-h))]",
          showMobileNav ? "pb-[86px] md:pb-0" : "pb-0"
        )}
      >
        {children}
      </main>

      {/* 移动端只在一级页面保留底部导航，详情与沉浸流程使用自己的返回栏。 */}
      {showMobileNav && (
        <nav
          aria-label="移动端主导航"
          className="fixed inset-x-0 bottom-0 z-50 px-2.5 pb-[max(8px,env(safe-area-inset-bottom))] md:hidden"
        >
          {/* 底栏四个标签原本挤成一坨、grid-cols-4 铺不开，有两层原因：
              1) NavigationMenu 根节点自带 max-w-max。用 max-w-[100%] 而不是
                 max-w-none —— className 走 tailwind-merge 合并，任意值形式才会
                 被识别成同一组并顶掉基类里的 max-w-max。
              2) Radix 在根节点与 ul 之间插了一个无样式 div，它作为 flex item
                 收缩到内容宽，ul 的 w-full 于是只占到这个 194px 的 100%。
                 [&>div]:w-full 把这一层撑开，栅格才真的有 370px 可分。 */}
          <NavigationMenu viewport={false} className="w-full max-w-[100%] [&>div]:w-full">
            <NavigationMenuList className="grid w-full grid-cols-4 gap-0 rounded-[22px] border border-white/[0.08] bg-paper/88 p-1.5 shadow-[0_16px_50px_rgb(0_0_0/0.5)] backdrop-blur-2xl">
              {TABS.map((tab) => {
                const active = isActive(pathname, tab.key);
                return (
                  <NavigationMenuItem key={tab.key}>
                    <NavigationMenuLink
                      asChild
                      active={active}
                      className={cn(
                        "flex min-h-[54px] w-full flex-col items-center justify-center gap-0.5 rounded-[16px] p-0 text-[9px] text-faint outline-none transition-all duration-200",
                        "hover:bg-white/[0.04] hover:text-sub focus-visible:ring-2 focus-visible:ring-brand/45",
                        active &&
                          "bg-raised/75 text-brand shadow-[inset_0_1px_0_rgb(255_255_255/0.04)] data-[active=true]:bg-raised/75 data-[active=true]:text-brand data-[active=true]:hover:bg-raised/75 data-[active=true]:hover:text-brand"
                      )}
                    >
                      <Link
                        href={tab.href}
                        aria-current={active ? "page" : undefined}
                      >
                        <TabIcon name={tab.key} active={active} size={22} />
                        <span>{tab.label}</span>
                      </Link>
                    </NavigationMenuLink>
                  </NavigationMenuItem>
                );
              })}
            </NavigationMenuList>
          </NavigationMenu>
        </nav>
      )}
    </div>
  );
}
