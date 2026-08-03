"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { PageShell } from "@/components/shell/PageShell";
import { PageHeading } from "@/components/shell/PageHeading";
import { MobileDetailHeader } from "@/components/shell/MobileDetailHeader";
import { PersonaRail } from "@/features/home/PersonaRail";
import { useToast } from "@/components/ui/Toast";
import {
  deleteDiaryEntry,
  deleteDiaryAudio,
  diaryAudioUrl,
  exportDiary,
  getDiarySummary,
  listDiaryEntries,
  retryDiaryEntry,
  updateDiaryTranscript,
} from "./api";
import type { DiaryEntry, DiarySummaryResponse } from "./data";
import {
  currentMonthRef,
  currentYearRef,
  groupEntriesByDay,
  todayDate,
} from "./data";
import { buildRailDates, DiaryDayView } from "./DiaryDayView";
import { DiarySummaryView } from "./DiarySummaryView";

type ViewKind = "day" | "month" | "year";

const TABS: { kind: ViewKind; label: string }[] = [
  { kind: "day", label: "每日记录" },
  { kind: "month", label: "月度总结" },
  { kind: "year", label: "年度总结" },
];

function messageOf(error: unknown): string {
  return error instanceof Error && error.message ? error.message : "请求失败，请稍后重试。";
}

export function DiaryDetail() {
  const router = useRouter();
  const show = useToast((state) => state.show);
  const [view, setView] = useState<ViewKind>("day");
  const [entries, setEntries] = useState<DiaryEntry[]>([]);
  const [entriesLoading, setEntriesLoading] = useState(true);
  const [entriesError, setEntriesError] = useState<string | null>(null);
  const [selectedDate, setSelectedDate] = useState(todayDate());
  const [daySummary, setDaySummary] = useState<DiarySummaryResponse | null>(null);
  const [monthSummary, setMonthSummary] = useState<DiarySummaryResponse | null>(null);
  const [yearSummary, setYearSummary] = useState<DiarySummaryResponse | null>(null);
  const [summaryLoading, setSummaryLoading] = useState(true);
  const [summaryError, setSummaryError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [playingEntryId, setPlayingEntryId] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const selectedFromQueryRef = useRef(false);

  const grouped = useMemo(() => groupEntriesByDay(entries), [entries]);
  const selectedEntries = grouped.get(selectedDate) ?? [];
  const railDates = useMemo(() => buildRailDates(entries), [entries]);

  const loadEntries = useCallback(async (foreground = true) => {
    if (foreground) {
      setEntriesLoading(true);
      setEntriesError(null);
    }
    try {
      const response = await listDiaryEntries({ limit: 100 });
      const next = response.entries ?? [];
      setEntries(next);
      if (!selectedFromQueryRef.current && next[0]?.local_date) {
        setSelectedDate(next[0].local_date);
      }
    } catch (error) {
      if (foreground) setEntriesError(messageOf(error));
    } finally {
      if (foreground) setEntriesLoading(false);
    }
  }, []);

  const loadSummaries = useCallback(async (foreground = true) => {
    if (foreground) {
      setSummaryLoading(true);
      setSummaryError(null);
    }
    const [month, year] = await Promise.allSettled([
      getDiarySummary({
        period: "month",
        ref: currentMonthRef(),
      }),
      getDiarySummary({
        period: "year",
        ref: currentYearRef(),
      }),
    ]);
    if (month.status === "fulfilled") setMonthSummary(month.value);
    if (year.status === "fulfilled") setYearSummary(year.value);
    if (month.status === "rejected" || year.status === "rejected") {
      if (foreground) {
        setSummaryError("部分 AI 总结暂时无法读取，可以稍后重试。");
      }
    }
    if (foreground) setSummaryLoading(false);
  }, []);

  useEffect(() => {
    const date = new URLSearchParams(window.location.search).get("date");
    if (/^\d{4}-\d{2}-\d{2}$/.test(date ?? "")) {
      selectedFromQueryRef.current = true;
      setSelectedDate(date!);
    }
    void loadEntries();
    void loadSummaries();
    return () => {
      audioRef.current?.pause();
      audioRef.current = null;
    };
  }, [loadEntries, loadSummaries]);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const summary = await getDiarySummary({
          period: "day",
          ref: selectedDate,
        });
        if (!cancelled) setDaySummary(summary);
      } catch {
        if (!cancelled) setDaySummary(null);
      }
    };
    setDaySummary(null);
    void load();
    return () => {
      cancelled = true;
    };
  }, [selectedDate]);

  const hasProcessingEntries = entries.some((entry) =>
    ["uploaded", "transcribing", "transcribed", "analyzing"].includes(
      entry.status,
    )
  );
  const hasProcessingSummaries = [daySummary, monthSummary, yearSummary].some(
    (summary) =>
      summary &&
      ["pending", "generating", "stale"].includes(summary.status),
  );

  useEffect(() => {
    if (!hasProcessingEntries && !hasProcessingSummaries) return;
    const timer = window.setInterval(() => {
      if (hasProcessingEntries) void loadEntries(false);
      if (hasProcessingSummaries) {
        void loadSummaries(false);
        void getDiarySummary({ period: "day", ref: selectedDate })
          .then(setDaySummary)
          .catch(() => undefined);
      }
    }, 4_000);
    return () => window.clearInterval(timer);
  }, [
    hasProcessingEntries,
    hasProcessingSummaries,
    loadEntries,
    loadSummaries,
    selectedDate,
  ]);

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, [view, selectedDate]);

  const selectDate = (date: string) => {
    audioRef.current?.pause();
    setPlayingEntryId(null);
    setSelectedDate(date);
  };

  const togglePlay = async (entry: DiaryEntry) => {
    if (playingEntryId === entry.entry_id) {
      audioRef.current?.pause();
      setPlayingEntryId(null);
      return;
    }
    try {
      audioRef.current?.pause();
      const url = await diaryAudioUrl(entry.entry_id);
      const audio = new Audio(url);
      audioRef.current = audio;
      audio.onended = () => setPlayingEntryId(null);
      audio.onerror = () => {
        setPlayingEntryId(null);
        show("音频加载失败，请稍后重试");
      };
      await audio.play();
      setPlayingEntryId(entry.entry_id);
    } catch (error) {
      setPlayingEntryId(null);
      show(messageOf(error));
    }
  };

  const removeEntry = async (entry: DiaryEntry) => {
    if (!window.confirm("确定删除这条语音日记吗？原始录音与转写会一并删除。")) return;
    if (playingEntryId === entry.entry_id) {
      audioRef.current?.pause();
      setPlayingEntryId(null);
    }
    try {
      await deleteDiaryEntry(entry.entry_id);
      setEntries((current) => current.filter((item) => item.entry_id !== entry.entry_id));
      show("这条日记已删除");
      void loadSummaries();
    } catch (error) {
      show(messageOf(error));
    }
  };

  const removeAudio = async (entry: DiaryEntry) => {
    if (
      !window.confirm(
        "确定只删除这条日记的原始录音吗？文字和 AI 分析会保留，但之后无法重新校对音频。",
      )
    ) {
      return;
    }
    try {
      await deleteDiaryAudio(entry.entry_id);
      if (playingEntryId === entry.entry_id) {
        audioRef.current?.pause();
        setPlayingEntryId(null);
      }
      await loadEntries(false);
      show("原始录音已删除，文字内容仍然保留");
    } catch (error) {
      show(messageOf(error));
    }
  };

  const downloadExport = async () => {
    try {
      const payload = await exportDiary();
      const url = URL.createObjectURL(
        new Blob([JSON.stringify(payload, null, 2)], {
          type: "application/json",
        }),
      );
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `voice-diary-${todayDate()}.json`;
      anchor.click();
      URL.revokeObjectURL(url);
      show("日记导出已开始下载");
    } catch (error) {
      show(messageOf(error));
    }
  };

  const retryEntry = async (entry: DiaryEntry) => {
    try {
      await retryDiaryEntry(entry.entry_id);
      show("已重新开始处理");
      await loadEntries(false);
    } catch (error) {
      show(messageOf(error));
    }
  };

  const saveTranscript = async (entry: DiaryEntry, transcript: string) => {
    try {
      await updateDiaryTranscript({ entryId: entry.entry_id, transcript });
      show("转写已修订，正在重新生成分析");
      await loadEntries(false);
    } catch (error) {
      show(messageOf(error));
      throw error;
    }
  };

  const refreshSummary = async () => {
    if (refreshing) return;
    setRefreshing(true);
    setSummaryError(null);
    const isMonth = view === "month";
    try {
      const summary = await getDiarySummary({
        period: isMonth ? "month" : "year",
        ref: isMonth ? currentMonthRef() : currentYearRef(),
      });
      if (isMonth) setMonthSummary(summary);
      else setYearSummary(summary);
      show(
        summary.status === "ready"
          ? isMonth ? "月度总结已更新" : "年度总结已更新"
          : "已安排 AI 总结，请稍后查看",
      );
    } catch (error) {
      setSummaryError(messageOf(error));
      show("暂时无法更新总结");
    } finally {
      setRefreshing(false);
    }
  };

  return (
    <div className="screen-bg">
      <MobileDetailHeader
        title="语音日记"
        description="听见每天的自己，也看见长期变化"
        onBack={() => router.back()}
        trailing={
          <button
            onClick={() => void downloadExport()}
            className="shrink-0 rounded-chip border border-white/10 px-3 py-1.5 text-micro text-sub"
          >
            导出
          </button>
        }
      />

      {/* 日记同样把画像钉在右轨：每天说的话正是喂给画像的原料。
          原实现是 660px 的窄条居中在 1800px 屏上（利用率 37%），
          且自带第二条 sticky 顶栏与全站顶栏抢层级。 */}
      <PageShell
        compactMobile
        headerOnMobile={false}
        railOnMobile={false}
        rail={
          <PersonaRail caption="你每天留下的声音会汇进这里 —— 日记是画像最诚实的原料。" />
        }
        header={
          <PageHeading
            eyebrow="VOICE DIARY"
            title="语音日记"
            description="听见每天的自己，也看见长期变化"
            trailing={
              <button
                onClick={() => void downloadExport()}
                className="shrink-0 rounded-chip border border-white/10 px-3 py-1.5 text-caption text-sub transition hover:border-white/25 hover:text-ink"
              >
                导出
              </button>
            }
          />
        }
      >
        <div className="w-full">
        <div className="mt-2.5 flex gap-[5px] rounded-tile border border-line bg-white/[0.045] p-1">
          {TABS.map((tab) => {
            const active = view === tab.kind;
            return (
              <button
                key={tab.kind}
                onClick={() => setView(tab.kind)}
                className="flex-1 rounded-field py-[9px] text-caption transition"
                style={{
                  color: active ? "#fff" : "var(--color-faint)",
                  background: active
                    ? "linear-gradient(135deg, rgba(62,119,242,0.82), rgba(102,76,206,0.82))"
                    : "transparent",
                  boxShadow: active ? "0 5px 12px rgba(94,150,255,0.32)" : undefined,
                }}
              >
                {tab.label}
              </button>
            );
          })}
        </div>

        {entriesError && (
          <div className="mt-3 flex items-center gap-3 rounded-tile border border-[#FF6577]/20 bg-[#FF6577]/5 px-3.5 py-3">
            <span className="min-w-0 flex-1 text-caption text-sub">{entriesError}</span>
            <button onClick={() => void loadEntries()} className="text-caption text-brand">
              重试
            </button>
          </div>
        )}

        <div className="pt-1">
          {view === "day" &&
            (entriesLoading ? (
              <LoadingState text="正在读取你的日记…" />
            ) : (
              <DiaryDayView
                entries={entries}
                railDates={railDates}
                selectedDate={selectedDate}
                selectedEntries={selectedEntries}
                daySummary={daySummary}
                playingEntryId={playingEntryId}
                onSelect={selectDate}
                onTogglePlay={(entry) => void togglePlay(entry)}
                onDelete={(entry) => void removeEntry(entry)}
                onDeleteAudio={(entry) => void removeAudio(entry)}
                onRetry={(entry) => void retryEntry(entry)}
                onUpdateTranscript={saveTranscript}
                onStartRecording={() => router.push("/")}
              />
            ))}
          {view === "month" && (
            <DiarySummaryView
              isMonth
              summary={monthSummary}
              entriesCount={entries.length}
              loading={summaryLoading}
              error={summaryError}
              refreshing={refreshing}
              onRefresh={() => void refreshSummary()}
            />
          )}
          {view === "year" && (
            <DiarySummaryView
              isMonth={false}
              summary={yearSummary}
              entriesCount={entries.length}
              loading={summaryLoading}
              error={summaryError}
              refreshing={refreshing}
              onRefresh={() => void refreshSummary()}
            />
          )}
        </div>
        </div>
      </PageShell>
    </div>
  );
}

function LoadingState({ text }: { text: string }) {
  return (
    <div className="flex items-center justify-center gap-2.5 py-24 text-footnote text-sub">
      <span className="h-4 w-4 animate-spin rounded-full border-2 border-brand border-t-transparent" />
      {text}
    </div>
  );
}
