"use client";
/* 结果页 —— 移植自 iOS CardGameView.swift 的 lifeResult / relationResult */

import { useMemo } from "react";
import { motion } from "framer-motion";
import type { CardGameEngine } from "./engine";
import { ResultBlock, withAlpha } from "./ui";
import { ValueCardFace } from "./ValueCardFace";

/* 婚姻 / 家庭 / 人际结果（原型 renderRelationshipResult） */
export function RelationResult({ engine }: { engine: CardGameEngine }) {
  const cfg = engine.config;
  const accent = cfg.accent;
  const cards = engine.heldCards;
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
        {cfg.title.slice(0, 2)}中，你最关心这 {engine.finalCardCount} 点
      </h2>
      <p className="text-center text-[12px] leading-[1.8] text-sub">
        {engine.groupNarrative}
        <br />
        它们来自多轮情境与交换，不是固定答案，而是你此刻真实的优先级。
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

      <div className="w-full rounded-[16px] border border-line bg-card p-[15px]">
        <div className="text-[9px] font-semibold tracking-[2px]" style={{ color: withAlpha(accent, 0.9) }}>
          SIGNAL · 可写入画像
        </div>
        <div className="mt-2 text-[14.5px] font-bold text-ink">
          {cards.map((c) => c.name).join(" · ")}
        </div>
        <p className="mt-2 text-[11.5px] leading-[1.8] text-sub">
          本次经历了 {engine.round} 轮情境，接受 {engine.accepted.length} 次、自主交换{" "}
          {voluntaryTrades} 次、压力强制交换 {forcedTrades} 次。这 {engine.finalCardCount}
          点会成为画像的优先信号。
        </p>
      </div>
    </div>
  );
}

/* 人生卡牌结果（原型 renderLifeResult：真相 / 原话线索 / 光谱 / 张力 / 盲点 / 反问） */
export function LifeResult({ engine }: { engine: CardGameEngine }) {
  const a = useMemo(() => engine.lifeAnalysis(), [engine]);
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
            <div className="text-[9.5px] font-semibold tracking-[2px] text-faint">
              你的动态数字人 · 新切面
            </div>
            <div className="text-aurora mt-2 text-[24px] font-extrabold lg:text-[30px]">{a.title}</div>
            <p className="mt-2 max-w-[42ch] text-[11.5px] leading-[1.75] text-sub">
              这不是在判断你好或不好，而是在看代价出现时，你最先保护了什么。
            </p>
          </div>
        </div>

        <div>
          <div className="text-[9px] font-semibold tracking-[1.8px] text-brand">
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

      <div className="grid gap-4 md:grid-cols-2">
        <ResultBlock kicker="THE TRUTH BENEATH · 内心真相" tint="#8F7BFF" className="md:col-span-2">
          <p className="text-[12px] leading-[1.85] text-ink/92 lg:text-[13px]">{a.truth}</p>
          <p className="text-[9.5px] text-faint">
            判断来自你留下、放下和为之接受挫折的牌，而不只是最终结果。
          </p>
        </ResultBlock>

        {a.voiceQuotes.length > 0 && (
          <ResultBlock kicker="YOUR OWN WORDS · 你亲口说出的线索" tint="#3ED9A4" className="md:col-span-2">
            <div className="grid w-full gap-2.5 md:grid-cols-2">
              {a.voiceQuotes.map((quote, i) => (
                <div key={i} className="w-full rounded-[10px] bg-white/[0.035] p-3">
                  <div className="text-[10.5px] font-semibold text-[#8EE7C8]">{quote.label}</div>
                  <div className="mt-1 text-[11.5px] italic leading-[1.7] text-sub">“{quote.text}”</div>
                </div>
              ))}
            </div>
            <p className="text-[11px] leading-[1.7] text-sub">{a.reasonInsight}</p>
          </ResultBlock>
        )}

        <ResultBlock kicker="你的心理倾向光谱" tint="#8F7BFF">
          {a.spectrum.map((row, i) => (
            <div key={i} className="w-full">
              <div className="flex justify-between text-[10px] text-faint">
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
          <div className="text-[13px] font-bold text-ink">你想拥有的，和你会拿去交换的</div>
          <p className="text-[11.5px] leading-[1.8] text-sub">{a.tension}</p>
        </ResultBlock>

        <ResultBlock kicker="POSSIBLE BLIND SPOT · 可能的盲点" tint="#FF7A4D">
          <p className="text-[11.5px] leading-[1.8] text-sub">{a.blindspot}</p>
        </ResultBlock>

        <ResultBlock kicker="留给真实生活的一个问题" tint="#9DBCFF">
          <p className="text-[12px] leading-[1.8] text-ink/90">{a.reflection}</p>
        </ResultBlock>
      </div>

      <div className="grid gap-2.5 rounded-[14px] border border-teal/15 bg-teal/[0.045] p-3.5 text-[10px] leading-[1.7] text-faint md:grid-cols-2">
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
