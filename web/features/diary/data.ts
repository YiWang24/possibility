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
  // 录音转不出文字时，我们这边其实什么都没坏——音频好好存着，只是没听到话。
  // 一律叫「处理失败」会让用户以为记录丢了。
  if (entry.status === "failed") {
    return diaryFailure(entry)?.recovery === "rewrite"
      ? "这条录音没能转成文字"
      : "这条日记处理失败";
  }
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

/**
 * 失败之后用户能做什么。后端把终态失败按原因分开了，前端必须跟着分——
 * 对着静音录的那一条再点一次「重试」，只会原样再失败一次，把用户困在死循环里。
 * 错误码契约见 docs/features/语音日记真实数据与AI总结设计.md §20.2。
 */
export type DiaryRecovery =
  /** 瞬时故障（限流、超时、数据库抖动），重试真的有用 */
  | "retry"
  /** 录音本身转不出文字，出路是补文字或重录，重试没有意义 */
  | "rewrite"
  /** 我们这边的配置坏了，用户按什么都没用，只能等修复 */
  | "wait";

export interface DiaryFailure {
  text: string;
  recovery: DiaryRecovery;
}

const FAILURES: Record<string, DiaryFailure> = {
  // —— 录音本身的问题：重试必然重复失败 ——
  TRANSCRIPTION_EMPTY: {
    text: "这段录音里没有听到说话声。可以直接补充文字，或重新录一条。",
    recovery: "rewrite",
  },
  UNSUPPORTED_AUDIO: {
    text: "这段录音的格式没能解析。可以直接补充文字，或换个浏览器重录。",
    recovery: "rewrite",
  },
  TRANSCRIPTION_AUDIO_REJECTED: {
    text: "这段录音没能被识别。可以直接补充文字，或重新录一条。",
    recovery: "rewrite",
  },
  TRANSCRIPTION_TOO_LONG: {
    text: "这段录音转出的文字太长了，建议拆成几条分别记录。",
    recovery: "rewrite",
  },
  AUDIO_TOO_LARGE: {
    text: "录音文件超过了 20MB 上限，建议拆成几条分别记录。",
    recovery: "rewrite",
  },
  AUDIO_NOT_FOUND: {
    text: "找不到原始录音了。可以直接补充文字，把这一天留下来。",
    recovery: "rewrite",
  },
  TRANSCRIPT_EMPTY: {
    text: "这条日记还没有文字内容，补上几句就能继续整理。",
    recovery: "rewrite",
  },
  // —— 我们这边的问题 ——
  TRANSCRIPTION_CONFIGURATION_ERROR: {
    text: "转写服务暂时不可用，我们已经收到告警。原始录音安全保留着。",
    recovery: "wait",
  },
};

const RETRYABLE_FALLBACK: DiaryFailure = {
  text: "处理中途中断了，原始录音仍然安全保留，可以重试。",
  recovery: "retry",
};

/** 只对 failed 条目返回失败详情；其余状态返回 null。 */
export function diaryFailure(entry: DiaryEntry): DiaryFailure | null {
  if (entry.status !== "failed") return null;
  const code = entry.error_code;
  if (!code) return RETRYABLE_FALLBACK;
  // TRANSCRIPTION_UPSTREAM_429 / _503 …… 状态码是动态拼进去的，按前缀归入瞬时故障。
  if (code.startsWith("TRANSCRIPTION_UPSTREAM_")) return RETRYABLE_FALLBACK;
  return FAILURES[code] ?? RETRYABLE_FALLBACK;
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
