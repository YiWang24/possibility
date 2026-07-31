import { emotionEmoji } from "@/lib/emotions";

export type DiaryEntryStatus =
  | "draft"
  | "uploaded"
  | "transcribing"
  | "transcribed"
  | "analyzing"
  | "ready"
  | "failed";

export interface DiaryEntry {
  id: number;
  entry_id: string;
  source: "voice" | "text";
  status: DiaryEntryStatus;
  recorded_at: string;
  local_date: string;
  timezone: string;
  has_audio: boolean;
  audio_mime: string | null;
  audio_bytes: number | null;
  duration_ms: number | null;
  transcript: string | null;
  transcript_language: string | null;
  title: string | null;
  entry_summary: string | null;
  emotions: string[];
  keywords: string[];
  content_version: number;
  error_code: string | null;
  uploaded_at: string | null;
  transcribed_at: string | null;
  analyzed_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface ListDiaryResponse {
  entries: DiaryEntry[];
  total: number;
}

export interface CreateDiaryEntryResponse {
  entry_id: string;
  status: DiaryEntryStatus;
  upload_path: string;
  mime_type: string;
  max_bytes: number;
}

export interface DiarySummaryResponse {
  period: "day" | "month" | "year";
  ref: string;
  status: "pending" | "generating" | "ready" | "stale" | "failed";
  stale: boolean;
  entry_count: number;
  active_day_count: number;
  total_duration_ms: number;
  top_emotions: string[];
  top_keywords: string[];
  insight: string;
  highlights: string[];
  highlight_refs: Array<{ text: string; entry_ids: string[] }>;
  generated_at: string | null;
  data_cutoff_at: string | null;
  error_code: string | null;
}

const WEEK_CN = ["日", "一", "二", "三", "四", "五", "六"];

export function dayString(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function todayDate(): string {
  return dayString(new Date());
}

export function parseDate(value: string): Date {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(year, month - 1, day);
}

export function diaryLabel(value: string): string {
  const date = parseDate(value);
  return `${date.getMonth() + 1}月${date.getDate()}日 · 周${WEEK_CN[date.getDay()]}`;
}

export function weekday(value: string): string {
  if (value === todayDate()) return "今天";
  return `周${WEEK_CN[parseDate(value).getDay()]}`;
}

export function dayNumber(value: string): number {
  return Number.parseInt(value.slice(-2), 10) || 0;
}

export function monthNumber(value: string): number {
  return Number.parseInt(value.slice(5, 7), 10) || 0;
}

export function formatDuration(durationMs: number | null): string {
  if (durationMs === null) return "--:--";
  const seconds = Math.max(0, Math.round(durationMs / 1000));
  const minutes = Math.floor(seconds / 60);
  return `${minutes}:${String(seconds % 60).padStart(2, "0")}`;
}

export function entryEmoji(entry: DiaryEntry): string {
  return emotionEmoji(entry.emotions[0], entry.source === "voice" ? "🎙" : "✎");
}

export function entryTitle(entry: DiaryEntry): string {
  if (entry.title?.trim()) return entry.title.trim();
  const transcript = entry.transcript?.trim();
  if (transcript) {
    const first = transcript.split(/[。！？!?\n]/).find((part) => part.trim());
    return (first ?? transcript).trim().slice(0, 28);
  }
  if (entry.status === "failed") return "这条日记处理失败";
  if (entry.status === "uploaded") return "录音已安全保存";
  return "正在整理这条语音日记";
}

export function statusText(status: DiaryEntryStatus): string {
  const labels: Record<DiaryEntryStatus, string> = {
    draft: "等待上传",
    uploaded: "等待转写",
    transcribing: "正在转写",
    transcribed: "转写完成",
    analyzing: "正在整理",
    ready: "已完成",
    failed: "处理失败",
  };
  return labels[status];
}

export function currentMonthRef(): string {
  return todayDate().slice(0, 7);
}

export function currentYearRef(): string {
  return todayDate().slice(0, 4);
}

export function groupEntriesByDay(entries: DiaryEntry[]): Map<string, DiaryEntry[]> {
  const groups = new Map<string, DiaryEntry[]>();
  for (const entry of entries) {
    const day = groups.get(entry.local_date) ?? [];
    day.push(entry);
    groups.set(entry.local_date, day);
  }
  for (const day of groups.values()) {
    day.sort((a, b) => a.recorded_at.localeCompare(b.recorded_at));
  }
  return groups;
}
