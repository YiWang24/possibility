"use client";

import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import type { DiarySummaryResponse } from "./data";
import { currentMonthRef, currentYearRef } from "./data";
import { DiaryBlockHead, DiaryKeywordFlow, DiaryViewHead } from "./ui";

export function DiarySummaryView({
  isMonth,
  summary,
  entriesCount,
  loading,
  error,
  refreshing,
  onRefresh,
}: {
  isMonth: boolean;
  summary: DiarySummaryResponse | null;
  entriesCount: number;
  loading: boolean;
  error: string | null;
  refreshing: boolean;
  onRefresh: () => void;
}) {
  const ref = summary?.ref ?? (isMonth ? currentMonthRef() : currentYearRef());
  const titleText = isMonth ? monthLabel(ref) : `${ref}年度`;

  return (
    <div className="flex flex-col">
      <DiaryViewHead
        eyebrow={isMonth ? "MONTHLY REVIEW" : "YEARLY REVIEW"}
        title={titleText}
        subtitle={
          summary
            ? `${summary.entry_count} 条日记已纳入 AI 总结`
            : `${entriesCount} 条日记可参与总结`
        }
        trailing={
          <button
            onClick={onRefresh}
            disabled={refreshing || loading}
            className="shrink-0 rounded-chip border border-brand/20 bg-brand/10 px-[11px] py-2 text-micro text-brand-lite transition active:scale-95 disabled:opacity-50"
          >
            {refreshing ? "总结中…" : "更新总结"}
          </button>
        }
      />

      {loading ? (
        <div className="flex items-center justify-center gap-2.5 py-24 text-footnote text-sub">
          <span className="h-4 w-4 animate-spin rounded-full border-2 border-brand border-t-transparent" />
          正在读取 AI 总结…
        </div>
      ) : summary &&
        ["ready", "stale"].includes(summary.status) &&
        Boolean(summary.insight) ? (
        <RealSummary summary={summary} titleText={titleText} isMonth={isMonth} />
      ) : (
        <EmptySummary
          isMonth={isMonth}
          titleText={titleText}
          entriesCount={entriesCount}
          error={error}
          status={summary?.status}
          onRefresh={onRefresh}
        />
      )}
    </div>
  );
}

function monthLabel(ref: string): string {
  const [year, rawMonth] = ref.split("-");
  const month = Number.parseInt(rawMonth ?? "", 10);
  return year && Number.isFinite(month) ? `${year}年${month}月` : ref;
}

function RealSummary({
  summary,
  titleText,
  isMonth,
}: {
  summary: DiarySummaryResponse;
  titleText: string;
  isMonth: boolean;
}) {
  return (
    <div className="flex flex-col gap-[14px]">
      {summary.stale && (
        <div className="mt-[14px] rounded-tile border border-brand/20 bg-brand/8 px-3.5 py-2.5 text-micro text-brand-lite">
          有新日记加入，下面先保留上一次总结，AI 正在更新。
        </div>
      )}
      <SummaryHero
        cap={`${isMonth ? "MONTH" : "YEAR"} IN VOICE · ${titleText}`}
        headline={isMonth ? "这个月的声音\n汇成了一段属于你的洞察" : "这一年的声音\n汇成了一段属于你的回望"}
        body={summary.insight}
        stats={[
          { value: String(summary.entry_count), label: "纳入日记" },
          { value: String(summary.top_emotions.length), label: "情绪主题" },
          { value: String(summary.top_keywords.length), label: "高频关键词" },
        ]}
      />

      {summary.top_emotions.length > 0 && (
        <SummaryCard>
          <DiaryBlockHead title={isMonth ? "本月情绪光谱" : "年度情绪底色"} note="来自真实日记分析" />
          <div className="mt-3">
            <DiaryKeywordFlow items={summary.top_emotions.map((emotion) => `# ${emotion}`)} />
          </div>
        </SummaryCard>
      )}

      {summary.top_keywords.length > 0 && (
        <SummaryCard>
          <DiaryBlockHead title="反复出现的主题" note={`跨 ${summary.entry_count} 条日记`} />
          <div className="mt-3">
            <DiaryKeywordFlow items={summary.top_keywords.map((keyword) => `# ${keyword}`)} />
          </div>
        </SummaryCard>
      )}

      {summary.highlights.length > 0 && (
        <SummaryCard>
          <DiaryBlockHead
            title={isMonth ? "本月高光片段" : "这一年的高光时刻"}
            note="AI 从真实转写中提取"
          />
          <HighlightList items={summary.highlights} />
        </SummaryCard>
      )}

      {summary.entry_count === 0 && (
        <SummaryCard>
          <p className="text-caption leading-[1.7] text-sub">
            这个周期还没有可总结的日记。记录第一条声音后，再回来看看变化。
          </p>
        </SummaryCard>
      )}
    </div>
  );
}

function SummaryHero({
  cap,
  headline,
  body,
  stats,
}: {
  cap: string;
  headline: string;
  body: string;
  stats: { value: string; label: string }[];
}) {
  return (
    <div
      className="mt-[15px] overflow-hidden rounded-card border border-[#9A8BEA]/30 p-[21px]"
      style={{
        background:
          "radial-gradient(220px circle at 100% 0%, rgba(227,92,193,0.24), transparent), radial-gradient(190px circle at 0% 100%, rgba(94,150,255,0.22), transparent), linear-gradient(135deg, #1A1830, #111522)",
      }}
    >
      <div className="text-micro tracking-[2.4px] text-[#C4B9FF]">{cap}</div>
      <div className="mt-2 whitespace-pre-line text-heading font-bold leading-[1.6] text-ink">
        {headline}
      </div>
      <p className="mt-[9px] text-caption leading-[1.7] text-[#BCC4D4]">{body}</p>
      <div className="mt-[14px] flex gap-[7px]">
        {stats.map((stat) => (
          <div
            key={stat.label}
            className="flex flex-1 flex-col items-center gap-1 rounded-tile border border-white/[0.06] bg-white/[0.045] py-3"
          >
            <span className="text-title font-bold text-ink">{stat.value}</span>
            <span className="text-micro text-faint">{stat.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function SummaryCard({ children }: { children: ReactNode }) {
  return <Card elevation="flat" className="p-[17px]">{children}</Card>;
}

function HighlightList({ items }: { items: string[] }) {
  return (
    <div className="mt-[13px] flex flex-col gap-2.5 rounded-tile border border-white/[0.06] bg-white/[0.035] p-[13px]">
      {items.map((item) => (
        <div key={item} className="flex items-start gap-2.5">
          <span
            className="mt-[5px] h-1.5 w-1.5 shrink-0 rounded-full bg-violet-soft"
            style={{ boxShadow: "0 0 4px rgba(143,123,255,0.6)" }}
          />
          <span className="text-caption leading-[1.6] text-sub">{item}</span>
        </div>
      ))}
    </div>
  );
}

function EmptySummary({
  isMonth,
  titleText,
  entriesCount,
  error,
  status,
  onRefresh,
}: {
  isMonth: boolean;
  titleText: string;
  entriesCount: number;
  error: string | null;
  status?: DiarySummaryResponse["status"];
  onRefresh: () => void;
}) {
  return (
    <div className="flex flex-col gap-[14px]">
      <SummaryHero
        cap={`${isMonth ? "MONTH" : "YEAR"} IN VOICE · ${titleText}`}
        headline={isMonth ? "这个月的声音\n正在汇成属于你的洞察" : "这一年的声音\n正在汇成属于你的回望"}
        body={
          error ??
          (status === "failed"
            ? "这次总结暂时没有生成成功，点击重试后会继续处理。"
            : "总结只会基于你的真实日记生成。录音完成转写和分析后，会慢慢长成属于你的回顾。")
        }
        stats={[
          { value: String(entriesCount), label: "现有日记" },
          { value: "—", label: "情绪主题" },
          { value: "—", label: "高频关键词" },
        ]}
      />
      <SummaryCard>
        <div className="flex items-center gap-3">
          <div className="min-w-0 flex-1">
            <div className="text-body font-semibold text-ink">
              {status === "failed"
                ? isMonth ? "月度总结需要重试" : "年度总结需要重试"
                : isMonth ? "月度总结正在生成" : "年度总结正在生成"}
            </div>
            <p className="mt-1 text-micro leading-[1.6] text-sub">
              这里不会展示示例内容，生成后会直接替换为你的真实总结。
            </p>
          </div>
          <Button size="sm" className="shrink-0" onClick={onRefresh}>
            {status === "failed" ? "再试一次" : "检查进度"}
          </Button>
        </div>
      </SummaryCard>
    </div>
  );
}
