"use client";
/* 页面标题区 —— 面包屑 + 标题 + 副标题，取代各详情页自造的「返回按钮横条」。

   为什么不是返回按钮：web 有浏览器后退键，且全站导航一直在场。
   面包屑比返回多给两件事 —— 告诉你在第几层，以及可以直接跳到任意上级；
   返回只能退一步。GitHub / Linear / Notion / Vercel 都是这个路子。

   关键是它不占独立横条：没有 border-b、不 sticky、不铺满视口，
   而是和页面标题同属内容区、左对齐到全站那一条中轴线。
   原来的实现全宽 border-b（三个页面还叠了 sticky + backdrop-blur），
   视觉特征和真 navbar 一模一样，紧贴在全站导航下就成了第二条。 */

import Link from "next/link";
import { usePathname } from "next/navigation";
import { sectionOf } from "@/lib/nav";

export function PageHeading({
  title,
  description,
  eyebrow,
  trailing,
  /** 覆盖自动推导的上级（少数页面的归属和路由不一致时用） */
  parent,
}: {
  title: React.ReactNode;
  description?: React.ReactNode;
  eyebrow?: string;
  /** 右侧操作区（导出、分享等） */
  trailing?: React.ReactNode;
  parent?: { href: string; label: string } | null;
}) {
  const pathname = usePathname();
  const auto = sectionOf(pathname);
  const up = parent === undefined ? auto : parent;

  return (
    <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-3">
      <div className="flex min-w-0 flex-col gap-1.5">
        {up ? <Breadcrumb parent={up} current={title} /> : null}
        {/* 面包屑与 eyebrow 都在回答「这是哪儿」，同时出现就是同一句话说三遍
            （面包屑 / LIFE CARDS / 卡牌探索）。规则收在组件里，调用方不必记。 */}
        {eyebrow && !up ? <span className="text-eyebrow text-faint">{eyebrow}</span> : null}
        <h1 className="text-display font-bold text-ink">{title}</h1>
        {description ? (
          <p className="max-w-[62ch] text-body leading-[1.8] text-sub">{description}</p>
        ) : null}
      </div>
      {trailing ? <div className="flex shrink-0 items-center gap-2">{trailing}</div> : null}
    </div>
  );
}

function Breadcrumb({
  parent,
  current,
}: {
  parent: { href: string; label: string };
  current: React.ReactNode;
}) {
  return (
    <nav aria-label="面包屑" className="min-w-0">
      <ol className="flex min-w-0 items-center gap-1.5 text-footnote text-faint">
        <li className="shrink-0">
          <Link
            href={parent.href}
            className="rounded transition hover:text-sub focus-visible:ring-2 focus-visible:ring-brand/45"
          >
            {parent.label}
          </Link>
        </li>
        <li aria-hidden className="shrink-0 text-faint/60">
          ›
        </li>
        {/* 当前页在面包屑里重复出现是刻意的：标题会被滚动带走，
            面包屑留在原地时仍要能读出「我在哪」。用 aria-current 让读屏不重复播报。 */}
        <li className="min-w-0 truncate text-sub" aria-current="page">
          {current}
        </li>
      </ol>
    </nav>
  );
}
