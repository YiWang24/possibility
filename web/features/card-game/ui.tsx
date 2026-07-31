"use client";
/* 卡牌游戏共用小组件与工具 */

import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";

/** #RRGGBB → rgba() */
export function withAlpha(hex: string, alpha: number): string {
  const n = Number.parseInt(hex.replace("#", ""), 16);
  const r = (n >> 16) & 255;
  const g = (n >> 8) & 255;
  const b = n & 255;
  return `rgba(${r},${g},${b},${alpha})`;
}

/** 压力等级 1–4 颜色（iOS pressureColor） */
export const PRESSURE_COLORS = ["#7CABFF", "#D9B563", "#FF9A6B", "#F06A6A"];

/** 圆形返回按钮（iOS topBar chevron） */
export function BackButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label="返回"
      className="flex h-[34px] w-[34px] shrink-0 items-center justify-center rounded-full bg-raised text-ink transition active:scale-95"
    >
      <svg width="15" height="15" viewBox="0 0 15 15" fill="none" aria-hidden>
        <path d="M9.5 3 5 7.5 9.5 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </button>
  );
}

/** 底部主按钮条（iOS foot） */
export function Foot({
  title,
  enabled,
  onClick,
}: {
  title: string;
  enabled: boolean;
  onClick: () => void;
}) {
  return (
    <div className="border-t border-white/[0.07] bg-[#090b17]/82 px-5 pt-3 pb-[14px] backdrop-blur-xl">
      <div className="mx-auto w-full max-w-[800px]">
        <Button size="lg" className="w-full" type="button" disabled={!enabled} onClick={onClick}>
          {title}
        </Button>
      </div>
    </div>
  );
}

/** 结果分块（iOS resultBlock） */
export function ResultBlock({
  kicker,
  tint,
  children,
  className = "",
}: {
  kicker: string;
  tint: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`flex w-full flex-col items-start gap-[9px] rounded-tile bg-card p-[15px] text-left ${className}`}
      style={{ border: `1px solid ${withAlpha(tint, 0.22)}` }}
    >
      <div className="text-micro font-semibold tracking-[1.8px]" style={{ color: withAlpha(tint, 0.95) }}>
        {kicker}
      </div>
      {children}
    </div>
  );
}
