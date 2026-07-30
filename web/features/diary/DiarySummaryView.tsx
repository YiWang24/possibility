"use client";
/* 月度 / 年度总结视图（原型 renderDiarySummary / iOS DiarySummaryView.swift）：
   真实优先渲染 diary-summary，未加载/失败回退硬编码 demo；「更新总结」重新拉取。 */

import type { ReactNode } from "react";
import type { DiarySummaryResponse, Insight, Stat } from "./data";
import { currentMonthRef, currentYearRef, MONTH_SUMMARY, YEAR_SUMMARY } from "./data";
import { DiaryBlockHead, DiaryKeywordFlow, DiaryViewHead } from "./ui";

export function DiarySummaryView({
  isMonth,
  summary,
  entriesCount,
  refreshing,
  onRefresh,
}: {
  isMonth: boolean;
  summary: DiarySummaryResponse | null;
  entriesCount: number;
  refreshing: boolean;
  onRefresh: () => void;
}) {
  const titleText = (() => {
    if (isMonth) {
      const ref = summary?.ref ?? currentMonthRef();
      const parts = ref.split("-");
      const month = Number.parseInt(parts[1] ?? "", 10);
      if (parts.length === 2 && Number.isFinite(month)) return `${parts[0]}年${month}月`;
      return "2026年7月";
    }
    return `${summary?.ref ?? currentYearRef()}年度`;
  })();

  const subtitleText = summary
    ? `${summary.entry_count}篇日记已纳入总结`
    : isMonth
      ? `${entriesCount}篇日记已纳入总结`
      : "143篇日记已纳入总结";

  return (
    <div className="flex flex-col">
      <DiaryViewHead
        eyebrow={isMonth ? "MONTHLY REVIEW" : "YEARLY REVIEW"}
        title={titleText}
        subtitle={subtitleText}
        trailing={
          <button
            onClick={onRefresh}
            disabled={refreshing}
            className="shrink-0 rounded-chip border border-[#5E96FF]/20 bg-[#5E96FF]/10 px-[11px] py-2 text-[10.5px] text-[#BBD0FF] transition active:scale-95"
            style={{ opacity: refreshing ? 0.55 : 1 }}
          >
            {refreshing ? "总结中…" : "更新总结"}
          </button>
        }
      />

      {isMonth
        ? summary
          ? <RemoteMonth s={summary} titleText={titleText} />
          : <FallbackMonth entriesCount={entriesCount} />
        : summary
          ? <RemoteYear s={summary} />
          : <FallbackYear />}
    </div>
  );
}

/* ============ 共用件 ============ */

function SummaryHero({
  cap,
  headline,
  body,
  stats,
}: {
  cap: string;
  headline: string;
  body: string;
  stats: Stat[];
}) {
  return (
    <div
      className="mt-[15px] overflow-hidden rounded-[24px] border border-[#9A8BEA]/30 p-[21px]"
      style={{
        background:
          "radial-gradient(220px circle at 100% 0%, rgba(227,92,193,0.24), transparent), radial-gradient(190px circle at 0% 100%, rgba(94,150,255,0.22), transparent), linear-gradient(135deg, #1A1830, #111522)",
      }}
    >
      <div className="text-[9.5px] tracking-[2.4px] text-[#C4B9FF]">{cap}</div>
      <div className="mt-2 whitespace-pre-line text-[20px] font-bold leading-[1.6] text-ink">
        {headline}
      </div>
      <p className="mt-[9px] text-[11.5px] leading-[1.7] text-[#BCC4D4]">{body}</p>
      <div className="mt-[14px] flex gap-[7px]">
        {stats.map((stat, i) => (
          <div
            key={i}
            className="flex flex-1 flex-col items-center gap-1 rounded-[15px] border border-white/[0.06] bg-white/[0.045] py-3"
          >
            <span className="text-[17px] font-bold text-ink">{stat.value}</span>
            <span className="text-[9px] text-faint">{stat.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function SummaryCard({ children }: { children: ReactNode }) {
  return <div className="rounded-[20px] border border-line bg-card p-[17px]">{children}</div>;
}

function InsightCard({ insight }: { insight: Insight }) {
  return (
    <div className="rounded-[16px] border border-white/[0.06] bg-white/[0.035] p-[14px]">
      {insight.cap && (
        <div className="text-[9px] tracking-[1.2px] text-[#9DBCFF]">{insight.cap}</div>
      )}
      <div className="mt-1 text-[13px] font-semibold leading-[1.5] text-ink">{insight.title}</div>
      <p className="mt-1 text-[11px] leading-[1.6] text-sub">{insight.body}</p>
    </div>
  );
}

/* 高光片段列表（发光圆点） */
function HighlightList({ items }: { items: string[] }) {
  return (
    <div className="mt-[13px] flex flex-col gap-2.5 rounded-[16px] border border-white/[0.06] bg-white/[0.035] p-[13px]">
      {items.map((text, i) => (
        <div key={i} className="flex items-start gap-2.5">
          <span
            className="mt-[5px] h-1.5 w-1.5 shrink-0 rounded-full bg-[#8F7BFF]"
            style={{ boxShadow: "0 0 4px rgba(143,123,255,0.6)" }}
          />
          <span className="text-[11.5px] leading-[1.6] text-sub">{text}</span>
        </div>
      ))}
    </div>
  );
}

/* ============ 月度 ============ */

function RemoteMonth({ s, titleText }: { s: DiarySummaryResponse; titleText: string }) {
  return (
    <div className="flex flex-col gap-[14px]">
      <SummaryHero
        cap={`MONTH IN VOICE · ${titleText}`}
        headline={"这个月的声音\n汇成了一段属于你的洞察"}
        body={s.insight}
        stats={[
          { value: String(s.entry_count), label: "纳入日记" },
          { value: String(s.top_emotions.length), label: "情绪主题" },
          { value: String(s.top_keywords.length), label: "高频关键词" },
        ]}
      />
      {s.top_emotions.length > 0 && (
        <SummaryCard>
          <DiaryBlockHead title="本月情绪光谱" note="按出现频次排序" />
          <div className="mt-3">
            <DiaryKeywordFlow items={s.top_emotions.map((e) => `# ${e}`)} />
          </div>
        </SummaryCard>
      )}
      {s.top_keywords.length > 0 && (
        <SummaryCard>
          <DiaryBlockHead title="反复出现的主题" note={`跨 ${s.entry_count} 篇日记`} />
          <div className="mt-3">
            <DiaryKeywordFlow items={s.top_keywords.map((k) => `# ${k}`)} />
          </div>
        </SummaryCard>
      )}
      {s.highlights.length > 0 && (
        <SummaryCard>
          <DiaryBlockHead title="本月高光片段" note="AI 从日记中提取" />
          <HighlightList items={s.highlights} />
        </SummaryCard>
      )}
    </div>
  );
}

function FallbackMonth({ entriesCount }: { entriesCount: number }) {
  return (
    <div className="flex flex-col gap-[14px]">
      <SummaryHero
        cap={MONTH_SUMMARY.cap}
        headline={MONTH_SUMMARY.headline}
        body={MONTH_SUMMARY.body}
        stats={MONTH_SUMMARY.stats}
      />
      <SummaryCard>
        <DiaryBlockHead title="本月情绪流动" note="前紧后松" />
        <div className="mt-[15px] flex h-[122px] items-end gap-2 px-[3px]">
          {MONTH_SUMMARY.emotionBars.map((bar, i) => (
            <div key={i} className="flex flex-1 flex-col items-center gap-1.5">
              <div className="flex w-full flex-1 items-end">
                <div
                  className="w-full rounded-t-[7px] opacity-75"
                  style={{
                    height: `${Math.max(10, 104 * bar.value)}px`,
                    background: "linear-gradient(to bottom, #8F7BFF, #3E77F2)",
                  }}
                />
              </div>
              <span className="text-[8.5px] text-faint">{bar.label}</span>
            </div>
          ))}
        </div>
      </SummaryCard>
      <SummaryCard>
        <DiaryBlockHead title="反复出现的主题" note={`跨 ${entriesCount} 篇日记`} />
        <div className="mt-3">
          <DiaryKeywordFlow items={MONTH_SUMMARY.themes} />
        </div>
        <div className="mt-[13px] flex flex-col gap-2.5">
          {MONTH_SUMMARY.insights.map((ins, i) => (
            <InsightCard key={i} insight={ins} />
          ))}
        </div>
      </SummaryCard>
    </div>
  );
}

/* ============ 年度 ============ */

function RemoteYear({ s }: { s: DiarySummaryResponse }) {
  return (
    <div className="flex flex-col gap-[14px]">
      <SummaryHero
        cap={`YOUR ${s.ref} · 年度声音`}
        headline={"这一年的声音\n汇成了一段属于你的回望"}
        body={s.insight}
        stats={[
          { value: String(s.entry_count), label: "纳入日记" },
          { value: String(s.top_emotions.length), label: "情绪主题" },
          { value: String(s.top_keywords.length), label: "高频关键词" },
        ]}
      />
      {s.top_keywords.length > 0 && (
        <SummaryCard>
          <DiaryBlockHead title="年度关键词" note="按出现与情绪权重排序" />
          <div className="mt-3">
            <DiaryKeywordFlow items={s.top_keywords.map((k) => `# ${k}`)} />
          </div>
        </SummaryCard>
      )}
      {s.top_emotions.length > 0 && (
        <SummaryCard>
          <DiaryBlockHead title="年度情绪底色" note="按出现频次排序" />
          <div className="mt-3">
            <DiaryKeywordFlow items={s.top_emotions.map((e) => `# ${e}`)} />
          </div>
        </SummaryCard>
      )}
      {s.highlights.length > 0 && (
        <SummaryCard>
          <DiaryBlockHead title="这一年的高光时刻" note="AI 年度回望" />
          <HighlightList items={s.highlights} />
        </SummaryCard>
      )}
    </div>
  );
}

function FallbackYear() {
  return (
    <div className="flex flex-col gap-[14px]">
      <SummaryHero
        cap={YEAR_SUMMARY.cap}
        headline={YEAR_SUMMARY.headline}
        body={YEAR_SUMMARY.body}
        stats={YEAR_SUMMARY.stats}
      />
      <SummaryCard>
        <DiaryBlockHead title="年度关键词" note="按出现与情绪权重排序" />
        <div className="mt-3">
          <DiaryKeywordFlow items={YEAR_SUMMARY.keywords} />
        </div>
      </SummaryCard>
      <SummaryCard>
        <DiaryBlockHead title="这一年的四个章节" note="持续生成中" />
        <div className="relative mt-[14px] pl-[15px]">
          <span className="absolute bottom-1.5 left-[3.5px] top-1.5 w-px bg-[#8F7BFF]/35" />
          {YEAR_SUMMARY.nodes.map((node, i) => (
            <div
              key={i}
              className="flex items-start gap-3"
              style={{ paddingBottom: i === YEAR_SUMMARY.nodes.length - 1 ? 2 : 16 }}
            >
              <span
                className="-ml-[15px] mt-[5px] h-2 w-2 shrink-0 rounded-full bg-[#8F7BFF]"
                style={{ boxShadow: "0 0 5px rgba(143,123,255,0.6)" }}
              />
              <div className="flex flex-col gap-[3px]">
                <span className="text-[9.5px] text-[#9DBCFF]">{node.period}</span>
                <span className="text-[12.5px] font-semibold text-ink">{node.title}</span>
                <span className="mt-px text-[10.5px] leading-[1.5] text-sub">{node.body}</span>
              </div>
            </div>
          ))}
        </div>
      </SummaryCard>
      <SummaryCard>
        <DiaryBlockHead title="写给年底的你" note="AI 年度回望" />
        <div className="mt-[13px]">
          <InsightCard insight={YEAR_SUMMARY.letter} />
        </div>
      </SummaryCard>
    </div>
  );
}
