"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { DiaryEntry, DiarySummaryResponse } from "./data";
import {
  dayNumber,
  diaryLabel,
  entryEmoji,
  entryTitle,
  formatDuration,
  monthNumber,
  statusText,
  todayDate,
  weekday,
} from "./data";
import { DiaryBlockHead, DiaryCard, DiaryKeywordFlow, DiaryViewHead, StaticWave } from "./ui";

export interface RailItem {
  date: string;
  day: number;
  month: number;
  week: string;
  emoji: string | null;
  count: number;
}

export function DiaryDayView({
  entries,
  railDates,
  selectedDate,
  selectedEntries,
  daySummary,
  playingEntryId,
  onSelect,
  onTogglePlay,
  onDelete,
  onDeleteAudio,
  onRetry,
  onUpdateTranscript,
  onStartRecording,
}: {
  entries: DiaryEntry[];
  railDates: RailItem[];
  selectedDate: string;
  selectedEntries: DiaryEntry[];
  daySummary: DiarySummaryResponse | null;
  playingEntryId: string | null;
  onSelect: (date: string) => void;
  onTogglePlay: (entry: DiaryEntry) => void;
  onDelete: (entry: DiaryEntry) => void;
  onDeleteAudio: (entry: DiaryEntry) => void;
  onRetry: (entry: DiaryEntry) => void;
  onUpdateTranscript: (entry: DiaryEntry, transcript: string) => Promise<void>;
  onStartRecording: () => void;
}) {
  const recordedDays = useMemo(
    () => new Set(entries.map((entry) => entry.local_date)).size,
    [entries],
  );
  const sortedSelected = useMemo(
    () =>
      selectedEntries
        .slice()
        .sort((a, b) => b.recorded_at.localeCompare(a.recorded_at)),
    [selectedEntries],
  );
  const selectedEntry = sortedSelected[0] ?? null;
  const dayKeywords = [
    ...new Set(sortedSelected.flatMap((entry) => entry.keywords)),
  ];
  return (
    <div className="flex flex-col">
      <DiaryViewHead
        eyebrow="ALL VOICE NOTES"
        title="全部日记"
        subtitle={`已记录 ${recordedDays} 天 · 共 ${entries.length} 篇`}
      />

      <DateRail railDates={railDates} selectedDate={selectedDate} onSelect={onSelect} />

      {selectedEntry ? (
        <>
          <DayHero
            entry={selectedEntry}
            seed={entries.findIndex((entry) => entry.entry_id === selectedEntry.entry_id) + 1}
            isPlaying={playingEntryId === selectedEntry.entry_id}
            onTogglePlay={() => onTogglePlay(selectedEntry)}
          />

          <div className="mt-[14px]">
            <DiaryCard>
              <div className="flex flex-col gap-3">
                <DiaryBlockHead title="每日关键词" note="由当天语音内容自动提取" />
                {dayKeywords.length > 0 ? (
                  <DiaryKeywordFlow items={dayKeywords.map((keyword) => `# ${keyword}`)} />
                ) : (
                  <PendingLine text="语音完成分析后，会在这里出现属于这一天的关键词。" />
                )}
              </div>
            </DiaryCard>
          </div>

          <div className="mt-[14px]">
            <DiaryCard>
              <DiaryBlockHead
                title="今天的回声"
                note={daySummary?.stale
                  ? "有新记录，正在更新"
                  : `${sortedSelected.length} 篇日记的 AI 小结`}
              />
              {daySummary?.insight ? (
                <p className="mt-[11px] text-[12.5px] leading-[1.75] text-[#C8CEDA]">
                  {daySummary.insight}
                </p>
              ) : (
                <PendingLine
                  text={
                    daySummary?.status === "failed"
                      ? "今天的小结暂时没有生成成功，系统会在重试后更新这里。"
                      : "正在根据今天的全部语音生成小结。"
                  }
                />
              )}
            </DiaryCard>
          </div>

          <div className="mt-[14px]">
            <DiaryCard>
              <DiaryBlockHead
                title="详细语音内容"
                note={`${formatDuration(selectedEntry.duration_ms)} · ${statusText(selectedEntry.status)}`}
              />
              <TranscriptEditor
                entry={selectedEntry}
                onSave={(transcript) =>
                  onUpdateTranscript(selectedEntry, transcript)}
              />
              <div className="mt-4 flex items-center gap-4">
                {selectedEntry.status === "failed" && (
                  <button
                    onClick={() => onRetry(selectedEntry)}
                    className="text-[10.5px] font-medium text-brand"
                  >
                    重新处理
                  </button>
                )}
                {selectedEntry.has_audio && selectedEntry.status === "ready" && (
                  <button
                    onClick={() => onDeleteAudio(selectedEntry)}
                    className="text-[10.5px] text-faint transition hover:text-brand"
                  >
                    只删除原始录音
                  </button>
                )}
                <button
                  onClick={() => onDelete(selectedEntry)}
                  className="text-[10.5px] text-faint transition hover:text-[#FF8390]"
                >
                  删除这篇日记
                </button>
              </div>
            </DiaryCard>
          </div>

          {sortedSelected.length > 1 && (
            <SameDayEntries
              entries={sortedSelected.slice(1)}
              playingEntryId={playingEntryId}
              onTogglePlay={onTogglePlay}
              onDelete={onDelete}
              onRetry={onRetry}
            />
          )}
        </>
      ) : (
        <EmptyState onStartRecording={onStartRecording} />
      )}

      <Archive entries={entries} selectedDate={selectedDate} onSelect={onSelect} />
    </div>
  );
}

function DateRail({
  railDates,
  selectedDate,
  onSelect,
}: {
  railDates: RailItem[];
  selectedDate: string;
  onSelect: (date: string) => void;
}) {
  const activeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    activeRef.current?.scrollIntoView({ behavior: "smooth", inline: "center", block: "nearest" });
  }, [selectedDate]);

  return (
    <div className="no-scrollbar -mx-[22px] mt-4 overflow-x-auto px-[22px] py-0.5">
      <div className="flex gap-2">
        {railDates.map((item) => {
          const active = item.date === selectedDate;
          return (
            <button
              key={item.date}
              ref={active ? activeRef : undefined}
              onClick={() => onSelect(item.date)}
              aria-label={`查看${item.week}${item.day}日的日记`}
              className="relative flex w-[62px] shrink-0 flex-col items-center rounded-[17px] border py-[10px] transition active:scale-95"
              style={{
                background: active
                  ? "linear-gradient(135deg, rgba(48,82,164,0.75), rgba(82,55,135,0.78))"
                  : "var(--color-card)",
                borderColor: active ? "rgba(157,188,255,0.55)" : "var(--color-line)",
                boxShadow: active ? "0 8px 10px rgba(94,150,255,0.5)" : undefined,
              }}
            >
              {item.count > 1 && (
                <span className="absolute right-1.5 top-1.5 min-w-4 rounded-full bg-brand px-1 text-[8px] leading-4 text-white">
                  {item.count}
                </span>
              )}
              <span className={`text-[9.5px] ${active ? "text-[#EEF3FF]" : "text-faint"}`}>
                {item.week}
              </span>
              <span className="py-[5px] text-[19px] leading-none">{item.emoji ?? "·"}</span>
              <span className={`text-[10px] ${active ? "text-[#EEF3FF]" : "text-sub"}`}>
                {item.month}/{item.day}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function DayHero({
  entry,
  seed,
  isPlaying,
  onTogglePlay,
}: {
  entry: DiaryEntry;
  seed: number;
  isPlaying: boolean;
  onTogglePlay: () => void;
}) {
  const canPlay = entry.has_audio && entry.status !== "draft";
  return (
    <div
      className="mt-[10px] overflow-hidden rounded-[23px] border border-[#7D9EE8]/25 p-[19px]"
      style={{
        background:
          "radial-gradient(190px circle at 100% 0%, rgba(111,165,255,0.22), transparent), linear-gradient(135deg, #171D31, #11141F)",
      }}
    >
      <div className="text-[10px] tracking-[1.4px] text-[#9DBCFF]">
        {diaryLabel(entry.local_date)} · VOICE NOTE
      </div>
      <div className="mt-[7px] text-[18px] font-bold leading-[1.55] text-ink">
        {entryTitle(entry)}
      </div>
      <div className="mt-2 flex items-center gap-2">
        <span className="text-[20px] leading-none">{entryEmoji(entry)}</span>
        <span className="text-[11.5px] text-sub">
          {entry.emotions[0] ?? statusText(entry.status)}
        </span>
      </div>
      <div className="mt-[17px] flex items-center gap-[11px] rounded-[15px] border border-white/[0.07] bg-[#050812]/[0.48] px-3 py-[11px]">
        <button
          onClick={onTogglePlay}
          disabled={!canPlay}
          aria-label={isPlaying ? "暂停这篇语音日记" : "播放这篇语音日记"}
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-btn-g text-[11px] text-white transition active:scale-95 disabled:opacity-35"
        >
          {isPlaying ? "Ⅱ" : "▶"}
        </button>
        <div className="min-w-0 flex-1">
          <StaticWave seed={Math.max(seed, 1)} />
        </div>
        <span className="shrink-0 text-[9.5px] tabular-nums text-faint">
          {formatDuration(entry.duration_ms)}
        </span>
      </div>
    </div>
  );
}

function PendingLine({ text }: { text: string }) {
  return <p className="mt-[11px] text-[11.5px] leading-[1.7] text-faint">{text}</p>;
}

function TranscriptEditor({
  entry,
  onSave,
}: {
  entry: DiaryEntry;
  onSave: (transcript: string) => Promise<void>;
}) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(entry.transcript ?? "");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setEditing(false);
    setValue(entry.transcript ?? "");
  }, [entry.entry_id, entry.transcript]);

  if (!entry.transcript) {
    return (
      <PendingLine
        text={
          entry.status === "failed"
            ? "这次转写没有成功，原始录音仍然安全保留。"
            : "原始录音已经保存，转写完成后会在这里显示全文。"
        }
      />
    );
  }

  if (!editing) {
    return (
      <>
        <p className="mt-[11px] whitespace-pre-wrap text-[12.5px] leading-[1.75] text-[#C8CEDA]">
          {entry.transcript}
        </p>
        <button
          onClick={() => setEditing(true)}
          className="mt-2.5 text-[10.5px] text-brand"
        >
          修订转写
        </button>
      </>
    );
  }

  return (
    <div className="mt-[11px]">
      <textarea
        value={value}
        onChange={(event) => setValue(event.target.value)}
        maxLength={20_000}
        rows={7}
        className="w-full resize-y rounded-[14px] border border-[#5E96FF]/25 bg-black/15 px-3 py-2.5 text-[12.5px] leading-[1.75] text-[#C8CEDA] outline-none focus:border-[#5E96FF]/60"
      />
      <div className="mt-2 flex items-center gap-3">
        <button
          disabled={saving || !value.trim()}
          onClick={async () => {
            setSaving(true);
            try {
              await onSave(value.trim());
              setEditing(false);
            } catch {
              // Parent already presents the API error as a toast.
            } finally {
              setSaving(false);
            }
          }}
          className="rounded-chip bg-btn-g px-3.5 py-1.5 text-[10.5px] text-white disabled:opacity-45"
        >
          {saving ? "保存中…" : "保存并重新分析"}
        </button>
        <button
          disabled={saving}
          onClick={() => {
            setValue(entry.transcript ?? "");
            setEditing(false);
          }}
          className="text-[10.5px] text-faint"
        >
          取消
        </button>
      </div>
    </div>
  );
}

function SameDayEntries({
  entries,
  playingEntryId,
  onTogglePlay,
  onDelete,
  onRetry,
}: {
  entries: DiaryEntry[];
  playingEntryId: string | null;
  onTogglePlay: (entry: DiaryEntry) => void;
  onDelete: (entry: DiaryEntry) => void;
  onRetry: (entry: DiaryEntry) => void;
}) {
  return (
    <div className="mt-[18px] flex flex-col gap-2.5">
      <div className="flex items-baseline gap-3">
        <span className="text-[15px] font-bold text-ink">当天的其他声音</span>
        <span className="ml-auto text-[9.5px] text-faint">{entries.length} 篇</span>
      </div>
      {entries.map((entry, index) => (
        <div
          key={entry.entry_id}
          className="flex items-center gap-[11px] rounded-[17px] border border-line bg-card px-3 py-[13px]"
        >
          <button
            onClick={() => onTogglePlay(entry)}
            disabled={!entry.has_audio || entry.status === "draft"}
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#5E96FF]/12 text-[10px] text-brand disabled:opacity-35"
          >
            {playingEntryId === entry.entry_id ? "Ⅱ" : "▶"}
          </button>
          <div className="min-w-0 flex-1">
            <div className="truncate text-[11.5px] font-semibold text-ink">{entryTitle(entry)}</div>
            <div className="mt-1 flex items-center gap-2 text-[9.5px] text-faint">
              <StaticWave seed={index + 31} />
              <span className="shrink-0">{formatDuration(entry.duration_ms)}</span>
            </div>
          </div>
          <button onClick={() => onDelete(entry)} className="text-[10px] text-faint">
            删除
          </button>
          {entry.status === "failed" && (
            <button onClick={() => onRetry(entry)} className="text-[10px] text-brand">
              重试
            </button>
          )}
        </div>
      ))}
    </div>
  );
}

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

function Archive({
  entries,
  selectedDate,
  onSelect,
}: {
  entries: DiaryEntry[];
  selectedDate: string;
  onSelect: (date: string) => void;
}) {
  const days = useMemo(() => {
    const groups = new Map<string, DiaryEntry[]>();
    for (const entry of entries) {
      const list = groups.get(entry.local_date) ?? [];
      list.push(entry);
      groups.set(entry.local_date, list);
    }
    return [...groups.entries()].sort(([a], [b]) => b.localeCompare(a));
  }, [entries]);

  return (
    <div className="mt-[18px] flex flex-col gap-2.5">
      <div className="flex items-baseline gap-3">
        <span className="text-[15px] font-bold text-ink">全部日期记录</span>
        <span className="ml-auto text-[9.5px] text-faint">{entries.length} 篇 · 按时间倒序</span>
      </div>
      <div className="flex flex-col gap-2">
        {days.map(([date, dayEntries]) => {
          const active = date === selectedDate;
          const latest = dayEntries
            .slice()
            .sort((a, b) => b.recorded_at.localeCompare(a.recorded_at))[0]!;
          return (
            <button
              key={date}
              onClick={() => onSelect(date)}
              className="flex items-center gap-[11px] rounded-[17px] border px-3 py-[13px] text-left transition active:scale-[0.98]"
              style={{
                background: active ? "rgba(94,150,255,0.08)" : "var(--color-card)",
                borderColor: active ? "rgba(111,165,255,0.32)" : "var(--color-line)",
              }}
            >
              <div className="flex w-[42px] shrink-0 flex-col items-center">
                <span className="text-[15px] font-bold text-ink">{dayNumber(date)}</span>
                <span className="text-[8.5px] text-faint">{monthNumber(date)}月</span>
              </div>
              <div className="flex min-w-0 flex-1 flex-col gap-[5px]">
                <span className="truncate text-[11.5px] font-semibold text-ink">
                  {entryTitle(latest)}
                </span>
                <span className="truncate text-[9.5px] text-faint">
                  {entryEmoji(latest)} {dayEntries.length > 1 ? `${dayEntries.length} 篇 · ` : ""}
                  {latest.keywords.map((keyword) => `#${keyword}`).join(" · ")}
                </span>
              </div>
              <span className="text-[16px] text-[#70809E]">›</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

export function buildRailDates(entries: DiaryEntry[]): RailItem[] {
  const groups = new Map<string, DiaryEntry[]>();
  for (const entry of entries) {
    const list = groups.get(entry.local_date) ?? [];
    list.push(entry);
    groups.set(entry.local_date, list);
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  for (let offset = 13; offset >= 0; offset -= 1) {
    const date = new Date(today);
    date.setDate(date.getDate() - offset);
    const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(
      date.getDate(),
    ).padStart(2, "0")}`;
    if (!groups.has(key)) groups.set(key, []);
  }

  return [...groups.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .slice(-60)
    .map(([date, dayEntries]) => {
      const latest = dayEntries
        .slice()
        .sort((a, b) => b.recorded_at.localeCompare(a.recorded_at))[0];
      return {
        date,
        day: dayNumber(date),
        month: monthNumber(date),
        week: date === todayDate() ? "今天" : weekday(date),
        emoji: latest ? entryEmoji(latest) : null,
        count: dayEntries.length,
      };
    });
}
