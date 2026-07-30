"use client";
/* 抽牌扇形牌弧 —— 移植自 iOS CardGameView.fanArc（原型 .stamp-scroll / .stamp-arc）
 * 牌弧 460 宽、牌 120×165、±25° 扇形；宽于屏幕时可横向滑动，中间牌最高最上层。 */

import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import type { GameScenario } from "./data";
import { withAlpha } from "./ui";

const ARC_W = 460;
const ARC_H = 214;
const CARD_W = 120;
const CARD_H = 165;

export function FanArc({
  options,
  accent,
  onDraw,
}: {
  options: GameScenario[];
  accent: string;
  onDraw: (scenario: GameScenario) => void;
}) {
  const [picked, setPicked] = useState<number | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  /* 初始居中（原型 defaultScrollAnchor(.center)） */
  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollLeft = Math.max(0, (ARC_W - el.clientWidth) / 2);
  }, []);

  const mid = (options.length - 1) / 2;

  return (
    <div className="pt-2.5">
      <div ref={scrollRef} className="no-scrollbar overflow-x-auto" style={{ height: ARC_H }}>
        <div className="relative mx-auto" style={{ width: ARC_W, height: ARC_H }}>
          {options.map((scenario, i) => {
            const d = i - mid;
            const isSelected = picked === i;
            /* 弧线：中间高、两侧低（原型 y = -10 / 7 / 28） */
            const cx = ARC_W / 2 + d * 73;
            const cy = ARC_H / 2 - 8 + (2 * d * d + 15 * Math.abs(d) - 10);
            return (
              <motion.button
                key={`${scenario.title}-${i}`}
                aria-label={`抽第 ${i + 1} 张牌`}
                initial={{ opacity: 0, y: 46, rotate: 0, scale: 0.9 }}
                animate={{
                  opacity: 1,
                  y: isSelected ? -16 : 0,
                  rotate: d * 12.5,
                  scale: isSelected ? 1.08 : 1,
                }}
                transition={
                  isSelected
                    ? { type: "spring", stiffness: 380, damping: 22 }
                    : { delay: i * 0.07, type: "spring", stiffness: 260, damping: 20 }
                }
                onClick={() => {
                  /* 先给出清晰的选中态，短暂停留后再进入决策 */
                  if (picked !== null) return;
                  setPicked(i);
                  setTimeout(() => onDraw(scenario), 320);
                }}
                className="absolute flex items-center justify-center rounded-[16px] transition-transform active:scale-[0.94]"
                style={{
                  left: cx - CARD_W / 2,
                  top: cy - CARD_H / 2,
                  width: CARD_W,
                  height: CARD_H,
                  zIndex: isSelected ? 20 : Math.round(10 - Math.abs(d) * 2),
                  background: "linear-gradient(135deg,#232948,#161A30)",
                  border: `${isSelected ? 2 : 1}px solid ${isSelected ? accent : withAlpha(accent, 0.35)}`,
                  boxShadow: isSelected
                    ? `0 6px 26px ${withAlpha(accent, 0.5)}`
                    : "0 6px 18px rgba(0,0,0,0.45)",
                }}
              >
                <span
                  className="text-[21px]"
                  style={{ color: isSelected ? accent : withAlpha(accent, 0.5) }}
                >
                  ✦
                </span>
              </motion.button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
