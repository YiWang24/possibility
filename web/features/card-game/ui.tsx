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
    /* sticky：测评页已改成文档流（不再是「外层 h-dvh + 内容 overflow-y-auto」
       那套页面里套页面的结构），底部操作栏得自己粘在视口底沿才留得住。
       卡牌局仍是固定高度牌桌，sticky 在那里无副作用。视觉沿用 main 的新样式。 */
    <div className="sticky bottom-0 z-20 border-t border-white/[0.07] bg-[#090b17]/82 px-5 pb-[14px] pt-3 backdrop-blur-xl">
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
