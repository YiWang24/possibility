"use client";
/* 语音日记详情页容器（原型 diaryPage / iOS DiaryDetailView.swift）：
   顶栏 + 固定三 tab（每日记录 / 月度总结 / 年度总结）+ 滚动内容；
   冷启动并发拉取 list-diary（今日真实条目覆盖）与 diary-summary（月/年）。 */

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { BackButton } from "@/features/card-game/ui";
import { useToast } from "@/components/ui/Toast";
import { callFunction } from "@/lib/supabase";
import type { DiarySummaryResponse, DiaryNote, ListDiaryResponse } from "./data";
import {
  currentMonthRef,
  currentYearRef,
  DIARY_ENTRIES,
  noteFromRemote,
  TODAY_DATE,
} from "./data";
import { buildRailDates, DiaryDayView } from "./DiaryDayView";
import { DiarySummaryView } from "./DiarySummaryView";

type ViewKind = "day" | "month" | "year";

const TABS: { kind: ViewKind; label: string }[] = [
  { kind: "day", label: "每日记录" },
  { kind: "month", label: "月度总结" },
  { kind: "year", label: "年度总结" },
];

export function DiaryDetail() {
  const router = useRouter();
  const show = useToast((s) => s.show);

  const [view, setView] = useState<ViewKind>("day");
  const [remoteNotes, setRemoteNotes] = useState<DiaryNote[]>([]);
  const [monthSummary, setMonthSummary] = useState<DiarySummaryResponse | null>(null);
  const [yearSummary, setYearSummary] = useState<DiarySummaryResponse | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const scrollTopRef = useRef<HTMLDivElement>(null);

  /* 全部条目：历史 demo 底座 + 今天云端真实条目，按日期升序 */
  const entries = useMemo(() => {
    return [...DIARY_ENTRIES, ...remoteNotes].sort((a, b) => (a.date < b.date ? -1 : 1));
  }, [remoteNotes]);

  /* 选中日期：默认最近一篇；今天有真实记录则选今天 */
  const [selectedDate, setSelectedDate] = useState<string>(
    DIARY_ENTRIES[DIARY_ENTRIES.length - 1]?.date ?? TODAY_DATE,
  );

  const selectedEntry = entries.find((e) => e.date === selectedDate) ?? null;
  const selectedIndex = Math.max(
    0,
    entries.findIndex((e) => e.date === selectedDate),
  );
  const railDates = useMemo(() => buildRailDates(entries), [entries]);

  /* 冷启动拉取 */
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const res = await callFunction<ListDiaryResponse>("list-diary", { limit: 50, offset: 0 });
        if (!alive) return;
        const today = (res.entries ?? [])
          .map(noteFromRemote)
          .filter((n): n is DiaryNote => n !== null && n.date === TODAY_DATE);
        if (today.length) {
          setRemoteNotes(today);
          setSelectedDate(TODAY_DATE);
        }
      } catch {
        /* 静默保留 demo 底座 */
      }
    })();
    (async () => {
      try {
        const [m, y] = await Promise.all([
          callFunction<DiarySummaryResponse>("diary-summary", {
            period: "month",
            ref: currentMonthRef(),
          }).catch(() => null),
          callFunction<DiarySummaryResponse>("diary-summary", {
            period: "year",
            ref: currentYearRef(),
          }).catch(() => null),
        ]);
        if (!alive) return;
        if (m) setMonthSummary(m);
        if (y) setYearSummary(y);
      } catch {
        /* 保留 demo */
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  /* 切 tab / 切日期回到顶部 */
  useEffect(() => {
    scrollTopRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [view, selectedDate]);

  const select = (date: string) => {
    setSelectedDate(date);
    setIsPlaying(false);
  };

  const togglePlay = () => {
    setIsPlaying((prev) => {
      const next = !prev;
      show(next ? "正在播放这篇语音日记" : "语音已暂停");
      return next;
    });
  };

  const refreshSummary = async () => {
    if (refreshing) return;
    setRefreshing(true);
    const isMonth = view === "month";
    try {
      const res = await callFunction<DiarySummaryResponse>("diary-summary", {
        period: isMonth ? "month" : "year",
        ref: isMonth ? currentMonthRef() : currentYearRef(),
      });
      if (isMonth) setMonthSummary(res);
      else setYearSummary(res);
      show(isMonth ? "月度总结已根据最新日记更新" : "年度总结已根据最新日记更新");
    } catch {
      show("暂时无法更新总结，展示最近内容");
    } finally {
      setRefreshing(false);
    }
  };

  return (
    <div className="min-h-dvh screen-bg">
      {/* 顶栏 */}
      <div className="sticky top-0 z-20 border-b border-line bg-paper/80 backdrop-blur">
        <div className="mx-auto flex w-full max-w-[680px] items-center gap-[13px] px-[22px] pt-3 pb-2.5">
          <BackButton onClick={() => router.back()} />
          <div className="min-w-0 flex-1">
            <div className="text-[16px] font-semibold tracking-[0.8px] text-ink">语音日记</div>
            <div className="text-[11px] text-faint">听见每天的自己，也看见长期变化</div>
          </div>
        </div>
      </div>

      <div className="mx-auto w-full max-w-[680px] px-5 pb-10">
        <div ref={scrollTopRef} className="h-px" />
        {/* 三 tab */}
        <div className="mt-2.5 flex gap-[5px] rounded-[14px] border border-line bg-white/[0.045] p-1">
          {TABS.map((tab) => {
            const on = view === tab.kind;
            return (
              <button
                key={tab.kind}
                onClick={() => setView(tab.kind)}
                className="flex-1 rounded-[10px] py-[9px] text-[11.5px] transition"
                style={{
                  color: on ? "#fff" : "var(--color-faint)",
                  background: on
                    ? "linear-gradient(135deg, rgba(62,119,242,0.82), rgba(102,76,206,0.82))"
                    : "transparent",
                  boxShadow: on ? "0 5px 7px rgba(94,150,255,0.55)" : undefined,
                }}
              >
                {tab.label}
              </button>
            );
          })}
        </div>

        <div className="pt-1">
          {view === "day" && (
            <DiaryDayView
              entries={entries}
              railDates={railDates}
              selectedDate={selectedDate}
              selectedEntry={selectedEntry}
              selectedIndex={selectedIndex}
              isPlaying={isPlaying}
              onSelect={select}
              onTogglePlay={togglePlay}
              onStartRecording={() => router.push("/")}
            />
          )}
          {view === "month" && (
            <DiarySummaryView
              isMonth
              summary={monthSummary}
              entriesCount={entries.length}
              refreshing={refreshing}
              onRefresh={refreshSummary}
            />
          )}
          {view === "year" && (
            <DiarySummaryView
              isMonth={false}
              summary={yearSummary}
              entriesCount={entries.length}
              refreshing={refreshing}
              onRefresh={refreshSummary}
            />
          )}
        </div>
      </div>
    </div>
  );
}
