"use client";
/* 抽牌扇形牌弧 —— 移植自 iOS CardGameView.fanArc（原型 .stamp-scroll / .stamp-arc）
 * 牌弧 460 宽、牌 120×165、±25° 扇形；宽于屏幕时可横向滑动，中间牌最高最上层。 */

import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import type { GameScenario } from "./data";
import { withAlpha } from "./ui";

const COMPACT_ARC_W = 460;
const WIDE_ARC_W = 700;

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
  const [arcWidth, setArcWidth] = useState(COMPACT_ARC_W);
  const scrollRef = useRef<HTMLDivElement>(null);

  /* 初始居中（原型 defaultScrollAnchor(.center)） */
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const updateLayout = () => {
      setArcWidth(el.clientWidth >= 650 ? WIDE_ARC_W : COMPACT_ARC_W);
    };
    updateLayout();
    const observer = new ResizeObserver(updateLayout);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollLeft = Math.max(0, (arcWidth - el.clientWidth) / 2);
  }, [arcWidth]);

  const mid = (options.length - 1) / 2;
  const wide = arcWidth === WIDE_ARC_W;
  const arcHeight = wide ? 310 : 214;
  const cardWidth = wide ? 164 : 120;
  const cardHeight = wide ? 226 : 165;
  const spacing = wide ? 105 : 73;

  return (
    <div className="pt-2.5">
      <div ref={scrollRef} className="no-scrollbar overflow-x-auto" style={{ height: arcHeight }}>
        <div className="relative mx-auto" style={{ width: arcWidth, height: arcHeight }}>
          {options.map((scenario, i) => {
            const d = i - mid;
            const isSelected = picked === i;
            /* 弧线：中间高、两侧低（原型 y = -10 / 7 / 28） */
            const cx = arcWidth / 2 + d * spacing;
            const cy = arcHeight / 2 - 8 +
              ((wide ? 3 : 2) * d * d + (wide ? 18 : 15) * Math.abs(d) -
                (wide ? 18 : 10));
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
                className="card-game-back absolute flex items-center justify-center overflow-hidden rounded-[16px] transition-transform active:scale-[0.94] lg:rounded-[20px]"
                style={{
                  left: cx - cardWidth / 2,
                  top: cy - cardHeight / 2,
                  width: cardWidth,
                  height: cardHeight,
                  zIndex: isSelected ? 20 : Math.round(10 - Math.abs(d) * 2),
                  border: `${isSelected ? 2 : 1}px solid ${isSelected ? accent : withAlpha(accent, 0.35)}`,
                  boxShadow: isSelected
                    ? `0 6px 26px ${withAlpha(accent, 0.5)}`
                    : "0 6px 18px rgba(0,0,0,0.45)",
                }}
              >
                <span className="absolute inset-[10px] rounded-[11px] border border-white/[0.07] lg:inset-[14px] lg:rounded-[14px]" />
                <span
                  className="absolute h-12 w-12 rotate-45 rounded-[12px] border border-violet-soft/35 bg-violet-soft/[0.035] lg:h-16 lg:w-16 lg:rounded-[16px]"
                  style={{
                    boxShadow: isSelected
                      ? `0 0 28px ${withAlpha(accent, 0.25)}`
                      : undefined,
                  }}
                />
                <span
                  className="relative text-[21px] lg:text-[27px]"
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
