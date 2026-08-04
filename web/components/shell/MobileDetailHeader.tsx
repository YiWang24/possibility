"use client";

import type { ReactNode } from "react";

/**
 * 手机详情页顶栏，对齐 iOS fullScreenCover 的导航结构。
 * 桌面继续使用 PageHeading + 面包屑；这里仅在 md 以下出现。
 */
export function MobileDetailHeader({
  title,
  description,
  onBack,
  trailing,
}: {
  title: ReactNode;
  description?: ReactNode;
  onBack: () => void;
  trailing?: ReactNode;
}) {
  return (
    <div className="sticky top-0 z-30 border-b border-line bg-paper/80 backdrop-blur md:hidden">
      <div className="flex w-full items-center gap-[13px] px-[22px] pb-2.5 pt-[calc(env(safe-area-inset-top)+12px)]">
        <button
          onClick={onBack}
          aria-label="返回"
          className="flex h-[34px] w-[34px] shrink-0 items-center justify-center rounded-full bg-raised text-ink transition active:scale-95"
        >
          <svg width="15" height="15" viewBox="0 0 15 15" fill="none" aria-hidden>
            <path
              d="M9.5 3 5 7.5 9.5 12"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </button>
        <div className="min-w-0 flex-1">
          <div className="truncate text-subtitle font-semibold tracking-[0.8px] text-ink">
            {title}
          </div>
          {description ? (
            <div className="truncate text-caption text-faint">{description}</div>
          ) : null}
        </div>
        {trailing ? <div className="flex shrink-0 items-center gap-2">{trailing}</div> : null}
      </div>
    </div>
  );
}
