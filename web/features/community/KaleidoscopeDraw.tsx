"use client";
/* 万花筒抽取浮层 —— 移植 iOS KaleidoscopeDrawView / KaleidoscopeView。
   选「类似 / 相反」→ 万花筒 conic 色环旋转 → 后端 kaleidoscope_draw 抽出真实旅人 → 查看主页 / 再抽一次。
   动画与远程抽取并行：远程结果在一个动画周期内到达则采用，否则回落本地候选（对齐 iOS 超时策略）。 */

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { HueBandHeader } from "@/components/ui/Avatar";
import { TagPill } from "@/components/ui/Basics";
import { callFunction } from "@/lib/supabase";
import { mockAvatarById } from "@/lib/theme";
import { DEMO_TRAVELERS } from "@/lib/demo-data";
import { useData } from "@/stores/data";
import type { Traveler } from "@/lib/models";

type DrawMode = "similar" | "different";
type Phase = "choose" | "spinning" | "result";

/** community kaleidoscope_draw 出参（traveler 仅含部分字段，无 initial/hue） */
interface KaleidoscopeDrawResponse {
  traveler: { id: number; name: string; quote: string; bio: string; tags: string[] };
  reason: string;
  match_score: number;
  mode: DrawMode;
}

const SPIN_MS = 1450;

/** 万花筒抽取盘 —— conic 色环 + 十二面镜筒质感，framer-motion 旋转 */
function KaleidoscopeWheel({ spinning, size = 230 }: { spinning: boolean; size?: number }) {
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }} aria-hidden>
      {/* 外层辉光 */}
      <div
        className="absolute inset-0 rounded-full blur-2xl"
        style={{
          background:
            "radial-gradient(circle, rgba(50,230,255,0.18) 0%, rgba(22,119,255,0.13) 45%, rgba(100,91,255,0.04) 70%, transparent 100%)",
          transform: "scale(1.12)",
        }}
      />
      {/* 镜盘 */}
      <motion.div
        className="absolute inset-0 rounded-full overflow-hidden"
        style={{
          background:
            "repeating-conic-gradient(from 0deg, #32E6FF 0deg, #1677FF 9deg, #7D4DFF 15deg, #063B88 23deg, #0B245B 30deg)",
        }}
        animate={{ rotate: spinning ? 900 : 360 }}
        transition={
          spinning
            ? { duration: SPIN_MS / 1000, ease: [0.15, 0.6, 0.2, 1] }
            : { duration: 26, ease: "linear", repeat: Infinity }
        }
      >
        {/* 内层反向纹样，增加折射层次 */}
        <motion.div
          className="absolute inset-[12%] rounded-full mix-blend-screen opacity-70"
          style={{
            background:
              "repeating-conic-gradient(from 0deg, rgba(185,252,255,0.9) 0deg, rgba(22,119,255,0.5) 12deg, rgba(125,77,255,0.4) 20deg, transparent 30deg)",
          }}
          animate={{ rotate: spinning ? -600 : -360 }}
          transition={
            spinning
              ? { duration: SPIN_MS / 1000, ease: [0.15, 0.6, 0.2, 1] }
              : { duration: 20, ease: "linear", repeat: Infinity }
          }
        />
        {/* 中心暗场 + 高光核心 */}
        <div
          className="absolute inset-0 rounded-full"
          style={{
            background:
              "radial-gradient(circle, rgba(255,255,255,0.95) 0%, rgba(50,230,255,0.6) 8%, transparent 26%), radial-gradient(circle, transparent 60%, rgba(5,12,34,0.7) 100%)",
          }}
        />
      </motion.div>
      {/* 镜筒边框 */}
      <div
        className="absolute inset-0 rounded-full"
        style={{
          border: "1.5px solid transparent",
          background:
            "conic-gradient(from 0deg, #32E6FF, #1677FF, #33B8FF, #6C5CFF, #1677FF, #32E6FF) border-box",
          WebkitMask: "linear-gradient(#000 0 0) padding-box, linear-gradient(#000 0 0)",
          WebkitMaskComposite: "xor",
          maskComposite: "exclude",
        }}
      />
      <div className="absolute inset-[6px] rounded-full border border-white/15" />
    </div>
  );
}

export function KaleidoscopeDraw({ onClose }: { onClose: () => void }) {
  const router = useRouter();
  const travelers = useData((s) => s.travelers);

  const [phase, setPhase] = useState<Phase>("choose");
  const [mode, setMode] = useState<DrawMode>("similar");
  const [drawn, setDrawn] = useState<Traveler | null>(null);
  const [reason, setReason] = useState<string | null>(null);
  const [recentIds, setRecentIds] = useState<number[]>([]);
  const busyRef = useRef(false);

  const pool = travelers.length ? travelers : DEMO_TRAVELERS;

  /** 依 id 补全 initial/hue（后端抽取只回 id/name/quote/bio/tags） */
  const resolveTraveler = (id: number): Traveler | null =>
    pool.find((t) => t.id === id) ?? null;

  const spin = async () => {
    if (busyRef.current) return;
    busyRef.current = true;
    setPhase("spinning");

    const wait = new Promise<void>((r) => setTimeout(r, SPIN_MS));
    const draw = callFunction<KaleidoscopeDrawResponse>("community", {
      action: "kaleidoscope_draw",
      mode,
      recently_viewed_ids: recentIds,
    })
      .then((res) => res)
      .catch(() => null);

    const [picked] = await Promise.all([draw, wait]);

    let chosen: Traveler | null = null;
    let chosenReason: string | null = null;
    if (picked) {
      chosen = resolveTraveler(picked.traveler.id) ?? {
        // 池中缺失时用返回字段兜底构造卡片
        id: picked.traveler.id,
        name: picked.traveler.name,
        initial: picked.traveler.name.slice(0, 1),
        hue: picked.traveler.id % 5,
        is_similar: mode === "similar",
        quote: picked.traveler.quote,
        bio: picked.traveler.bio,
        tags: picked.traveler.tags ?? [],
        dims: [],
        trajectory: [],
      };
      chosenReason = picked.reason;
    }
    if (!chosen) {
      // 本地兜底：按 mode 偏好随机
      const wanted = pool.filter((t) => (mode === "similar" ? t.is_similar : !t.is_similar));
      const bucket = wanted.length ? wanted : pool;
      chosen = bucket[Math.floor(Math.random() * bucket.length)] ?? null;
      chosenReason = null;
    }

    if (chosen) setRecentIds((prev) => [...new Set([...prev, chosen!.id])].slice(-20));
    setDrawn(chosen);
    setReason(chosenReason);
    setPhase("result");
    busyRef.current = false;
  };

  const reset = () => {
    setPhase("choose");
    setDrawn(null);
    setReason(null);
  };

  const title =
    phase === "choose"
      ? "你想看见哪一面的人生？"
      : phase === "spinning"
        ? mode === "similar"
          ? "寻找和你同路的人"
          : "寻找你没走过的路"
        : mode === "similar"
          ? "与你的画像最相似的人"
          : "与你的轨迹完全相反的人";

  const sub =
    phase === "choose"
      ? "万花筒会为你转出一位真实的旅人"
      : phase === "spinning"
        ? null
        : (reason ?? "看看 TA 的人生轨迹");

  return (
    <motion.div
      className="fixed inset-0 z-[80] flex flex-col items-center overflow-y-auto no-scrollbar px-7 py-16"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      style={{
        background:
          "radial-gradient(300px circle at 50% 30%, rgba(94,150,255,0.075), transparent), radial-gradient(240px circle at 50% 90%, rgba(227,92,193,0.035), transparent), rgba(6,8,14,0.97)",
        backdropFilter: "blur(18px)",
      }}
    >
      <button
        onClick={onClose}
        className="absolute right-5 top-6 text-[12.5px] text-faint transition active:scale-95"
      >
        关闭 ✕
      </button>

      <div className="flex w-full max-w-[420px] flex-1 flex-col items-center justify-center gap-8 py-6">
        {/* 文案 */}
        <div className="flex flex-col items-center gap-2 text-center">
          <h2 className="text-[20px] font-bold tracking-[0.8px] text-ink">{title}</h2>
          {sub && <p className="text-[12px] leading-relaxed text-sub">{sub}</p>}
        </div>

        {/* 主内容 */}
        <div className="flex w-full flex-col items-center">
          {phase === "choose" && (
            <div className="grid w-full grid-cols-2 gap-3">
              <ModeCard
                emoji="🪞"
                title="和我有类似经历"
                desc={"在同路人身上\n看见自己的下一步"}
                on={mode === "similar"}
                onClick={() => setMode("similar")}
              />
              <ModeCard
                emoji="🔭"
                title="和我经历完全相反"
                desc={"在另一种人生里\n看见没走过的路"}
                on={mode === "different"}
                onClick={() => setMode("different")}
              />
            </div>
          )}

          {phase === "spinning" && (
            <div className="flex flex-col items-center gap-5">
              <KaleidoscopeWheel spinning />
              <span className="text-[12px] tracking-[1.5px] text-faint">
                光在旋转，人生在折叠……
              </span>
            </div>
          )}

          {phase === "result" && drawn && <ResultCard traveler={drawn} />}
        </div>

        {/* 底部动作 */}
        <div className="flex w-full flex-col items-center gap-3">
          {phase === "choose" && (
            <button
              onClick={spin}
              className="w-full rounded-chip bg-btn-g py-[15px] text-[15px] font-semibold text-white shadow-[0_8px_14px_rgba(79,125,255,0.6)] transition active:scale-[0.97]"
            >
              开始转动 · 抽一位旅人
            </button>
          )}
          {phase === "result" && drawn && (
            <>
              <button
                onClick={() => router.push(`/traveler/${drawn.id}`)}
                className="w-full rounded-chip bg-btn-g py-[15px] text-[15px] font-semibold text-white shadow-[0_8px_14px_rgba(79,125,255,0.6)] transition active:scale-[0.97]"
              >
                查看 TA 的主页
              </button>
              <button
                onClick={reset}
                className="text-[12.5px] text-faint transition active:scale-95"
              >
                再转一次
              </button>
            </>
          )}
        </div>
      </div>
    </motion.div>
  );
}

function ModeCard({
  emoji,
  title,
  desc,
  on,
  onClick,
}: {
  emoji: string;
  title: string;
  desc: string;
  on: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex flex-col items-center rounded-[20px] border px-[14px] py-5 text-center transition active:scale-[0.97] ${
        on
          ? "-translate-y-0.5 border-[#6FA5FF]/70"
          : "border-line bg-card"
      }`}
      style={
        on
          ? {
              background:
                "linear-gradient(135deg, rgba(94,150,255,0.16), rgba(227,92,193,0.1))",
            }
          : undefined
      }
    >
      <span className="text-[22px]">{emoji}</span>
      <span className="mt-2.5 text-[13.5px] font-semibold text-ink">{title}</span>
      <span className="mt-1.5 whitespace-pre-line text-[11px] leading-relaxed text-sub">{desc}</span>
    </button>
  );
}

function ResultCard({ traveler }: { traveler: Traveler }) {
  return (
    <motion.div
      initial={{ scale: 0.92, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      transition={{ type: "spring", stiffness: 260, damping: 22 }}
      className="w-full max-w-[340px] overflow-hidden rounded-[24px] border border-line bg-card shadow-[0_20px_40px_rgba(0,0,0,0.5)]"
    >
      <HueBandHeader
        initial={traveler.initial}
        hueIndex={traveler.hue}
        bandHeight={74}
        avatarSize={52}
        imageSrc={mockAvatarById(traveler.id)}
      />
      <div className="flex flex-col gap-2 px-5 pb-5 pt-7">
        <span className="text-[16px] font-semibold text-ink">{traveler.name}</span>
        <p className="text-[13px] leading-relaxed text-sub">「{traveler.quote}」</p>
        {traveler.tags.length > 0 && (
          <div className="mt-1 flex flex-wrap gap-1.5">
            {traveler.tags.map((tag) => (
              <TagPill key={tag} text={tag} />
            ))}
          </div>
        )}
      </div>
    </motion.div>
  );
}
