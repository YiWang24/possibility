"use client";
/* 人生卡牌入口 —— 移植 iOS LifeEntryButton（原型 .life-entry）。位于 ask 卡下方。 */

import { useRouter } from "next/navigation";
import { hue } from "@/lib/theme";

export function LifeEntryButton() {
  const router = useRouter();
  return (
    <button
      onClick={() => router.push("/card-game")}
      className="flex w-full items-center gap-3 rounded-[16px] border border-[#8F7BFF]/30 px-4 py-3.5 text-left transition active:scale-[0.98]"
      style={{
        background:
          "linear-gradient(135deg, rgba(26,35,80,0.6), rgba(43,27,45,0.4))",
      }}
    >
      {/* 迷你牌堆 */}
      <div className="relative h-[30px] w-[34px] shrink-0">
        <div
          className="absolute left-0 top-0 h-[30px] w-[22px] -translate-x-[3px] -rotate-[10deg] rounded-[5px]"
          style={{ background: hue(4).gradient }}
        />
        <div
          className="absolute left-0 top-0 h-[30px] w-[22px] translate-x-[3px] rotate-[8deg] rounded-[5px]"
          style={{ background: hue(1).gradient }}
        />
      </div>
      <div className="min-w-0 flex-1">
        <div className="text-[10px] tracking-[1px] text-[#9DBCFF]">四套卡牌探索 · 3–8 分钟</div>
        <div className="mt-[3px] text-[13.5px] font-semibold text-ink">
          人生卡牌：你最后会留下什么？
        </div>
        <div className="mt-[3px] text-[11px] text-sub">
          人生、婚姻、家庭、人际交往 · 选择一套开始
        </div>
      </div>
      <span className="text-[15px] text-faint">›</span>
    </button>
  );
}
