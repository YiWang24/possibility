"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuthGate } from "@/components/auth/AuthGate";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/Toast";
import {
  createVoiceDiary,
  finalizeVoiceDiary,
  listDiaryEntries,
  uploadDiaryAudio,
} from "@/features/diary/api";
import { DIARY_LIST_BODY } from "@/lib/boot-prefetch";
import {
  dayString,
  diaryFailure,
  entryEmoji,
  groupEntriesByDay,
  statusText,
  todayDate,
  type DiaryEntry,
} from "@/features/diary/data";
import {
  type RecordingResult,
  useAudioRecorder,
} from "@/features/diary/useAudioRecorder";
import { useHome } from "./store";

const MAX_DURATION_MS = 10 * 60 * 1000;
const MAX_AUDIO_BYTES = 20 * 1024 * 1024;
const WEEKDAY_CHARS = ["日", "一", "二", "三", "四", "五", "六"];

type SavePhase = "idle" | "creating" | "uploading" | "finalizing" | "failed";

interface PendingRecording {
  entryId: string;
  recording: RecordingResult;
  uploadPath?: string;
  maxBytes?: number;
  uploaded?: boolean;
}

function errorMessage(error: unknown): string {
  if (error instanceof Error && error.message.trim()) return error.message;
  return "保存录音时出现问题，请重试。";
}

function formatElapsed(durationMs: number): string {
  const seconds = Math.max(0, Math.floor(durationMs / 1000));
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
}

function recentSevenDays(): { date: string; label: string; today: boolean }[] {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Array.from({ length: 7 }, (_, index) => {
    const value = new Date(today);
    value.setDate(value.getDate() - (6 - index));
    return {
      date: dayString(value),
      label: index === 6 ? "今天" : WEEKDAY_CHARS[value.getDay()] ?? "",
      today: index === 6,
    };
  });
}

function DayCell({
  emoji,
  label,
  count,
  today,
}: {
  emoji: string;
  label: string;
  count: number;
  today: boolean;
}) {
  const filled = count > 0;
  return (
    <div className="flex flex-col items-center gap-1.5">
      <div className="relative flex h-[30px] w-[30px] items-center justify-center rounded-full text-lead">
        <span
          className="absolute inset-0 rounded-full"
          style={{
            background: filled
              ? "linear-gradient(135deg,#3E77F2,#B03390)"
              : "var(--color-raised)",
          }}
        />
        {today && (
          <span className="absolute -inset-0.5 rounded-full border-2 border-dashed border-brand/55" />
        )}
        <span className="relative">{emoji || "·"}</span>
        {count > 1 && (
          <span className="absolute -right-1.5 -top-1.5 min-w-4 rounded-full bg-brand px-1 text-center text-[8px] font-bold leading-4 text-white">
            {count}
          </span>
        )}
      </div>
      <span className={`text-micro ${today ? "text-brand" : "text-faint"}`}>{label}</span>
    </div>
  );
}

export function DiaryCard() {
  const router = useRouter();
  const show = useToast((state) => state.show);
  const { require: requireAuth } = useAuthGate();
  const recorder = useAudioRecorder();
  const loadDiaryOverview = useHome((state) => state.loadDiaryOverview);
  const [entries, setEntries] = useState<DiaryEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [phase, setPhase] = useState<SavePhase>("idle");
  const [saveError, setSaveError] = useState<string | null>(null);
  const [pending, setPending] = useState<PendingRecording | null>(null);
  const pendingRef = useRef<PendingRecording | null>(null);
  const finishingRef = useRef(false);

  const refresh = useCallback(async () => {
    try {
      /* 参数走共享常量：与首页 store 的探索天数请求同参，才能被 callFunction
         合流成一次网络请求（并命中引导脚本的抢跑）。 */
      const response = await listDiaryEntries(DIARY_LIST_BODY);
      setEntries(response.entries ?? []);
    } catch {
      setEntries([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const hasProcessingEntries = entries.some((entry) =>
    ["uploaded", "transcribing", "transcribed", "analyzing"].includes(
      entry.status,
    )
  );

  useEffect(() => {
    if (!hasProcessingEntries) return;
    const timer = window.setInterval(() => void refresh(), 4_000);
    return () => window.clearInterval(timer);
  }, [hasProcessingEntries, refresh]);

  const saveRecording = useCallback(
    async (initial: PendingRecording) => {
      let current = initial;
      pendingRef.current = current;
      setPending(current);
      setSaveError(null);
      try {
        if (!current.uploadPath) {
          setPhase("creating");
          const created = await createVoiceDiary({
            entryId: current.entryId,
            recordedAt: current.recording.recordedAt,
            timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC",
            mimeType: current.recording.mimeType,
          });
          current = {
            ...current,
            uploadPath: created.upload_path,
            maxBytes: created.max_bytes,
          };
          pendingRef.current = current;
          setPending(current);
        }

        const byteLimit = current.maxBytes ?? MAX_AUDIO_BYTES;
        if (current.recording.blob.size > byteLimit) {
          throw new Error("录音文件超过 20 MB，请缩短内容后重新录制。");
        }

        if (!current.uploaded) {
          setPhase("uploading");
          await uploadDiaryAudio({
            path: current.uploadPath!,
            blob: current.recording.blob,
            contentType: current.recording.mimeType,
          });
          current = { ...current, uploaded: true };
          pendingRef.current = current;
          setPending(current);
        }

        setPhase("finalizing");
        await finalizeVoiceDiary({
          entryId: current.entryId,
          durationMs: current.recording.durationMs,
        });

        pendingRef.current = null;
        setPending(null);
        setPhase("idle");
        show("录音已保存，正在等待转写");
        await refresh();
        void loadDiaryOverview();
      } catch (error) {
        setPhase("failed");
        setSaveError(errorMessage(error));
      }
    },
    [loadDiaryOverview, refresh, show],
  );

  const finishRecording = useCallback(async () => {
    if (finishingRef.current || !recorder.isRecording) return;
    finishingRef.current = true;
    const result = await recorder.stop();
    finishingRef.current = false;
    if (!result || result.blob.size === 0) {
      setSaveError("没有录到有效声音，请重新录制。");
      return;
    }
    const item: PendingRecording = {
      entryId: crypto.randomUUID(),
      recording: result,
    };
    void saveRecording(item);
  }, [recorder, saveRecording]);

  useEffect(() => {
    if (
      recorder.isRecording &&
      recorder.durationMs >= MAX_DURATION_MS &&
      !finishingRef.current
    ) {
      void finishRecording();
    }
  }, [finishRecording, recorder.durationMs, recorder.isRecording]);

  const week = useMemo(() => recentSevenDays(), []);
  const byDay = useMemo(() => groupEntriesByDay(entries), [entries]);
  const latestToday = (byDay.get(todayDate()) ?? []).at(-1);
  const saving = phase !== "idle" && phase !== "failed";
  const phaseText = {
    idle: "",
    creating: "正在创建安全记录…",
    uploading: "正在上传原始录音…",
    finalizing: "正在确认录音完整性…",
    failed: "保存中断",
  }[phase];

  return (
    <div className="kaleido-card px-5 py-[17px]">
      <div className="flex flex-col gap-3.5">
        <div className="flex items-center justify-between">
          <button
            onClick={() => router.push("/diary")}
            className="flex items-center gap-[7px] transition active:scale-[0.97]"
            aria-label="查看全部语音日记"
          >
            <span className="text-callout font-semibold text-ink">我的语音日记</span>
            <span className="flex h-[18px] w-[18px] items-center justify-center rounded-full border border-white/18 bg-white/6 text-callout text-white/80">
              ›
            </span>
          </button>
          {!recorder.isRecording && (
            <button
              onClick={() => requireAuth(() => void recorder.start())}
              disabled={saving || recorder.state === "requesting"}
              className="rounded-chip bg-brand/12 px-3 py-1.5 text-footnote font-medium text-brand disabled:opacity-50"
            >
              {recorder.state === "requesting" ? "请求麦克风…" : "◉ 记录今日"}
            </button>
          )}
        </div>

        <div className="flex items-center justify-between">
          {week.map((day) => {
            const dayEntries = byDay.get(day.date) ?? [];
            const latest = dayEntries.at(-1);
            return (
              <button
                key={day.date}
                onClick={() => router.push(`/diary?date=${day.date}`)}
                className="transition active:scale-[0.95]"
              >
                <DayCell
                  emoji={latest ? entryEmoji(latest) : ""}
                  label={day.label}
                  count={dayEntries.length}
                  today={day.today}
                />
              </button>
            );
          })}
        </div>

        {recorder.isRecording && (
          <div
            className="flex flex-col gap-2.5 rounded-tile p-3.5"
            style={{
              background:
                "linear-gradient(90deg, rgba(94,150,255,0.14), rgba(227,92,193,0.10))",
            }}
          >
            <div className="flex items-center gap-3">
              <div className="flex flex-1 items-center gap-[3px]">
                {Array.from({ length: 22 }).map((_, index) => (
                  <span
                    key={index}
                    className={`w-[2px] rounded-full bg-brand/70 ${
                      recorder.state === "recording" ? "animate-pulse" : ""
                    }`}
                    style={{ height: `${6 + ((index * 7) % 18)}px` }}
                  />
                ))}
              </div>
              <span className="w-[38px] font-mono text-footnote tabular-nums text-lime">
                {formatElapsed(recorder.durationMs)}
              </span>
              <Button size="sm" onClick={() => void finishRecording()}>
                完成
              </Button>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-micro text-faint">
                {recorder.state === "paused" ? "录音已暂停" : "正在记录你的声音"}
              </span>
              <div className="flex items-center gap-3">
                <button
                  onClick={recorder.state === "paused" ? recorder.resume : recorder.pause}
                  className="text-micro text-brand"
                >
                  {recorder.state === "paused" ? "继续" : "暂停"}
                </button>
                <button onClick={recorder.cancel} className="text-micro text-faint">
                  放弃
                </button>
              </div>
            </div>
          </div>
        )}

        {(saving || saveError || recorder.error) && (
          <div className="flex items-center gap-2 py-1.5">
            {saving && (
              <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-brand border-t-transparent" />
            )}
            <span className="min-w-0 flex-1 text-caption leading-relaxed text-sub">
              {recorder.error ?? saveError ?? phaseText}
            </span>
            {phase === "failed" && pending && (
              <button
                onClick={() => void saveRecording(pendingRef.current ?? pending)}
                className="shrink-0 text-caption font-medium text-brand"
              >
                重试
              </button>
            )}
            {recorder.error && (
              <button
                onClick={recorder.clearError}
                className="shrink-0 text-caption text-faint"
              >
                知道了
              </button>
            )}
          </div>
        )}

        {!recorder.isRecording && !saving && latestToday && (
          <div className="flex flex-col gap-2 pt-1">
            <div className="h-px w-full bg-line" />
            <span className="text-caption text-faint">
              {latestToday.status === "ready"
                ? "这次记录里，我听见了"
                : /* 失败时说清是哪一种失败——「处理失败」四个字既不告诉用户
                     发生了什么，也不告诉他们下一步能做什么。 */
                  (diaryFailure(latestToday)?.text ?? statusText(latestToday.status))}
            </span>
            {(latestToday.emotions.length > 0 || latestToday.keywords.length > 0) && (
              <div className="flex flex-wrap gap-1.5">
                {latestToday.emotions.map((emotion) => (
                  <span
                    key={`emotion-${emotion}`}
                    className="rounded-chip bg-lime px-[11px] py-1 text-caption font-semibold text-[#0B0F18]"
                  >
                    {entryEmoji(latestToday)} {emotion}
                  </span>
                ))}
                {latestToday.keywords.map((keyword) => (
                  <Badge key={`keyword-${keyword}`}>{keyword}</Badge>
                ))}
              </div>
            )}
            <button onClick={() => router.push("/diary")} className="self-end text-caption text-brand">
              查看详情 ›
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
