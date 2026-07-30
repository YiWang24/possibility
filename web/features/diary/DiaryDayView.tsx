"use client";
/* 每日记录视图（原型 renderDiaryDay / iOS DiaryDayView.swift）：
   视图头 + 横向日期轨 + day hero（含播放条与静态波形）+ 关键词 + 转写 + 归档列表；空态引导录音。 */

import { useEffect, useRef } from "react";
import type { DiaryNote } from "./data";
import { dayNumber, TODAY_DATE, weekday } from "./data";
import { DiaryBlockHead, DiaryCard, DiaryKeywordFlow, DiaryViewHead, StaticWave } from "./ui";

export interface RailItem {
  date: string;
  day: number;
  week: string;
  emoji: string | null;
}

export function DiaryDayView({
  entries,
  railDates,
  selectedDate,
  selectedEntry,
  selectedIndex,
  isPlaying,
  onSelect,
  onTogglePlay,
  onStartRecording,
}: {
  entries: DiaryNote[];
  railDates: RailItem[];
  selectedDate: string;
  selectedEntry: DiaryNote | null;
  selectedIndex: number;
  isPlaying: boolean;
  onSelect: (date: string) => void;
  onTogglePlay: () => void;
  onStartRecording: () => void;
}) {
  return (
    <div className="flex flex-col">
      <DiaryViewHead
        eyebrow="ALL VOICE NOTES"
        title="全部日记"
        subtitle={`2026年7月 · 已记录 ${entries.length} 天`}
      />

      <DateRail railDates={railDates} selectedDate={selectedDate} onSelect={onSelect} />

      {selectedEntry ? (
        <>
          <DayHero
            entry={selectedEntry}
            seed={selectedIndex + 1}
            isPlaying={isPlaying}
            onTogglePlay={onTogglePlay}
          />
          <div className="mt-[14px]">
            <DiaryCard>
              <div className="flex flex-col gap-3">
                <DiaryBlockHead title="每日关键词" note="由语音内容自动提取" />
                <DiaryKeywordFlow items={selectedEntry.keywords.map((k) => `# ${k}`)} />
              </div>
            </DiaryCard>
          </div>
          <div className="mt-[14px]">
            <DiaryCard>
              <DiaryBlockHead title="详细语音内容" note={`${selectedEntry.duration} · 已转写`} />
              {selectedEntry.transcript.map((p, i) => (
                <p key={i} className="mt-[11px] text-[12.5px] leading-[1.75] text-[#C8CEDA]">
                  {p}
                </p>
              ))}
            </DiaryCard>
          </div>
        </>
      ) : (
        <EmptyState onStartRecording={onStartRecording} />
      )}

      <Archive entries={entries} selectedDate={selectedDate} onSelect={onSelect} />
    </div>
  );
}

/* 日期滑动轨（.diary-date-rail） */
function DateRail({
  railDates,
  selectedDate,
  onSelect,
}: {
  railDates: RailItem[];
  selectedDate: string;
  onSelect: (date: string) => void;
}) {
  const scroller = useRef<HTMLDivElement>(null);
  const activeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    activeRef.current?.scrollIntoView({ behavior: "smooth", inline: "center", block: "nearest" });
  }, [selectedDate]);

  return (
    <div
      ref={scroller}
      className="no-scrollbar -mx-[22px] mt-4 overflow-x-auto px-[22px] py-0.5"
    >
      <div className="flex gap-2">
        {railDates.map((item) => {
          const on = item.date === selectedDate;
          return (
            <button
              key={item.date}
              ref={on ? activeRef : undefined}
              onClick={() => onSelect(item.date)}
              aria-label={`查看${item.week}${item.day}日的日记`}
              className="flex w-[62px] shrink-0 flex-col items-center rounded-[17px] border py-[10px] transition active:scale-95"
              style={{
                background: on
                  ? "linear-gradient(135deg, rgba(48,82,164,0.75), rgba(82,55,135,0.78))"
                  : "var(--color-card)",
                borderColor: on ? "rgba(157,188,255,0.55)" : "var(--color-line)",
                boxShadow: on ? "0 8px 10px rgba(94,150,255,0.5)" : undefined,
              }}
            >
              <span className={`text-[9.5px] ${on ? "text-[#EEF3FF]" : "text-faint"}`}>
                {item.week}
              </span>
              <span className="py-[5px] text-[19px] leading-none">{item.emoji ?? "·"}</span>
              <span className={`text-[10px] ${on ? "text-[#EEF3FF]" : "text-sub"}`}>
                7/{item.day}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

/* day hero（.diary-day-hero） */
function DayHero({
  entry,
  seed,
  isPlaying,
  onTogglePlay,
}: {
  entry: DiaryNote;
  seed: number;
  isPlaying: boolean;
  onTogglePlay: () => void;
}) {
  return (
    <div
      className="mt-[10px] overflow-hidden rounded-[23px] border border-[#7D9EE8]/25 p-[19px]"
      style={{
        background:
          "radial-gradient(190px circle at 100% 0%, rgba(111,165,255,0.22), transparent), linear-gradient(135deg, #171D31, #11141F)",
      }}
    >
      <div className="text-[10px] tracking-[1.4px] text-[#9DBCFF]">
        {entry.label} · VOICE NOTE
      </div>
      <div className="mt-[7px] text-[18px] font-bold leading-[1.55] text-ink">{entry.title}</div>
      <div className="mt-2 flex items-center gap-2">
        <span className="text-[20px] leading-none">{entry.emoji}</span>
        <span className="text-[11.5px] text-sub">{entry.emotion}</span>
      </div>
      {/* 音频条 */}
      <div className="mt-[17px] flex items-center gap-[11px] rounded-[15px] border border-white/[0.07] bg-[#050812]/[0.48] px-3 py-[11px]">
        <button
          onClick={onTogglePlay}
          aria-label={isPlaying ? "暂停这篇语音日记" : "播放这篇语音日记"}
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-btn-g text-[11px] text-white transition active:scale-95"
        >
          {isPlaying ? "Ⅱ" : "▶"}
        </button>
        <div className="min-w-0 flex-1">
          <StaticWave seed={seed} />
        </div>
        <span className="shrink-0 text-[9.5px] tabular-nums text-faint">{entry.duration}</span>
      </div>
    </div>
  );
}

/* 空态（.diary-empty） */
function EmptyState({ onStartRecording }: { onStartRecording: () => void }) {
  return (
    <div
      className="mt-5 flex flex-col items-center rounded-[23px] px-[22px] py-[38px] text-center"
      style={{
        background: "var(--color-card)",
        border: "1px dashed rgba(111,165,255,0.28)",
      }}
    >
      <span className="text-[32px] text-sub">◌</span>
      <span className="mt-3 text-[16px] font-bold text-ink">今天还没有留下声音</span>
      <p className="mt-[7px] text-[11.5px] leading-[1.5] text-sub">
        不需要组织好语言，从此刻最真实的感受开始就好。
      </p>
      <button
        onClick={onStartRecording}
        className="mt-[18px] rounded-chip bg-btn-g px-5 py-[11px] text-[12px] font-semibold text-white transition active:scale-95"
      >
        记录今天
      </button>
    </div>
  );
}

/* 归档（.diary-archive）：按时间倒序 */
function Archive({
  entries,
  selectedDate,
  onSelect,
}: {
  entries: DiaryNote[];
  selectedDate: string;
  onSelect: (date: string) => void;
}) {
  const sorted = [...entries].sort((a, b) => (a.date > b.date ? -1 : 1));
  return (
    <div className="mt-[18px] flex flex-col gap-2.5">
      <div className="flex items-baseline gap-3">
        <span className="text-[15px] font-bold text-ink">全部日期记录</span>
        <span className="ml-auto text-[9.5px] text-faint">{entries.length} 篇 · 按时间倒序</span>
      </div>
      <div className="flex flex-col gap-2">
        {sorted.map((entry) => {
          const on = entry.date === selectedDate;
          const isToday = entry.date === TODAY_DATE;
          return (
            <button
              key={entry.date}
              onClick={() => onSelect(entry.date)}
              className="flex items-center gap-[11px] rounded-[17px] border px-3 py-[13px] text-left transition active:scale-[0.98]"
              style={{
                background: on ? "rgba(94,150,255,0.08)" : "var(--color-card)",
                borderColor: on ? "rgba(111,165,255,0.32)" : "var(--color-line)",
              }}
            >
              <div className="flex w-[42px] shrink-0 flex-col items-center">
                <span className="text-[15px] font-bold text-ink">{dayNumber(entry.date)}</span>
                <span className="text-[8.5px] text-faint">7月</span>
              </div>
              <div className="flex min-w-0 flex-1 flex-col gap-[5px]">
                <span className="truncate text-[11.5px] font-semibold text-ink">{entry.title}</span>
                <span className="truncate text-[9.5px] text-faint">
                  {entry.emoji} {entry.keywords.map((k) => `#${k}`).join(" · ")}
                </span>
              </div>
              <span className="text-[16px] text-[#70809E]">{isToday && !on ? "›" : "›"}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

/* rail 派生（entries + 今天占位），供 DiaryDetail 复用 */
export function buildRailDates(entries: DiaryNote[]): RailItem[] {
  const rail: RailItem[] = entries.map((e) => ({
    date: e.date,
    day: dayNumber(e.date),
    week: e.date === TODAY_DATE ? "今天" : weekday(e),
    emoji: e.emoji,
  }));
  if (!rail.some((r) => r.date === TODAY_DATE)) {
    const now = new Date();
    rail.push({ date: TODAY_DATE, day: now.getDate(), week: "今天", emoji: null });
  }
  return rail.sort((a, b) => (a.date < b.date ? -1 : 1));
}
