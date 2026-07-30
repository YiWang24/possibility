"use client";
import type { ReactNode } from "react";

/* 小蓝标签（原型 .stag） */
export function TagPill({ text }: { text: string }) {
  return (
    <span className="inline-flex items-center text-[11px] text-[#9DBCFF] px-[9px] py-[3.5px] rounded-chip bg-[#5E96FF]/13 border border-[#5E96FF]/30">
      {text}
    </span>
  );
}

/* 可切换 chip（原型 .chip / .seg） */
export function ChipToggle({
  label,
  isOn,
  onClick,
}: {
  label: string;
  isOn: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`shrink-0 text-[12.5px] px-[15px] py-2 rounded-chip border transition active:scale-[0.96] ${
        isOn
          ? "font-medium text-white bg-brand-deep border-[#6FA5FF]/60"
          : "text-sub bg-raised border-line"
      }`}
    >
      {label}
    </button>
  );
}

/* 主 CTA 按钮（原型 .btn-ink） */
export function PrimaryButton({
  title,
  wide = false,
  enabled = true,
  onClick,
  children,
}: {
  title?: string;
  wide?: boolean;
  enabled?: boolean;
  onClick?: () => void;
  children?: ReactNode;
}) {
  return (
    <div className="flex justify-center w-full">
      <button
        disabled={!enabled}
        onClick={onClick}
        className={`bg-btn-g text-white text-[15px] font-semibold py-[15px] rounded-chip transition active:scale-[0.96] disabled:opacity-35 shadow-[0_8px_14px_rgba(79,125,255,0.6)] ${
          wide ? "px-10 tracking-[3px] min-w-[230px]" : "w-full tracking-[0.8px]"
        }`}
      >
        {children ?? title}
      </button>
    </div>
  );
}

/* 描边幽灵按钮（原型 .btn-ghost） */
export function GhostButton({ title, onClick }: { title: string; onClick?: () => void }) {
  return (
    <button
      onClick={onClick}
      className="text-[13px] tracking-[0.8px] text-brand px-5 py-[11px] rounded-chip border-[1.5px] border-[#5E96FF]/45 transition active:scale-[0.96]"
    >
      {title}
    </button>
  );
}

/* 页眉：eyebrow + 大标题 */
export function PageHeader({ eyebrow, title }: { eyebrow: string; title: string }) {
  return (
    <div className="flex flex-col gap-1.5">
      <div className="text-[11px] tracking-[3.5px] text-faint">{eyebrow}</div>
      <h1 className="text-[27px] font-bold tracking-[0.8px] text-ink">{title}</h1>
    </div>
  );
}

/* 分区标题：标题 + 右侧说明/链接 */
export function SectionHeader({
  title,
  trailing,
  isLink = false,
  onTrailing,
}: {
  title: string;
  trailing?: string;
  isLink?: boolean;
  onTrailing?: () => void;
}) {
  return (
    <div className="flex items-baseline justify-between">
      <h2 className="text-[15px] font-semibold tracking-[0.9px] text-ink">{title}</h2>
      {trailing &&
        (onTrailing ? (
          <button
            onClick={onTrailing}
            className={`text-[12px] ${isLink ? "text-brand" : "text-faint"}`}
          >
            {trailing}
          </button>
        ) : (
          <span className="text-[12px] text-faint">{trailing}</span>
        ))}
    </div>
  );
}
