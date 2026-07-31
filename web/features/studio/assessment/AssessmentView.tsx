"use client";
/* 测评器 —— 移植 iOS AssessmentView / AssessmentResultView。
   intro（引子 + 说明）→ 逐题 5 点李克特量表 → 结果（维度条 + 叙事）。
   进度以 localStorage 持久化（可随时退出续答）；结果写回 save-profile。全屏页。 */

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { Foot, ResultBlock, withAlpha } from "@/features/card-game/ui";
import { FocusShell } from "@/components/shell/FocusShell";
import { useToast } from "@/components/ui/Toast";
import { callFunction } from "@/lib/supabase";
import { useData } from "@/stores/data";
import { assessmentConfig, facetMeta, type AssessmentKind } from "./data";
import {
  buildResult,
  clearProgress,
  hollandCode,
  hollandNarrative,
  hydrateDims,
  loadProgress,
  loadResult,
  saveProfilePayload,
  saveProgress,
  saveResult,
  type AssessmentResult,
  type DimScore,
} from "./engine";

type Phase = "intro" | "quiz" | "result";

export function AssessmentView({ kind }: { kind: AssessmentKind }) {
  const router = useRouter();
  const cfg = assessmentConfig(kind);
  const itemCount = cfg.items.length;

  const [phase, setPhase] = useState<Phase>("intro");
  const [answers, setAnswers] = useState<(number | null)[]>(() =>
    new Array(itemCount).fill(null),
  );
  const [index, setIndex] = useState(0);
  const [saved, setSaved] = useState<AssessmentResult | null>(null);

  /* 冷启动：已有结果直接进结果页；否则续答未答处 */
  useEffect(() => {
    const done = loadResult(kind);
    if (done) {
      setSaved(done);
      setPhase("result");
      return;
    }
    const restored = loadProgress(kind, itemCount);
    setAnswers(restored);
    const firstUnanswered = restored.findIndex((a) => a === null);
    if (restored.some((a) => a !== null)) {
      setIndex(firstUnanswered === -1 ? itemCount - 1 : firstUnanswered);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [kind]);

  const answeredCount = useMemo(() => answers.filter((a) => a !== null).length, [answers]);
  const allAnswered = answeredCount === itemCount;

  const choose = useCallback(
    (choice: number) => {
      setAnswers((prev) => {
        const next = [...prev];
        next[index] = choice;
        saveProgress(kind, next);
        return next;
      });
      // 自动前进；最后一题停留由「查看结果」触发
      window.setTimeout(() => {
        setIndex((i) => Math.min(i + 1, itemCount - 1));
      }, 180);
    },
    [index, itemCount, kind],
  );

  const goResult = () => {
    const result = buildResult(kind, answers);
    saveResult(result);
    clearProgress(kind);
    setSaved(result);
    setPhase("result");
  };

  const restart = () => {
    setAnswers(new Array(itemCount).fill(null));
    setIndex(0);
    setSaved(null);
    clearProgress(kind);
    setPhase("quiz");
  };

  const back = () => {
    if (phase === "quiz") {
      if (index > 0) setIndex((i) => i - 1);
      else setPhase("intro");
      return;
    }
    router.back();
  };

  return (
    /* 专注模式：测评是有开始与结束的任务，不是一个可以随手逛开的页面。
       全站导航由 AppShell 依 isFocusRoute 收起，这里只留任务条与退出。
       退出用 ✕ 而不是 ‹ —— 用户要的是「离开这个测评」而非「回到上一屏」。 */
    <FocusShell
      title={cfg.title}
      subtitle={cfg.sub}
      onExit={back}
      exitLabel="退出测评"
      progress={phase === "quiz" ? answeredCount / itemCount : undefined}
      progressLabel={phase === "quiz" ? `${answeredCount}/${itemCount}` : undefined}
    >
      <AnimatePresence mode="wait">
        <motion.div
          key={phase}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -6 }}
          transition={{ duration: 0.22, ease: "easeOut" }}
          className="flex min-h-0 flex-1 flex-col"
        >
          {phase === "intro" && (
            <IntroPhase
              cfg={cfg}
              hasProgress={answeredCount > 0 && !allAnswered}
              onStart={() => setPhase("quiz")}
            />
          )}
          {phase === "quiz" && (
            <QuizPhase
              cfg={cfg}
              index={index}
              answers={answers}
              onChoose={choose}
              onJump={setIndex}
              allAnswered={allAnswered}
              onFinish={goResult}
            />
          )}
          {phase === "result" && saved && (
            <ResultPhase kind={kind} result={saved} onRestart={restart} />
          )}
        </motion.div>
      </AnimatePresence>
    </FocusShell>
  );
}

/* ============ intro ============ */

function IntroPhase({
  cfg,
  hasProgress,
  onStart,
}: {
  cfg: ReturnType<typeof assessmentConfig>;
  hasProgress: boolean;
  onStart: () => void;
}) {
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex-1">
        <div className="mx-auto flex w-full max-w-measure flex-col gap-4 px-6 pt-4 pb-[26px]">
          <div className="text-[9.5px] font-semibold tracking-[2.6px] text-brand">
            {cfg.kicker}
          </div>
          <h1 className="whitespace-pre-line text-[24px] font-bold leading-[1.5] text-ink">
            {cfg.introTitle}
          </h1>
          <p className="text-[13px] leading-[1.9] text-sub">{cfg.intro}</p>

          <div className="flex flex-col gap-2.5">
            {cfg.notices.map((notice, i) => (
              <div
                key={i}
                className="flex items-start gap-3 rounded-[14px] border border-line bg-card p-3"
              >
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-brand-deep/20 text-[11px] font-bold text-brand">
                  {i + 1}
                </span>
                <p className="text-[12px] leading-[1.7] text-sub">{notice}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
      <Foot title={hasProgress ? "继续上次测评" : "开始测评"} enabled onClick={onStart} />
    </div>
  );
}

/* ============ 逐题 ============ */

function QuizPhase({
  cfg,
  index,
  answers,
  onChoose,
  onJump,
  allAnswered,
  onFinish,
}: {
  cfg: ReturnType<typeof assessmentConfig>;
  index: number;
  answers: (number | null)[];
  onChoose: (choice: number) => void;
  onJump: (i: number) => void;
  allAnswered: boolean;
  onFinish: () => void;
}) {
  const item = cfg.items[index];
  const current = answers[index];
  const n = cfg.likert.length;

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex-1">
        <div className="mx-auto flex w-full max-w-measure flex-col gap-6 px-6 pt-8 pb-6">
          <div className="flex flex-col items-center gap-3 text-center">
            <span className="text-[11px] tracking-[2px] text-faint">
              第 {index + 1} / {cfg.items.length} 题
            </span>
            <motion.h2
              key={index}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.2 }}
              className="text-[20px] font-bold leading-[1.6] text-ink"
            >
              {item.text}
            </motion.h2>
          </div>

          {/* 李克特 5 点 */}
          <div className="flex flex-col gap-2.5">
            {cfg.likert.map((label, i) => {
              const on = current === i;
              // 首尾正/负、中间中性配色（0..n-1）
              const t = n > 1 ? i / (n - 1) : 0.5;
              const accent = t < 0.5 ? "#6FD0B0" : t > 0.5 ? "#8FA4FF" : "#8F91B8";
              return (
                <button
                  key={i}
                  onClick={() => onChoose(i)}
                  className="flex items-center gap-3 rounded-[16px] border px-4 py-[15px] text-left transition active:scale-[0.98]"
                  style={{
                    background: on ? withAlpha(accent, 0.14) : "var(--color-card)",
                    borderColor: on ? withAlpha(accent, 0.6) : "var(--color-line)",
                    borderWidth: on ? 1.5 : 1,
                  }}
                >
                  <span
                    className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[12px] font-bold"
                    style={{
                      background: on ? accent : "var(--color-raised)",
                      color: on ? "#0B0F18" : "var(--color-faint)",
                    }}
                  >
                    {on ? "✓" : i + 1}
                  </span>
                  <span
                    className="text-[14px]"
                    style={{ color: on ? "#fff" : "var(--color-sub)" }}
                  >
                    {label}
                  </span>
                </button>
              );
            })}
          </div>

          {/* 快速跳转（前一题） */}
          {index > 0 && (
            <button
              onClick={() => onJump(index - 1)}
              className="self-center text-[12px] text-faint"
            >
              ‹ 上一题
            </button>
          )}
        </div>
      </div>
      {allAnswered && (
        <Foot title="查看我的结果" enabled onClick={onFinish} />
      )}
    </div>
  );
}

/* ============ 结果 ============ */

function ResultPhase({
  kind,
  result,
  onRestart,
}: {
  kind: AssessmentKind;
  result: AssessmentResult;
  onRestart: () => void;
}) {
  const router = useRouter();
  const cfg = assessmentConfig(kind);
  const show = useToast((s) => s.show);
  const [saving, setSaving] = useState(false);
  const [savedToProfile, setSavedToProfile] = useState(false);

  const dims = useMemo(() => hydrateDims(kind, result.dims), [kind, result]);
  const sorted = useMemo(() => [...dims].sort((a, b) => b.percent - a.percent), [dims]);

  const saveToProfile = async () => {
    if (saving || savedToProfile) return;
    setSaving(true);
    try {
      await callFunction("save-profile", saveProfilePayload(kind, result));
      useData.getState().invalidateProfile();
      setSavedToProfile(true);
      show(`已写入你的画像：${result.tags.join(" · ")}`);
    } catch {
      show("云端同步失败，结果已留在本机");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex-1">
        <div className="mx-auto flex w-full max-w-measure flex-col gap-4 px-6 pt-5 pb-6">
          {/* 标题 */}
          <div className="flex flex-col gap-1.5">
            <span className="text-[10px] tracking-[2px] text-faint">{cfg.resultSub}</span>
            <h1 className="text-aurora text-[26px] font-bold">{cfg.resultTitle}</h1>
          </div>

          {/* kind 专属摘要 */}
          {kind === "holland" && <HollandSummary dims={dims} />}
          {kind === "bigfive" && <BigFiveSummary mbti={result.mbti} />}

          {/* 维度条 */}
          <div className="flex flex-col gap-2.5">
            {sorted.map((d) => (
              <DimBar key={d.key} dim={d} />
            ))}
          </div>

          {/* 大五 facet 明细 */}
          {kind === "bigfive" && result.facets && (
            <FacetGrid facets={result.facets} dims={dims} />
          )}

          <p className="mt-1 text-[10.5px] leading-[1.7] text-faint">
            结果用于自我探索，不用于诊断或能力评判。答案与结果默认只保存在本机，
            点下方按钮才会写入你的动态画像。
          </p>

          <button
            onClick={onRestart}
            className="self-start text-[12px] text-brand active:opacity-70"
          >
            重新测评 ↻
          </button>
        </div>
      </div>

      <div className="border-t border-line px-5 pt-3 pb-[14px]">
        <div className="mx-auto flex w-full max-w-measure gap-3">
          <button
            onClick={() => router.push("/studio")}
            className="flex-1 rounded-chip border border-line py-[15px] text-[13.5px] font-semibold text-sub transition active:scale-[0.97]"
          >
            去画像工坊
          </button>
          <button
            disabled={saving || savedToProfile}
            onClick={saveToProfile}
            className="flex-[1.4] rounded-chip bg-btn-g py-[15px] text-[13.5px] font-semibold text-white transition active:scale-[0.97] disabled:opacity-45"
          >
            {savedToProfile ? "已写入画像 ✓" : saving ? "正在保存…" : cfg.saveLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

function DimBar({ dim }: { dim: DimScore }) {
  const pct = Math.round(dim.percent * 100);
  return (
    <div className="rounded-[14px] border border-line bg-card p-3.5">
      <div className="flex items-baseline justify-between">
        <div className="flex items-baseline gap-2">
          <span className="text-[14px] font-semibold text-ink">{dim.name}</span>
          <span className="text-[11px]" style={{ color: dim.color }}>
            {dim.label}
          </span>
        </div>
        <span className="text-[13px] font-bold tabular-nums" style={{ color: dim.color }}>
          {pct}
        </span>
      </div>
      <div className="mt-2 h-[6px] overflow-hidden rounded-chip bg-raised">
        <div
          className="h-full rounded-chip transition-all duration-500"
          style={{ width: `${pct}%`, background: dim.color }}
        />
      </div>
      <p className="mt-2 text-[11px] leading-[1.7] text-sub">{dim.desc}</p>
    </div>
  );
}

function HollandSummary({ dims }: { dims: DimScore[] }) {
  const code = hollandCode(dims);
  const narrative = hollandNarrative(dims);
  return (
    <ResultBlock kicker="RIASEC CODE" tint="#789EFF">
      <div className="text-[30px] font-extrabold tracking-[4px] text-aurora">{code || "—"}</div>
      {narrative && <p className="text-[12.5px] leading-[1.8] text-sub">{narrative}</p>}
    </ResultBlock>
  );
}

function BigFiveSummary({ mbti }: { mbti?: string }) {
  if (!mbti) return null;
  return (
    <ResultBlock kicker="MBTI 倾向（由大五推导）" tint="#8F7BFF">
      <div className="text-[30px] font-extrabold tracking-[6px] text-aurora">{mbti}</div>
      <p className="text-[12px] leading-[1.7] text-sub">
        依据五维连续分数推导的类型倾向，仅供参考，不等同于正式 MBTI 测验。
      </p>
    </ResultBlock>
  );
}

function FacetGrid({
  facets,
  dims,
}: {
  facets: NonNullable<AssessmentResult["facets"]>;
  dims: DimScore[];
}) {
  const [open, setOpen] = useState(false);
  const dimName = new Map(dims.map((d) => [d.key, d.name]));
  const dimColor = new Map(dims.map((d) => [d.key, d.color]));
  const byDim = new Map<string, typeof facets>();
  for (const f of facets) {
    const dim = facetMeta(f.facet)?.d ?? "";
    const arr = byDim.get(dim) ?? [];
    arr.push(f);
    byDim.set(dim, arr);
  }
  const facetName = (facet: string) => facetMeta(facet)?.name ?? facet;

  return (
    <div className="rounded-[14px] border border-line bg-card p-3.5">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between"
      >
        <span className="text-[13px] font-semibold text-ink">30 个细分面向</span>
        <span className="text-[12px] text-brand">{open ? "收起" : "展开"}</span>
      </button>
      {open && (
        <div className="mt-3 flex flex-col gap-4">
          {[...byDim.entries()].map(([dim, list]) => (
            <div key={dim} className="flex flex-col gap-1.5">
              <span
                className="text-[11px] font-semibold"
                style={{ color: dimColor.get(dim) ?? "#8FA4FF" }}
              >
                {dimName.get(dim) ?? dim}
              </span>
              <div className="grid grid-cols-2 gap-x-4 gap-y-1.5">
                {list.map((f) => (
                  <div key={f.facet} className="flex items-center gap-2">
                    <span className="w-9 shrink-0 text-[10px] tabular-nums text-faint">
                      {Math.round(f.percent * 100)}
                    </span>
                    <div className="h-[4px] flex-1 overflow-hidden rounded-chip bg-raised">
                      <div
                        className="h-full rounded-chip"
                        style={{
                          width: `${Math.round(f.percent * 100)}%`,
                          background: dimColor.get(dim) ?? "#8FA4FF",
                        }}
                      />
                    </div>
                    <span className="w-12 shrink-0 truncate text-[10px] text-sub">
                      {facetName(f.facet)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
