"use client";
/* 推演结果（原型 resultPage）—— 移植自 iOS Features/Lab/ResultView.swift。
 * 三结局 tab（最好/一般/最坏）+ 底线压力测试 + 底线分析 + 相似旅人。 */
import { useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { HueBandHeader } from "@/components/ui/Avatar";
import { TagPill, PrimaryButton, SectionHeader } from "@/components/ui/Basics";
import { mockAvatarById } from "@/lib/theme";
import type { Traveler } from "@/lib/models";
import { CardIconMark } from "./CardIcon";
import {
  CARRY_CARDS,
  carryCardById,
  type BottomLineOut,
  type ScenarioOut,
  type SimResultData,
} from "./model";

interface TabSpec {
  title: string;
  eyebrow: string;
  accent: string;
  bg: [string, string];
  scenario: ScenarioOut;
}

export function ResultView({ data, onBack }: { data: SimResultData; onBack: () => void }) {
  const [tab, setTab] = useState(1); // 默认「一般情况」

  const specs: TabSpec[] = [
    {
      title: "最好的结果",
      eyebrow: "BEST · 顺光面",
      accent: "#F06ACD",
      bg: ["#2C1533", "#1A1226"],
      scenario: data.scenarios.optimistic,
    },
    {
      title: "一般情况",
      eyebrow: "LIKELY · 大概率",
      accent: "#6FA5FF",
      bg: ["#152048", "#11142B"],
      scenario: data.scenarios.general,
    },
    {
      title: "最坏的结果",
      eyebrow: "WORST · 背光面",
      accent: "#FF8A5E",
      bg: ["#33160E", "#1C0F0C"],
      scenario: data.scenarios.cautionary,
    },
  ];
  const active = specs[tab];

  return (
    <div className="min-h-dvh screen-bg">
      {/* 顶栏 */}
      <div className="sticky top-0 z-10 border-b border-line bg-paper/70 backdrop-blur-md">
        <div className="mx-auto flex w-full max-w-[680px] items-center gap-3 px-[22px] py-3">
          <button
            onClick={onBack}
            aria-label="返回"
            className="flex h-9 w-9 items-center justify-center rounded-full border border-line bg-raised text-ink transition active:scale-95"
          >
            ‹
          </button>
          <div className="min-w-0">
            <div className="text-[16px] font-semibold tracking-[0.8px] text-ink">推演结果</div>
            <div className="truncate text-[11px] text-faint">
              {data.choice} · {data.horizonLabel}后
            </div>
          </div>
        </div>
      </div>

      <div className="mx-auto w-full max-w-[680px] px-5 pt-4 pb-10">
        {/* 头部说明 + 分段控件 */}
        <p className="text-[12px] leading-[1.7] text-sub">
          「<span className="font-bold text-ink">{data.question}</span>
          」的三种可能 —— 先看一般情况，再看两端。
        </p>
        <div className="mt-4 flex gap-1 rounded-chip bg-raised p-1">
          {specs.map((s, i) => (
            <button
              key={i}
              onClick={() => setTab(i)}
              className={`flex-1 rounded-chip py-[9px] text-[13px] transition ${
                tab === i ? "bg-btn-g font-semibold text-white" : "text-sub"
              }`}
            >
              {s.title}
            </button>
          ))}
        </div>

        {/* 单结局面板 */}
        <motion.div
          key={tab}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.25 }}
          className="mt-4"
        >
          <ScenarioPanel spec={active} />
        </motion.div>

        {/* 最坏结果 + 带入底线卡：底线压力测试 */}
        {tab === 2 && data.carry.length > 0 && (
          <div className="mt-[14px]">
            <FloorTestPanel carryIds={data.carry} />
          </div>
        )}

        {/* /simulate 底线分析 */}
        {data.bottomLine && (
          <div className="mt-[14px]">
            <BottomLinePanel analysis={data.bottomLine} />
          </div>
        )}

        {/* 相似旅人 */}
        <div className="mt-6">
          <SectionHeader title="类似经验的人" trailing="左右滑动查看" />
          {data.people.length > 0 ? (
            <div className="no-scrollbar -mx-5 mt-2 flex gap-[10px] overflow-x-auto px-5 pb-1">
              {data.people.map((t) => (
                <SimCard key={t.id} traveler={t} />
              ))}
            </div>
          ) : (
            <p className="mt-2 text-[11.5px] text-faint">暂无匹配到的相似旅人。</p>
          )}
        </div>

        <div className="mt-6">
          <PrimaryButton title="重新选择" wide onClick={onBack} />
        </div>
      </div>
    </div>
  );
}

/* ============ 单结局面板 ============ */

function ScenarioPanel({ spec }: { spec: TabSpec }) {
  const { scenario, accent, eyebrow, bg } = spec;
  return (
    <div className="flex flex-col gap-3">
      {/* 概览 */}
      <div
        className="relative overflow-hidden rounded-card border p-5"
        style={{
          background: `linear-gradient(135deg, ${bg[0]}, ${bg[1]})`,
          borderColor: hexA(accent, 0.35),
        }}
      >
        <div
          className="pointer-events-none absolute -right-10 -top-10 h-44 w-44 rounded-full"
          style={{ background: `radial-gradient(circle, ${hexA(accent, 0.4)}, transparent 70%)` }}
        />
        <div className="relative text-[11px] tracking-[2.5px]" style={{ color: accent }}>
          {eyebrow}
        </div>
        <h3 className="relative mt-2.5 text-[16px] font-bold leading-[1.7] text-ink">
          {scenario.headline}
        </h3>
      </div>

      {/* 维度卡 */}
      <div className="kaleido-card px-5 py-1.5">
        {scenario.dimensions.map((dim, i) => (
          <div
            key={i}
            className={`flex items-baseline gap-[13px] py-[13px] ${
              i < scenario.dimensions.length - 1 ? "border-b border-line" : ""
            }`}
          >
            <span className="w-[60px] shrink-0 text-[12px] text-faint">{dim.label}</span>
            <span className="text-[13px] leading-[1.6] text-ink">{dim.text}</span>
          </div>
        ))}
      </div>

      {/* 获得 / 留意 双列 */}
      <div className="grid grid-cols-1 gap-[11px] md:grid-cols-2">
        <ListCard title="可能获得" dot="#3ED9A4" items={scenario.gains} />
        <ListCard title="需要留意" dot="#F06ACD" items={scenario.costs} />
      </div>

      {/* 最关键的条件 */}
      {scenario.key_condition && (
        <div
          className="rounded-[16px] border border-dashed px-[18px] py-[15px] text-[12.5px] leading-[1.7]"
          style={{
            background: "linear-gradient(90deg, rgba(94,150,255,0.12), rgba(215,244,100,0.08))",
            borderColor: "rgba(111,165,255,0.45)",
          }}
        >
          <span className="font-bold text-ink">最关键的条件：</span>
          <span className="text-sub">{scenario.key_condition}</span>
        </div>
      )}
    </div>
  );
}

function ListCard({ title, dot, items }: { title: string; dot: string; items: string[] }) {
  return (
    <div className="kaleido-card p-4">
      <div className="flex items-center gap-1.5">
        <span className="h-[7px] w-[7px] rounded-full" style={{ background: dot }} />
        <span className="text-[12px] font-semibold text-ink">{title}</span>
      </div>
      <div className="mt-2.5 flex flex-col gap-2.5">
        {items.map((item, i) => (
          <div key={i} className="flex gap-2">
            <span className="mt-[6px] h-1 w-1 shrink-0 rounded-full bg-faint" />
            <span className="text-[11.5px] leading-[1.6] text-sub">{item}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ============ 底线压力测试（原型 .floor-test） ============ */

function FloorTestPanel({ carryIds }: { carryIds: string[] }) {
  const cards = carryIds.map(carryCardById).filter((c): c is NonNullable<typeof c> => !!c);
  const [answers, setAnswers] = useState<Record<string, boolean>>({});
  const allAnswered = Object.keys(answers).length === cards.length && cards.length > 0;
  const rejected = cards.filter((c) => answers[c.id] === false).map((c) => c.name);
  const pass = rejected.length === 0;

  return (
    <div className="rounded-sheet border p-[17px]" style={{ background: "#11151D", borderColor: "rgba(255,122,77,0.24)" }}>
      <div className="text-[8.5px] font-semibold tracking-[2.2px] text-[#FF9B77]">
        FLOOR TEST · 底线压力测试
      </div>
      <h4 className="mt-1.5 text-[15px] font-bold leading-[1.5] text-ink">
        最坏的结果，会击穿你带进来的底线吗？
      </h4>
      <p className="mt-1.5 text-[10.5px] leading-[1.6] text-sub">
        逐张确认：如果这个结局真的发生，这张底线卡还守得住吗？
      </p>

      <div className="mt-3 flex flex-col gap-3">
        {cards.map((card) => (
          <div key={card.id} className="rounded-[14px] bg-raised p-[13px]">
            <div className="flex items-center gap-2 text-[#FF9B77]">
              <CardIconMark icon={card.icon} size={13} />
              <span className="text-[13px] font-semibold text-ink">{card.name}</span>
            </div>
            <p className="mt-2 text-[11.5px] leading-[1.8] text-sub">{card.risk}</p>
            <div className="mt-2.5 flex gap-[9px]">
              <FloorButton
                title="最差如此，仍可承受"
                accept
                on={answers[card.id] === true}
                onClick={() => setAnswers((a) => ({ ...a, [card.id]: true }))}
              />
              <FloorButton
                title="这已经越过底线"
                accept={false}
                on={answers[card.id] === false}
                onClick={() => setAnswers((a) => ({ ...a, [card.id]: false }))}
              />
            </div>
          </div>
        ))}
      </div>

      {allAnswered && (
        <div
          className="mt-3 rounded-[14px] border p-[14px]"
          style={{
            background: pass ? "rgba(62,217,164,0.08)" : "rgba(255,122,77,0.08)",
            borderColor: pass ? "rgba(62,217,164,0.3)" : "rgba(255,122,77,0.3)",
          }}
        >
          <div
            className="text-[9px] font-semibold tracking-[1.6px]"
            style={{ color: pass ? "#3ED9A4" : "#FF9B77" }}
          >
            {pass ? "可以继续转变 · 但不是盲目乐观" : "暂时不要直接跨过去"}
          </div>
          <div className="mt-1.5 text-[13px] font-bold leading-[1.5] text-ink">
            {pass
              ? `你看见了最差结果，也确认它没有击穿带入的 ${cards.length} 张底线卡。`
              : `最坏结果会击穿：${rejected.join("、")}`}
          </div>
          <p className="mt-1.5 text-[11.5px] leading-[1.8] text-sub">
            {pass
              ? "这说明这条路值得继续验证。下一步不是立刻跳下去，而是为这些底线分别保留现实缓冲。"
              : "这不等于你不适合改变。先为这些底线建立保护条件，再回来重新测试。"}
          </p>
        </div>
      )}
    </div>
  );
}

function FloorButton({
  title,
  accept,
  on,
  onClick,
}: {
  title: string;
  accept: boolean;
  on: boolean;
  onClick: () => void;
}) {
  const tint = accept ? "#3ED9A4" : "#FF8A5E";
  return (
    <button
      onClick={onClick}
      className="flex-1 rounded-chip py-[9px] text-[10.5px] transition active:scale-[0.97]"
      style={{
        color: on ? tint : "var(--color-sub)",
        fontWeight: on ? 600 : 400,
        background: on ? hexA(tint, 0.12) : "rgba(255,255,255,0.05)",
        border: `1px solid ${on ? hexA(tint, 0.55) : "var(--color-line)"}`,
      }}
    >
      {title}
    </button>
  );
}

/* ============ 底线分析（/simulate bottom_line_analysis） ============ */

function BottomLinePanel({ analysis }: { analysis: BottomLineOut }) {
  const ok = analysis.is_acceptable;
  const accent = ok ? "#3ED9A4" : "#FF9B77";
  const border = ok ? "rgba(62,217,164,0.24)" : "rgba(255,122,77,0.24)";
  return (
    <div className="rounded-sheet border p-[17px]" style={{ background: "#11151D", borderColor: border }}>
      <div className="text-[8.5px] font-semibold tracking-[2.2px]" style={{ color: accent }}>
        BOTTOM LINE · 底线分析
      </div>
      <h4 className="mt-1.5 text-[15px] font-bold leading-[1.5] text-ink">
        {ok ? "最坏的结果，仍在你的底线之内" : "最坏的结果，可能击穿你的底线"}
      </h4>
      <p className="mt-1.5 text-[10.5px] leading-[1.6] text-sub">
        {ok
          ? "结合你带走的底线卡与三种结局推演，这条路的最差情况大概率守得住。"
          : "结合你带走的底线卡与三种结局推演，先为下面的风险建立保护条件，再考虑迈出这一步。"}
      </p>
      {analysis.risks.length > 0 && (
        <BulletList title="需要警惕的风险" dot="#FF8A5E" items={analysis.risks} />
      )}
      {analysis.protective_conditions.length > 0 && (
        <BulletList title="保护条件" dot="#3ED9A4" items={analysis.protective_conditions} />
      )}
    </div>
  );
}

function BulletList({ title, dot, items }: { title: string; dot: string; items: string[] }) {
  return (
    <div className="mt-3 rounded-[14px] bg-raised p-[13px]">
      <div className="flex items-center gap-1.5">
        <span className="h-[7px] w-[7px] rounded-full" style={{ background: dot }} />
        <span className="text-[12px] font-semibold text-ink">{title}</span>
      </div>
      <div className="mt-2 flex flex-col gap-2">
        {items.map((item, i) => (
          <div key={i} className="flex gap-2">
            <span className="mt-[6px] h-1 w-1 shrink-0 rounded-full bg-faint" />
            <span className="text-[11.5px] leading-[1.7] text-sub">{item}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ============ 相似旅人卡（原型 .simcard） ============ */

function SimCard({ traveler }: { traveler: Traveler }) {
  return (
    <Link
      href={`/traveler/${traveler.id}`}
      className="block w-[168px] shrink-0 overflow-hidden rounded-[18px] border border-line bg-card transition active:scale-[0.98]"
    >
      <HueBandHeader
        initial={traveler.initial}
        hueIndex={traveler.hue}
        bandHeight={52}
        avatarSize={36}
        imageSrc={mockAvatarById(traveler.id)}
      />
      <div className="px-[14px] pb-[14px] pt-5">
        <div className="text-[13px] font-semibold text-ink">{traveler.name}</div>
        <p className="mt-[5px] line-clamp-2 text-[11px] leading-[1.5] text-sub">{traveler.quote}</p>
        {traveler.tags.length > 0 && (
          <div className="mt-[7px] flex gap-[5px]">
            {traveler.tags.slice(0, 2).map((tag) => (
              <TagPill key={tag} text={tag} />
            ))}
          </div>
        )}
      </div>
    </Link>
  );
}

/* #RRGGBB → rgba() */
function hexA(hex: string, alpha: number): string {
  const m = hex.trim().match(/^#?([0-9a-f]{6})$/i);
  if (!m) return hex;
  const n = parseInt(m[1], 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${alpha})`;
}
