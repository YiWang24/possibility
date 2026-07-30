"use client";

/* 熔岩灯光球 —— iOS OrbView 的 CSS 版：conic 色环 + 模糊漂移 blob */
export function OrbView({ size = 120 }: { size?: number }) {
  return (
    <div
      className="relative rounded-full overflow-hidden shrink-0"
      style={{ width: size, height: size }}
      aria-hidden
    >
      <div className="absolute inset-0 bg-orb-conic animate-[spin_14s_linear_infinite] opacity-80" />
      <div
        className="absolute rounded-full bg-[#6FA5FF] mix-blend-screen animate-orb-a"
        style={{ width: size * 0.62, height: size * 0.62, left: "8%", top: "12%", filter: `blur(${size * 0.14}px)` }}
      />
      <div
        className="absolute rounded-full bg-[#E35CC1] mix-blend-screen animate-orb-b"
        style={{ width: size * 0.55, height: size * 0.55, right: "6%", bottom: "8%", filter: `blur(${size * 0.15}px)` }}
      />
      <div
        className="absolute rounded-full bg-[#FF7A4D] mix-blend-screen animate-orb-c"
        style={{ width: size * 0.4, height: size * 0.4, left: "30%", bottom: "4%", filter: `blur(${size * 0.13}px)` }}
      />
      <div className="absolute inset-0 rounded-full border border-white/20" />
      <div
        className="absolute inset-0 rounded-full"
        style={{ boxShadow: `inset 0 0 ${size * 0.25}px rgba(5,7,13,0.55)` }}
      />
    </div>
  );
}
