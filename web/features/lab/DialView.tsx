"use client";
/* 时间旋钮（签名交互）—— 移植自 iOS Core/DesignSystem/DialView.swift。
 * 在 ±120°（钟表 8 点→4 点）扇区内设定 7 天–10 年；conic 色环随指针臂旋转；
 * 拖拽/点击设定，drop-hot 时高亮虚线旋转边框。 */
import { useRef } from "react";
import { HORIZONS } from "./model";

const SWEEP = 120; // ±120°
const N = HORIZONS.length;
const CONIC = "conic-gradient(from 210deg, #5e96ff, #8f7bff, #e35cc1, #ff7a4d, #5e96ff)";

function indexToAngle(index: number): number {
  return -SWEEP + index * ((2 * SWEEP) / (N - 1));
}

function angleToIndex(angle: number): number {
  const raw = (angle + SWEEP) * ((N - 1) / (2 * SWEEP));
  return Math.min(N - 1, Math.max(0, Math.round(raw)));
}

/* 定点四舍五入：让 SSR 与客户端的浮点坐标序列化完全一致，避免 hydration 不一致 */
function r(n: number): number {
  return Math.round(n * 1000) / 1000;
}

export function DialView({
  horizonKey,
  onChange,
  pick,
  isHot = false,
  size = 260,
}: {
  horizonKey: string;
  onChange: (key: string) => void;
  /** 已选择卡名称；null 显示占位 */
  pick: string | null;
  isHot?: boolean;
  size?: number;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const index = Math.max(
    0,
    HORIZONS.findIndex((h) => h.key === horizonKey),
  );
  const current = HORIZONS[index] ?? HORIZONS[0];
  const armAngle = indexToAngle(index);

  const setFromPoint = (clientX: number, clientY: number) => {
    const el = ref.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    const dx = clientX - cx;
    const dy = clientY - cy;
    // 0=正上、顺时针为正，clamp 到 ±120°
    const deg = (Math.atan2(dx, -dy) * 180) / Math.PI;
    const clamped = Math.min(SWEEP, Math.max(-SWEEP, deg));
    const next = HORIZONS[angleToIndex(clamped)];
    if (next && next.key !== horizonKey) onChange(next.key);
  };

  const handlePointerDown = (e: React.PointerEvent) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    setFromPoint(e.clientX, e.clientY);
  };
  const handlePointerMove = (e: React.PointerEvent) => {
    if (e.buttons === 0) return; // 仅按住拖动时更新
    setFromPoint(e.clientX, e.clientY);
  };

  // 刻度线：-120..120 每 (step/3) 一条，主刻度每 3 条
  const step = (2 * SWEEP) / (N - 1);
  const minorStep = step / 3;
  const ticks: { x1: number; y1: number; x2: number; y2: number; major: boolean; on: boolean }[] = [];
  const c = size / 2;
  const rOuter = size / 2 - 8;
  let idx = 0;
  for (let a = -SWEEP; a <= SWEEP + 0.01; a += minorStep) {
    const major = idx % 3 === 0;
    const len = major ? 12 : 6;
    const rad = (a * Math.PI) / 180;
    const dirX = Math.sin(rad);
    const dirY = -Math.cos(rad);
    const horizonIndex = Math.round(idx / 3);
    const on = major && horizonIndex === index;
    ticks.push({
      x1: r(c + dirX * rOuter),
      y1: r(c + dirY * rOuter),
      x2: r(c + dirX * (rOuter - len)),
      y2: r(c + dirY * (rOuter - len)),
      major,
      on,
    });
    idx += 1;
  }

  const labelRadius = size / 2 - 26;
  const handleTop = 64 - 8; // 指针把手中心距顶（半径 = size/2-64）

  return (
    <div
      ref={ref}
      role="slider"
      aria-label="时间旋钮"
      aria-valuetext={`推演 ${current.label} 后的你`}
      tabIndex={0}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onKeyDown={(e) => {
        if (e.key === "ArrowRight" || e.key === "ArrowUp") {
          onChange(HORIZONS[Math.min(N - 1, index + 1)].key);
        } else if (e.key === "ArrowLeft" || e.key === "ArrowDown") {
          onChange(HORIZONS[Math.max(0, index - 1)].key);
        }
      }}
      className="relative mx-auto touch-none select-none outline-none"
      style={{ width: size, height: size }}
    >
      {/* 辉光环 */}
      <div
        className="absolute rounded-full transition-[transform,opacity] duration-500"
        style={{
          inset: -14,
          background: CONIC,
          filter: "blur(18px)",
          opacity: isHot ? 0.9 : 0.5,
          transform: `rotate(${armAngle}deg)`,
          WebkitMask: "radial-gradient(circle, transparent calc(50% - 12px), #000 calc(50% - 12px))",
          mask: "radial-gradient(circle, transparent calc(50% - 12px), #000 calc(50% - 12px))",
        }}
      />
      {/* 底盘 */}
      <div
        className="absolute inset-0 rounded-full border border-white/10 shadow-[0_8px_16px_rgba(0,0,0,0.5)]"
        style={{
          background:
            "radial-gradient(circle at 50% 42%, #1E222E 0%, #161923 55%, #0F1118 100%)",
        }}
      />
      {/* 彩色描边环 */}
      <div
        className="absolute inset-0 rounded-full transition-transform duration-500"
        style={{
          background: CONIC,
          transform: `rotate(${armAngle}deg)`,
          WebkitMask: "radial-gradient(circle, transparent calc(50% - 3px), #000 calc(50% - 3px))",
          mask: "radial-gradient(circle, transparent calc(50% - 3px), #000 calc(50% - 3px))",
        }}
      />
      {/* 刻度 + 数字 */}
      <svg className="absolute inset-0" width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden>
        {ticks.map((t, i) => (
          <line
            key={i}
            x1={t.x1}
            y1={t.y1}
            x2={t.x2}
            y2={t.y2}
            stroke={t.on ? "#ffffff" : t.major ? "rgba(157,188,255,0.65)" : "rgba(157,188,255,0.28)"}
            strokeWidth={t.major ? 2.5 : 1.5}
            strokeLinecap="round"
          />
        ))}
      </svg>
      {HORIZONS.map((h, i) => {
        const rad = (indexToAngle(i) * Math.PI) / 180;
        const x = r(c + Math.sin(rad) * labelRadius);
        const y = r(c - Math.cos(rad) * labelRadius);
        return (
          <span
            key={h.key}
            className="absolute font-bold tabular-nums"
            style={{
              left: x,
              top: y,
              transform: "translate(-50%, -50%)",
              fontSize: h.key === "day30" ? 8 : 9.5,
              color: i === index ? "#fff" : "var(--color-faint)",
            }}
          >
            {h.dialLabel}
          </span>
        );
      })}
      {/* 指针臂 */}
      <div
        className="absolute inset-0 transition-transform duration-500"
        style={{ transform: `rotate(${armAngle}deg)` }}
        aria-hidden
      >
        <div
          className="absolute"
          style={{
            left: "50%",
            top: handleTop + 16,
            width: 2.5,
            height: 16,
            transform: "translateX(-50%)",
            background: "linear-gradient(to bottom, rgba(111,165,255,0.85), rgba(111,165,255,0))",
          }}
        />
        <div
          className="absolute rounded-full border-[3px] border-white/15 shadow-[0_3px_3px_rgba(0,0,0,0.5)]"
          style={{
            left: "50%",
            top: handleTop,
            width: 16,
            height: 16,
            transform: "translateX(-50%)",
            background: "#F2F4F9",
          }}
        >
          <div className="absolute inset-[3.5px] rounded-full bg-brand-deep" />
        </div>
      </div>
      {/* drop-hot 虚线旋转边框 */}
      {isHot && (
        <div
          className="absolute rounded-full animate-[spin_16s_linear_infinite]"
          style={{
            inset: 12,
            border: "2px dashed rgba(111,165,255,0.55)",
          }}
        />
      )}
      {/* 中心信息 */}
      <div
        className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center gap-2 px-11 text-center"
      >
        <div className="text-[10.5px] tracking-[3px] text-faint">时间旋钮</div>
        <div
          className={`min-h-[28px] text-[17px] font-bold ${
            isHot || pick ? "text-brand" : "text-ink"
          }`}
        >
          {pick ?? "把选择卡拖进来"}
        </div>
        <div className="text-[12px] text-sub tabular-nums">
          推演 <span className="text-[20px] font-bold text-brand">{current.label}</span> 后的你
        </div>
      </div>
    </div>
  );
}
