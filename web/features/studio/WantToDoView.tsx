"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { FocusShell } from "@/components/shell/FocusShell";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/Toast";
import { useHome } from "@/features/home/store";
import { callFunction } from "@/lib/supabase";
import {
  DISCOVERY_QUESTIONS,
  analysisRequest,
  isSelfDiscoveryAnalysis,
  localAnalysis,
  type DiscoveryAnswer,
  type DiscoveryInsight,
  type SelfDiscoveryAnalysis,
} from "./self-discovery";

type Phase = "intro" | "questions" | "analyzing" | "result";

const EMPTY_ANSWER: DiscoveryAnswer = { selected: [], custom: [] };

export function WantToDoView() {
  const router = useRouter();
  const showToast = useToast((state) => state.show);
  const saveDimension = useHome((state) => state.saveDimension);

  const [phase, setPhase] = useState<Phase>("intro");
  const [index, setIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, DiscoveryAnswer>>({});
  const [customDraft, setCustomDraft] = useState("");
  const [analysis, setAnalysis] = useState<SelfDiscoveryAnalysis | null>(null);
  const [usedAi, setUsedAi] = useState(false);
  const [saved, setSaved] = useState(false);

  const question = DISCOVERY_QUESTIONS[index];
  const current = answers[question?.id] ?? EMPTY_ANSWER;
  const answered = current.selected.length + current.custom.length > 0;
  const canAdvance = answered || customDraft.trim().length > 0;

  const updateCurrent = (next: DiscoveryAnswer) => {
    if (!question) return;
    setAnswers((previous) => ({ ...previous, [question.id]: next }));
  };

  const toggle = (label: string) => {
    if (current.selected.includes(label)) {
      updateCurrent({
        ...current,
        selected: current.selected.filter((item) => item !== label),
      });
      return;
    }
    if (current.selected.length >= 3) {
      showToast("每题最多选择 3 项，也可以在下方补充自己的答案");
      return;
    }
    updateCurrent({ ...current, selected: [...current.selected, label] });
  };

  const addCustom = () => {
    const value = customDraft.trim();
    if (!value) return;
    if (current.custom.includes(value)) {
      setCustomDraft("");
      return;
    }
    if (current.custom.length >= 2) {
      showToast("每题最多补充 2 条自己的答案");
      return;
    }
    updateCurrent({ ...current, custom: [...current.custom, value] });
    setCustomDraft("");
  };

  const removeCustom = (value: string) => {
    updateCurrent({ ...current, custom: current.custom.filter((item) => item !== value) });
  };

  const runAnalysis = async (finalAnswers: Record<string, DiscoveryAnswer>) => {
    setPhase("analyzing");
    setSaved(false);
    try {
      const result = await callFunction<SelfDiscoveryAnalysis>(
        "analyze-self-discovery",
        analysisRequest(finalAnswers),
      );
      if (!isSelfDiscoveryAnalysis(result)) throw new Error("AI 返回结构无效");
      setAnalysis(result);
      setUsedAi(true);
    } catch {
      setAnalysis(localAnalysis(finalAnswers));
      setUsedAi(false);
      showToast("AI 暂时不可用，已先按重复证据生成结果");
    } finally {
      setPhase("result");
    }
  };

  const next = () => {
    if (!canAdvance || !question) return;
    const pendingCustom = customDraft.trim();
    let finalAnswers = answers;
    if (
      pendingCustom &&
      current.custom.length < 2 &&
      !current.custom.includes(pendingCustom)
    ) {
      const nextAnswer = { ...current, custom: [...current.custom, pendingCustom] };
      finalAnswers = { ...answers, [question.id]: nextAnswer };
      setAnswers(finalAnswers);
    }
    setCustomDraft("");
    if (index === DISCOVERY_QUESTIONS.length - 1) {
      void runAnalysis(finalAnswers);
      return;
    }
    setIndex((value) => value + 1);
  };

  const back = () => {
    setCustomDraft("");
    if (phase === "result") {
      setPhase("questions");
      setIndex(DISCOVERY_QUESTIONS.length - 1);
      return;
    }
    if (phase === "questions" && index > 0) {
      setIndex((value) => value - 1);
      return;
    }
    if (phase === "questions") {
      setPhase("intro");
      return;
    }
    router.back();
  };

  const save = () => {
    if (!analysis || saved) return;
    saveDimension("like", analysis.likes.map((item) => item.label).slice(0, 5));
    saveDimension("skill", analysis.strengths.map((item) => item.label).slice(0, 5));
    setSaved(true);
    showToast("已同时写入“我喜欢”和“我擅长”");
  };

  const progress = phase === "intro"
    ? 0
    : phase === "result" || phase === "analyzing"
      ? 1
      : (index + 1) / DISCOVERY_QUESTIONS.length;

  return (
    <FocusShell
      title="喜欢 × 擅长"
      subtitle="想做的事探索"
      progress={progress}
      progressLabel={phase === "questions" ? `${index + 1}/${DISCOVERY_QUESTIONS.length}` : undefined}
      onExit={() => router.back()}
      exitLabel="退出探索"
    >
      {phase === "intro" && (
        <div className="mx-auto flex w-full max-w-[760px] flex-1 flex-col px-5 pb-8 pt-7 md:px-8 md:pt-12">
          <div className="text-micro font-semibold tracking-[2.4px] text-brand">
            SELF-UNDERSTANDING METHOD
          </div>
          <h1 className="mt-3 text-[28px] font-bold leading-[1.35] text-ink md:text-[36px]">
            用完整证据链，找到<br />你喜欢和擅长的事
          </h1>
          <p className="mt-4 max-w-[62ch] text-body leading-[1.9] text-sub">
            沿用《如何找到想做的事》的“喜欢 × 擅长 × 价值观”方法结构，
            通过 12 个原创情境寻找你的注意力、投入、他人反馈与成功模式，最后交给 AI 综合分析。
          </p>

          <div className="mt-7 grid gap-3 md:grid-cols-[1fr_auto_1fr_auto_1fr] md:items-center">
            <FormulaCard eyebrow="WHAT" title="喜欢的事" desc="反复吸引你的内容领域" tint="#E35CC1" />
            <span className="hidden text-title text-faint md:block">×</span>
            <FormulaCard eyebrow="HOW" title="擅长的事" desc="自然反复使用的行为模式" tint="#5E96FF" />
            <span className="hidden text-title text-faint md:block">→</span>
            <FormulaCard eyebrow="AI SYNTHESIS" title="尝试方向" desc="结合价值观给出行动假设" tint="#3ED9A4" />
          </div>

          <div className="mt-6 grid gap-2.5 rounded-tile border border-line bg-card p-4 text-footnote leading-[1.7] text-sub sm:grid-cols-3">
            <div><b className="text-ink">01 多选</b><br />每题可选 1–3 项</div>
            <div><b className="text-ink">02 自由回答</b><br />选项之外也能表达</div>
            <div><b className="text-ink">03 AI 分析</b><br />区分兴趣与可复用优势</div>
          </div>

          <p className="mt-4 text-micro leading-[1.7] text-faint">
            题目为方法论基础上的产品化原创表达，不复制书中原句。自由回答仅用于生成本次分析结果。
          </p>

          <Button size="lg" className="mt-7 w-full md:self-start md:w-auto" onClick={() => setPhase("questions")}>
            开始完整探索 · 约 10 分钟
          </Button>
        </div>
      )}

      {phase === "questions" && question && (
        <div className="mx-auto flex w-full max-w-[780px] flex-1 flex-col px-5 pb-7 pt-6 md:px-8 md:pt-10">
          <span className="text-micro font-semibold tracking-[2px] text-brand">{question.eyebrow}</span>
          <h1 className="mt-2 text-[24px] font-bold leading-[1.5] text-ink md:text-[30px]">
            {question.title}
          </h1>
          <p className="mt-2 text-footnote leading-[1.8] text-sub">{question.hint}</p>

          <div className="mt-5 grid gap-2.5 sm:grid-cols-2">
            {question.options.map((option) => {
              const selected = current.selected.includes(option.label);
              return (
                <button
                  key={option.label}
                  aria-pressed={selected}
                  onClick={() => toggle(option.label)}
                  className="flex min-h-[70px] items-center gap-3 rounded-tile border px-4 py-3 text-left transition active:scale-[0.98]"
                  style={{
                    background: selected ? "rgba(83,115,255,0.18)" : "var(--color-card)",
                    borderColor: selected ? "rgba(111,165,255,0.72)" : "var(--color-line)",
                  }}
                >
                  <span className="grid size-9 shrink-0 place-items-center rounded-field bg-raised text-callout text-brand-lite">
                    {selected ? "✓" : option.glyph}
                  </span>
                  <span className="text-body font-medium leading-[1.55] text-ink">{option.label}</span>
                </button>
              );
            })}
          </div>

          <div className="mt-4 rounded-tile border border-line bg-card p-3.5">
            <label htmlFor={`custom-${question.id}`} className="text-caption font-semibold text-ink">
              选项里没有我的答案
            </label>
            <div className="mt-2 flex gap-2">
              <input
                id={`custom-${question.id}`}
                value={customDraft}
                maxLength={80}
                placeholder="写下真实答案，按回车添加"
                onChange={(event) => setCustomDraft(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault();
                    addCustom();
                  }
                }}
                className="min-w-0 flex-1 rounded-field border border-line bg-canvas px-3.5 py-3 text-body text-ink outline-none placeholder:text-faint focus:border-brand"
              />
              <button
                type="button"
                onClick={addCustom}
                disabled={!customDraft.trim()}
                className="rounded-field border border-line px-4 text-caption font-semibold text-brand disabled:opacity-35"
              >
                添加
              </button>
            </div>
            {current.custom.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-2">
                {current.custom.map((value) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => removeCustom(value)}
                    aria-label={`删除自定义答案：${value}`}
                    className="rounded-chip border border-brand/35 bg-brand/10 px-3 py-1.5 text-caption text-brand-lite"
                  >
                    {value} <span aria-hidden="true">×</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="mt-6 flex items-center gap-3">
            <Button variant="ghost" size="lg" className="flex-1" onClick={back}>
              返回
            </Button>
            <Button size="lg" className="flex-[1.5]" disabled={!canAdvance} onClick={next}>
              {index === DISCOVERY_QUESTIONS.length - 1 ? "交给 AI 综合分析" : "继续"}
            </Button>
          </div>
        </div>
      )}

      {phase === "analyzing" && (
        <div className="mx-auto flex w-full max-w-[620px] flex-1 flex-col items-center justify-center px-6 py-16 text-center">
          <div className="relative grid size-24 place-items-center rounded-full border border-brand/30 bg-brand/10">
            <div className="absolute inset-2 animate-spin rounded-full border border-transparent border-t-brand" />
            <span className="text-[28px] text-brand-lite">✦</span>
          </div>
          <h1 className="mt-6 text-title font-bold text-ink">AI 正在整理你的证据</h1>
          <p className="mt-3 text-body leading-[1.8] text-sub">
            它会区分“被什么内容吸引”和“习惯怎样行动”，并结合你的自由回答寻找重复线索。
          </p>
        </div>
      )}

      {phase === "result" && analysis && (
        <div className="mx-auto flex w-full max-w-[860px] flex-1 flex-col px-5 pb-9 pt-6 md:px-8 md:pt-9">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-micro font-semibold tracking-[2.4px] text-teal">YOUR CLUES</span>
            <span className="rounded-chip bg-teal/10 px-2.5 py-1 text-micro text-teal">
              {usedAi ? "AI 综合分析" : "本地证据归纳"}
            </span>
          </div>
          <h1 className="mt-2 text-[28px] font-bold text-ink">你反复出现的两组线索</h1>
          <p className="mt-2 max-w-[70ch] text-footnote leading-[1.8] text-sub">{analysis.summary}</p>

          <div className="mt-6 grid gap-4 md:grid-cols-2">
            <InsightCard title="我喜欢的事" eyebrow="WHAT" tint="#E35CC1" items={analysis.likes} />
            <InsightCard title="我擅长的事" eyebrow="HOW" tint="#5E96FF" items={analysis.strengths} />
          </div>

          <div className="mt-4 rounded-card border border-violet-soft/25 bg-violet-soft/8 p-5">
            <div className="text-micro font-semibold tracking-[2px] text-brand-lite">可以开始验证的方向</div>
            <div className="mt-4 grid gap-3 md:grid-cols-3">
              {analysis.directions.map((direction, directionIndex) => (
                <div key={`${direction.title}-${directionIndex}`} className="rounded-tile border border-line bg-card p-4">
                  <div className="text-body font-semibold leading-[1.6] text-ink">{direction.title}</div>
                  <p className="mt-2 text-caption leading-[1.7] text-sub">{direction.why}</p>
                  <div className="mt-3 border-t border-line pt-3 text-caption leading-[1.7] text-brand-lite">
                    第一步：{direction.first_step}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <p className="mt-4 text-micro leading-[1.7] text-faint">{analysis.confidence_note}</p>

          <div className="mt-7 flex flex-col gap-3 sm:flex-row">
            <Button variant="ghost" size="lg" className="sm:flex-1" onClick={back}>
              返回修改
            </Button>
            {!saved ? (
              <Button size="lg" className="sm:flex-[1.6]" onClick={save}>
                保存到我的动态画像
              </Button>
            ) : (
              <Button size="lg" className="sm:flex-[1.6]" onClick={() => router.push("/#dynamic-portrait")}>
                查看我的动态画像
              </Button>
            )}
          </div>
        </div>
      )}
    </FocusShell>
  );
}

function FormulaCard({
  eyebrow,
  title,
  desc,
  tint,
}: {
  eyebrow: string;
  title: string;
  desc: string;
  tint: string;
}) {
  return (
    <div className="rounded-tile border border-line bg-card p-4">
      <div className="text-micro font-semibold tracking-[1.6px]" style={{ color: tint }}>
        {eyebrow}
      </div>
      <div className="mt-1 text-lead font-bold text-ink">{title}</div>
      <div className="mt-1 text-caption leading-[1.6] text-sub">{desc}</div>
    </div>
  );
}

function InsightCard({
  title,
  eyebrow,
  tint,
  items,
}: {
  title: string;
  eyebrow: string;
  tint: string;
  items: DiscoveryInsight[];
}) {
  return (
    <div className="rounded-card border border-line bg-card p-5">
      <div className="text-micro font-semibold tracking-[1.8px]" style={{ color: tint }}>
        {eyebrow}
      </div>
      <h2 className="mt-1 text-subtitle font-bold text-ink">{title}</h2>
      <div className="mt-4 flex flex-col gap-3">
        {items.map((item, itemIndex) => (
          <div key={`${item.label}-${itemIndex}`} className="rounded-field bg-raised px-3.5 py-3">
            <div className="flex items-center gap-2.5">
              <span className="text-caption font-bold text-faint">0{itemIndex + 1}</span>
              <span className="text-body font-semibold text-ink">{item.label}</span>
            </div>
            <div className="mt-2 text-micro font-medium text-brand-lite">{item.evidence}</div>
            <p className="mt-1 text-caption leading-[1.7] text-sub">{item.reason}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
