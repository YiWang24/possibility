"use client";
/* 数字形象舞台 —— 移植 iOS PersonaStageView（原型 .digital-human-stage）。
   舞台背景 + 画布 + LIVE 徽标 + caption；3 张底牌齐则边框高亮。 */

import { PersonaCanvas } from "./PersonaCanvas";
import type { PersonaModel } from "./persona";

export function PersonaStage({
  model,
  userName,
  summary,
  hasLifeCards,
  paused = false,
}: {
  model: PersonaModel;
  userName: string;
  summary?: string | null;
  hasLifeCards: boolean;
  paused?: boolean;
}) {
  const count = model.filled + model.signature.length;
  const metaText =
    summary && summary.length > 0
      ? `${model.shapeName} · ${summary}`
      : count > 0
        ? `${model.shapeName} · 根据下方 ${count} 组画像内容生成`
        : "由当前画像维度生成 · 持续生长";

  return (
    <div className="relative -mx-5 -mt-[22px] h-[216px] overflow-hidden">
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
      <div className="absolute left-[15px] top-[14px] flex items-center gap-1.5 rounded-chip border border-[#C6DAFF]/18 bg-[#070B18]/54 px-[9px] py-[5px] text-[#DCE8FF]">
        <span className="h-[5px] w-[5px] animate-pulse rounded-full bg-teal" />
        <span className="text-[8.5px] font-semibold tracking-[1.8px]">LIVE PROFILE FORM</span>
      </div>

      {/* caption */}
      <div className="absolute bottom-3.5 left-4 right-4">
        <div className="text-[12.5px] font-semibold text-ink">{userName} · 动态数字形象</div>
        <div className="line-clamp-2 text-[9.5px] text-faint">{metaText}</div>
      </div>

      {/* inset 描边 */}
      <div
        className="pointer-events-none absolute inset-[10px] rounded-[16px] border"
        style={{
          borderColor: hasLifeCards ? "rgba(174,174,255,0.22)" : "rgba(172,201,255,0.12)",
          boxShadow: `0 0 15px rgba(94,150,255,${hasLifeCards ? 0.13 : 0.08})`,
        }}
      />
    </div>
  );
}
