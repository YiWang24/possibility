"use client";
/* 结果页 —— 移植自 iOS CardGameView.swift 的 lifeResult / relationResult */

import { useMemo } from "react";
import { motion } from "framer-motion";
import type { CardGameAiNarrativeResponse } from "@possibility/shared-types";
import type { CardGameEngine } from "./engine";
import { ResultBlock, withAlpha } from "./ui";
import { ValueCardFace } from "./ValueCardFace";

interface NarrativeProps {
  aiResult: CardGameAiNarrativeResponse | null;
  onRetry?: () => void;
}

function AiResultNotice({ aiResult, onRetry }: NarrativeProps) {
  if (!onRetry && !aiResult) return null;
  const status = aiResult?.status ?? "pending";
  const ready = status === "ready";
  const failed = status === "failed";
  return (
    <div
      className="flex flex-col gap-2 rounded-field border px-3.5 py-3 md:flex-row md:items-center md:justify-between"
      style={{
        borderColor: ready
          ? "rgba(62,217,164,0.22)"
          : failed
            ? "rgba(255,154,138,0.24)"
            : "rgba(143,123,255,0.24)",
        background: ready
          ? "rgba(62,217,164,0.055)"
          : failed
            ? "rgba(255,106,92,0.055)"
            : "rgba(143,123,255,0.06)",
      }}
    >
      <div className="min-w-0">
        <div className="flex items-center gap-2 text-micro font-semibold text-ink">
          <span
            className={`h-1.5 w-1.5 rounded-full ${
              status === "generating" || status === "pending" ? "animate-pulse" : ""
            }`}
            style={{
              background: ready ? "#3ED9A4" : failed ? "#FF9A8A" : "#8F7BFF",
            }}
          />
          {ready
            ? "AI 深度解读已完成"
            : failed
              ? "当前显示稳定的规则解读"
              : status === "generating"
                ? "AI 正在理解这一局的取舍"
                : "正在验证并保存本局证据"}
        </div>
        <p className="mt-1 text-micro leading-[1.65] text-faint">
          {ready
            ? "文案基于本局选择与理由生成；最终卡牌、分数和行为事实仍由规则引擎决定。"
            : failed
              ? "AI 暂时不可用不会影响结果；最终卡牌和规则分析均已保留。"
              : "规则结果已经可以阅读。AI 只补充个性化反思，不会改变游戏判定。"}
        </p>
      </div>
      {failed && aiResult?.retryable && (
        <button
          type="button"
          onClick={onRetry}
          className="shrink-0 self-start rounded-chip border border-white/10 bg-white/[0.045] px-3 py-1.5 text-micro font-semibold text-ink transition active:scale-[0.97] md:self-auto"
        >
          重试 AI 解读
        </button>
      )}
    </div>
  );
}

/* 婚姻 / 家庭 / 人际结果（原型 renderRelationshipResult） */
export function RelationResult({
  engine,
  aiResult,
  onRetry,
}: { engine: CardGameEngine } & NarrativeProps) {
  const cfg = engine.config;
  const accent = cfg.accent;
  const cards = engine.heldCards;
  const narrative = aiResult?.narrative;
  const forcedTrades = engine.traded.filter((entry) =>
    entry.decisionSource === "pressure_forced"
  ).length;
  const voluntaryTrades = engine.traded.length - forcedTrades;
  return (
    <div className="mx-auto flex w-full max-w-[980px] flex-col items-center gap-5 px-6 py-7 lg:py-10">
      <motion.div
        initial={{ scale: 0.6, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: "spring", stiffness: 260, damping: 18 }}
        className="flex h-[66px] w-[66px] items-center justify-center rounded-full text-[30px]"
        style={{
          color: accent,
          background: withAlpha(accent, 0.12),
          border: `1px solid ${withAlpha(accent, 0.4)}`,
        }}
      >
        {cfg.glyph}
      </motion.div>
      <h2 className="text-center text-[19px] font-bold text-ink">
        {narrative?.headline ?? `${cfg.title.slice(0, 2)}中，你最关心这 ${engine.finalCardCount} 点`}
      </h2>
      <p className="text-center text-footnote leading-[1.8] text-sub">
        {narrative?.summary ?? engine.groupNarrative}
        {!narrative && (
          <>
            <br />
            它们来自多轮情境与交换，不是固定答案，而是你此刻真实的优先级。
          </>
        )}
      </p>

      <div className="grid w-full grid-cols-3 gap-2.5 lg:gap-4">
        {cards.map((card, i) => (
          <motion.div
            key={card.id}
            initial={{ scale: 0.85, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ delay: 0.15 + i * 0.12, type: "spring", stiffness: 240, damping: 18 }}
            className="min-w-0"
          >
            <ValueCardFace card={card} accent={accent} variant="result" />
          </motion.div>
        ))}
      </div>

      <div className="w-full">
        <AiResultNotice aiResult={aiResult} onRetry={onRetry} />
      </div>

      {narrative && (
        <div className="grid w-full gap-3 md:grid-cols-2">
          <ResultBlock kicker="AI REFLECTION · 本局观察" tint="#8F7BFF" className="md:col-span-2">
            <p className="text-footnote leading-[1.85] text-ink/92">{narrative.truth.text}</p>
          </ResultBlock>
          <ResultBlock kicker="INNER TENSION · 内在张力" tint="#E35CC1">
            <p className="text-caption leading-[1.8] text-sub">{narrative.tension.text}</p>
          </ResultBlock>
          <ResultBlock kicker="POSSIBLE BLIND SPOT · 可能的盲点" tint="#FF7A4D">
            <p className="text-caption leading-[1.8] text-sub">{narrative.blind_spot.text}</p>
          </ResultBlock>
          <ResultBlock kicker="带回现实的问题" tint="#9DBCFF" className="md:col-span-2">
            <p className="text-footnote leading-[1.8] text-ink/90">{narrative.reflection_question.text}</p>
          </ResultBlock>
        </div>
      )}

      <div className="w-full rounded-tile border border-line bg-card p-[15px]">
        <div className="text-micro font-semibold tracking-[2px]" style={{ color: withAlpha(accent, 0.9) }}>
          SIGNAL · 可写入画像
        </div>
        <div className="mt-2 text-callout font-bold text-ink">
          {cards.map((c) => c.name).join(" · ")}
        </div>
        <p className="mt-2 text-caption leading-[1.8] text-sub">
          本次经历了 {engine.round} 轮情境，接受 {engine.accepted.length} 次、自主交换{" "}
          {voluntaryTrades} 次、压力强制交换 {forcedTrades} 次。这 {engine.finalCardCount}
          点会成为画像的优先信号。
        </p>
      </div>
    </div>
  );
}

/* 人生卡牌结果（原型 renderLifeResult：真相 / 原话线索 / 光谱 / 张力 / 盲点 / 反问） */
export function LifeResult({
  engine,
  aiResult,
  onRetry,
}: { engine: CardGameEngine } & NarrativeProps) {
  const a = useMemo(() => engine.lifeAnalysis(), [engine]);
  const narrative = aiResult?.narrative;
  const forcedTrades = engine.traded.filter((entry) =>
    entry.decisionSource === "pressure_forced"
  ).length;
  const voluntaryTrades = engine.traded.length - forcedTrades;
  return (
    <div className="mx-auto flex w-full max-w-[1100px] flex-col gap-4 px-5 py-6 lg:gap-5 lg:px-6 lg:py-8">
      <section className="card-game-surface grid gap-6 p-5 md:grid-cols-[minmax(0,0.86fr)_minmax(360px,1.14fr)] md:items-center lg:p-8">
        <div className="flex items-center gap-4 md:items-start">
          <motion.div
            initial={{ scale: 0.5, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: "spring", stiffness: 220, damping: 16 }}
            className="relative h-[68px] w-[68px] shrink-0 rounded-full bg-orb-conic lg:h-[82px] lg:w-[82px]"
            style={{ border: "1px solid rgba(255,255,255,0.25)" }}
          >
            <div className="absolute inset-0 rounded-full bg-[radial-gradient(circle_at_center,rgba(11,14,23,0.15)_5%,rgba(11,14,23,0.78)_95%)]" />
          </motion.div>
          <div>
            <div className="text-micro font-semibold tracking-[2px] text-faint">
              你的动态数字人 · 新切面
            </div>
            <div className="text-aurora mt-2 text-[24px] font-extrabold lg:text-[30px]">
              {narrative?.headline ?? a.title}
            </div>
            <p className="mt-2 max-w-[42ch] text-caption leading-[1.75] text-sub">
              {narrative?.summary ?? "这不是在判断你好或不好，而是在看代价出现时，你最先保护了什么。"}
            </p>
          </div>
        </div>

        <div>
          <div className="text-micro font-semibold tracking-[1.8px] text-brand">
            最终留下的 {engine.finalCardCount} 张人生底牌
          </div>
          <div className="mt-3 grid grid-cols-3 gap-2.5">
            {a.held.map((card, i) => (
              <motion.div
                key={card.id}
                initial={{ y: 18, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 0.15 + i * 0.1, type: "spring", stiffness: 230, damping: 19 }}
                className="min-w-0"
              >
                <ValueCardFace card={card} accent={engine.config.accent} variant="result" />
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      <AiResultNotice aiResult={aiResult} onRetry={onRetry} />

      <div className="grid gap-4 md:grid-cols-2">
        <ResultBlock kicker="THE TRUTH BENEATH · 内心真相" tint="#8F7BFF" className="md:col-span-2">
          <p className="text-footnote leading-[1.85] text-ink/92 lg:text-body">
            {narrative?.truth.text ?? a.truth}
          </p>
          <p className="text-micro text-faint">
            判断来自你留下、放下和为之接受挫折的牌，而不只是最终结果。
          </p>
        </ResultBlock>

        {a.voiceQuotes.length > 0 && (
          <ResultBlock kicker="YOUR OWN WORDS · 你亲口说出的线索" tint="#3ED9A4" className="md:col-span-2">
            <div className="grid w-full gap-2.5 md:grid-cols-2">
              {a.voiceQuotes.map((quote) => (
                <div key={`${quote.label}:${quote.text}`} className="w-full rounded-field bg-white/[0.035] p-3">
                  <div className="text-micro font-semibold text-teal-lite">{quote.label}</div>
                  <div className="mt-1 text-caption italic leading-[1.7] text-sub">“{quote.text}”</div>
                </div>
              ))}
            </div>
            <p className="text-caption leading-[1.7] text-sub">{a.reasonInsight}</p>
          </ResultBlock>
        )}

        <ResultBlock kicker="你的心理倾向光谱" tint="#8F7BFF">
          {a.spectrum.map((row, i) => (
            <div key={`${row.left}:${row.right}`} className="w-full">
              <div className="flex justify-between text-micro text-faint">
                <span>{row.left}</span><span>{row.right}</span>
              </div>
              <div className="relative mt-[5px] h-[14px]">
                <div className="absolute inset-x-0 top-1/2 h-1 -translate-y-1/2 rounded-chip bg-raised" />
                <motion.div
                  initial={{ left: "50%" }}
                  animate={{ left: `${row.value}%` }}
                  transition={{ delay: 0.3 + i * 0.15, duration: 0.7, ease: "easeOut" }}
                  className="absolute top-1/2 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[#9F8DF5]"
                  style={{ border: "2px solid #7666D9" }}
                />
              </div>
            </div>
          ))}
        </ResultBlock>

        <ResultBlock kicker="INNER TENSION · 内在张力" tint="#E35CC1">
          <div className="text-body font-bold text-ink">你想拥有的，和你会拿去交换的</div>
          <p className="text-caption leading-[1.8] text-sub">
            {narrative?.tension.text ?? a.tension}
          </p>
        </ResultBlock>

        <ResultBlock kicker="POSSIBLE BLIND SPOT · 可能的盲点" tint="#FF7A4D">
          <p className="text-caption leading-[1.8] text-sub">
            {narrative?.blind_spot.text ?? a.blindspot}
          </p>
        </ResultBlock>

        <ResultBlock kicker="留给真实生活的一个问题" tint="#9DBCFF">
          <p className="text-footnote leading-[1.8] text-ink/90">
            {narrative?.reflection_question.text ?? a.reflection}
          </p>
        </ResultBlock>
      </div>

      <div className="grid gap-2.5 rounded-tile border border-teal/15 bg-teal/[0.045] p-3.5 text-micro leading-[1.7] text-faint md:grid-cols-2">
        <p>
          本次推断基于：接受 {a.acceptedCount} 次、自主交换 {voluntaryTrades} 次、压力强制交换{" "}
          {forcedTrades} 次、最终保留 {a.held.length} 张底牌。它是一面自我探索的镜子，不是心理诊断。
        </p>
        <p>
          {engine.finalCardCount} 张人生底牌会作为画像信号融入动态数字形象；其余{" "}
          {a.hiddenTraits.length} 条深层推断仍默认私密，只用于帮助数字人理解你。
        </p>
      </div>
    </div>
  );
}
