"use client";
/* 数字形象舞台 —— 移植 iOS PersonaStageView（原型 .digital-human-stage）。
   舞台背景 + 画布 + LIVE 徽标 + caption；3 张底牌齐则边框高亮。

   原实现写死 h-[216px] 且带 -mx-5 -mt-[22px]，负边距是照着「父卡片 px-5 pt-[22px]」
   量出来的，等于把组件焊死在那一种卡片里 —— 想在别处（首页 hero、画像轨缩略）
   复用就会错位。现在高度与出血都由调用方声明，组件自己不假设父容器有多少内边距。 */

import { PersonaCanvas } from "./PersonaCanvas";
import type { PersonaModel } from "./persona";

/** 舞台形态：hero 撑第一屏，card 是原来卡片内的尺寸，rail 是轨内缩略，
    fill 交给父容器定高（首页 hero 的右栏要跟左栏等高）。 */
export type StageSize = "hero" | "card" | "rail" | "fill";

const STAGE_HEIGHT: Record<StageSize, string> = {
  hero: "h-[300px] md:h-[380px] xl:h-[440px]",
  card: "h-[216px]",
  rail: "h-[168px]",
  fill: "h-full",
};

/** 小尺寸下 caption 与徽标要跟着收，否则会盖住形象本身 */
const COMPACT: Record<StageSize, boolean> = {
  hero: false,
  card: false,
  rail: true,
  fill: false,
};

export function PersonaStage({
  model,
  userName,
  summary,
  hasLifeCards,
  paused = false,
  size = "card",
  /** 向父卡片内边距外出血，抵消调用方的 padding；调用方自己给值，组件不猜 */
  bleed,
  className = "",
}: {
  model: PersonaModel;
  userName: string;
  summary?: string | null;
  hasLifeCards: boolean;
  paused?: boolean;
  size?: StageSize;
  bleed?: string;
  className?: string;
}) {
  const count = model.filled + model.signature.length;
  const metaText =
    summary && summary.length > 0
      ? `${model.shapeName} · ${summary}`
      : count > 0
        ? `${model.shapeName} · 根据下方 ${count} 组画像内容生成`
        : "由当前画像维度生成 · 持续生长";

  const compact = COMPACT[size];

  return (
    <div
      className={`relative overflow-hidden ${STAGE_HEIGHT[size]} ${bleed ?? ""} ${className}`}
    >
      {/* 舞台背景 */}
      <div
        className="absolute inset-0"
        style={{
          background:
            "radial-gradient(170px circle at 50% 48%, rgba(83,115,255,0.22), transparent), radial-gradient(135px circle at 30% 80%, rgba(227,92,193,0.12), transparent), linear-gradient(135deg,#080C1A,#10162B,#080B16)",
        }}
      />

      <PersonaCanvas model={model} paused={paused} />

      {/* 底部压暗 */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "linear-gradient(to bottom, transparent 38%, rgba(7,10,20,0.07) 62%, rgba(7,9,18,0.88) 100%)",
        }}
      />

      {/* LIVE 徽标 */}
      <div className="absolute left-[15px] top-[14px] flex items-center gap-1.5 rounded-chip border border-brand-lite/18 bg-[#070B18]/54 px-[9px] py-[5px] text-[#DCE8FF]">
        <span className="h-[5px] w-[5px] animate-pulse rounded-full bg-teal" />
        <span className="text-micro font-semibold tracking-[1.8px]">LIVE PROFILE FORM</span>
      </div>

      {/* caption */}
      <div className="absolute bottom-3.5 left-4 right-4">
        <div
          className={
            size === "hero" || size === "fill"
              ? "text-lead font-semibold text-ink xl:text-title"
              : "text-footnote font-semibold text-ink"
          }
        >
          {userName} · 动态数字形象
        </div>
        {!compact && (
          <div
            className={
              size === "fill" || size === "hero"
                ? "line-clamp-2 text-caption text-sub"
                : "line-clamp-2 text-micro text-faint"
            }
          >
            {metaText}
          </div>
        )}
      </div>

      {/* inset 描边 */}
      <div
        className="pointer-events-none absolute inset-[10px] rounded-tile border"
        style={{
          borderColor: hasLifeCards ? "rgba(174,174,255,0.22)" : "rgba(172,201,255,0.12)",
          boxShadow: `0 0 15px rgba(94,150,255,${hasLifeCards ? 0.13 : 0.08})`,
        }}
      />
    </div>
  );
}
