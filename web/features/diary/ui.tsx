"use client";
/* 语音日记共用小件 —— 移植 iOS DiaryDetailView.swift 中的 DiaryViewHead / DiaryBlockHead / DiaryKeywordFlow 与静态波形。 */

import type { ReactNode } from "react";

/** 视图头（原型 .diary-view-head） */
export function DiaryViewHead({
  eyebrow,
  title,
  subtitle,
  trailing,
}: {
  eyebrow: string;
  title: string;
  subtitle: string;
  trailing?: ReactNode;
}) {
  return (
    <div className="flex items-end gap-[14px] pt-4">
      <div className="flex min-w-0 flex-1 flex-col">
        <span className="text-[9px] tracking-[2.6px] text-[#99B8FF]">{eyebrow}</span>
        <span className="mt-[5px] text-[22px] font-bold text-ink">{title}</span>
        <span className="mt-1 whitespace-pre-line text-[10.5px] text-faint">{subtitle}</span>
      </div>
      {trailing}
    </div>
  );
}

/** 卡片块头（原型 .diary-block-head） */
export function DiaryBlockHead({ title, note }: { title: string; note: string }) {
  return (
    <div className="flex items-center gap-3">
      <span className="text-[13.5px] font-semibold text-ink">{title}</span>
      <span className="ml-auto text-[9.5px] text-faint">{note}</span>
    </div>
  );
}

/** 关键词胶囊行（原型 .diary-keywords） */
export function DiaryKeywordFlow({ items }: { items: string[] }) {
  return (
    <div className="flex flex-wrap gap-[7px]">
      {items.map((kw, i) => (
        <span
          key={`${kw}-${i}`}
          className="rounded-chip border border-[#5E96FF]/20 bg-[#5E96FF]/10 px-2.5 py-1.5 text-[11px] text-[#BFD2FF]"
        >
          {kw}
        </span>
      ))}
    </div>
  );
}

/** 卡片容器（Theme.card + line 描边，圆角 20） */
export function DiaryCard({ children }: { children: ReactNode }) {
  return (
    <div className="rounded-[20px] border border-line bg-card p-[17px]">{children}</div>
  );
}

/** 静态波形（高度公式对照原型 diaryWaveHTML；SVG 渲染 24 条） */
export function StaticWave({ seed }: { seed: number }) {
  const count = 24;
  const bars = Array.from({ length: count }, (_, i) => 18 + ((i * 17 + seed * 11) % 72));
  return (
    <svg
      className="h-7 w-full opacity-[0.66]"
      viewBox="0 0 100 28"
      preserveAspectRatio="none"
      aria-hidden
    >
      <defs>
        <linearGradient id={`wave-${seed}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#7CABFF" />
          <stop offset="1" stopColor="#8F7BFF" />
        </linearGradient>
      </defs>
      {bars.map((frac, i) => {
        const gap = 0.8;
        const bw = (100 - gap * (count - 1)) / count;
        const h = (28 * frac) / 100;
        return (
          <rect
            key={i}
            x={i * (bw + gap)}
            y={(28 - h) / 2}
            width={bw}
            height={h}
            rx={1}
            fill={`url(#wave-${seed})`}
          />
        );
      })}
    </svg>
  );
}
