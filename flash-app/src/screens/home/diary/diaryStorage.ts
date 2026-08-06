// localStorage persistence + schema normalisation for real voice-diary entries,
// following the same throw-safe pattern as screens/me/myProfileStorage.ts.
//
// Every read assumes the stored data may come from an older build: fields may be
// missing, mistyped, or restructured. A single bad record must never crash the page,
// so normalisation drops what it cannot repair rather than throwing.

import { DIARY_ENTRIES, type DiaryEntry } from '@/data/diary';

export const DIARY_STORE_KEY = 'kaleido_voice_diary_v1';

const WEEKDAYS = ['日', '一', '二', '三', '四', '五', '六'];

export function safeStoreGet(key: string): unknown {
  try {
    const raw = localStorage.getItem(key);
    if (raw === null) return null;
    return JSON.parse(raw) as unknown;
  } catch {
    return null;
  }
}

export function safeStoreSet(key: string, value: unknown): boolean {
  try {
    localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}

function str(source: Record<string, unknown>, key: string): string {
  const value = source[key];
  return typeof value === 'string' ? value : '';
}

/** Read a string field, substituting `fallback` when it is missing or blank. */
function strOr(source: Record<string, unknown>, key: string, fallback: string): string {
  const value = str(source, key);
  return value === '' ? fallback : value;
}

/** ISO date (YYYY-MM-DD) in local time — never UTC, or entries land on the wrong day. */
export function localIsoDate(now: Date): string {
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${String(y)}-${m}-${d}`;
}

/** "8月6日 · 周四" — matches the label format of the seeded entries. */
export function diaryLabel(date: Date): string {
  return `${String(date.getMonth() + 1)}月${String(date.getDate())}日 · 周${WEEKDAYS[date.getDay()] ?? ''}`;
}

export function formatDuration(totalSeconds: number): string {
  const safe = Number.isFinite(totalSeconds) && totalSeconds > 0 ? Math.floor(totalSeconds) : 0;
  const m = Math.floor(safe / 60);
  const s = safe % 60;
  return `${String(m)}:${s < 10 ? '0' : ''}${String(s)}`;
}

/** Repair one persisted record, or drop it if it carries no usable content. */
export function normalizeEntry(raw: unknown): DiaryEntry | null {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) return null;
  const source = raw as Record<string, unknown>;

  const date = str(source, 'date');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return null;

  const transcript = (Array.isArray(source['transcript']) ? source['transcript'] : [])
    .filter((line): line is string => typeof line === 'string')
    .map((line) => line.trim())
    .filter((line) => line !== '');
  if (transcript.length === 0) return null;

  const keywords = (Array.isArray(source['keywords']) ? source['keywords'] : [])
    .filter((k): k is string => typeof k === 'string')
    .map((k) => k.trim())
    .filter((k) => k !== '');

  const parsed = new Date(`${date}T00:00:00`);
  const fallbackLabel = Number.isNaN(parsed.getTime()) ? date : diaryLabel(parsed);

  return {
    date,
    label: strOr(source, 'label', fallbackLabel),
    emoji: strOr(source, 'emoji', '🙂'),
    emotion: strOr(source, 'emotion', '说不太清的一天'),
    duration: strOr(source, 'duration', '0:00'),
    title: strOr(source, 'title', '今天的记录'),
    keywords,
    transcript,
    recorded: true,
  };
}

export function loadRecordedEntries(): DiaryEntry[] {
  const raw = safeStoreGet(DIARY_STORE_KEY);
  const list = Array.isArray(raw) ? raw : [];
  const entries: DiaryEntry[] = [];
  for (const item of list) {
    const entry = normalizeEntry(item);
    if (entry) entries.push(entry);
  }
  return entries;
}

export function saveRecordedEntries(entries: DiaryEntry[]): boolean {
  return safeStoreSet(DIARY_STORE_KEY, entries);
}

/**
 * Seeded demo entries plus the user's real ones, newest first.
 *
 * The July 2026 demo set is kept so the page is never empty for a reviewer; a real
 * recording on the same date wins, since it is the user's own account of that day.
 */
export function mergeWithSeed(recorded: DiaryEntry[]): DiaryEntry[] {
  const byDate = new Map<string, DiaryEntry>();
  for (const entry of DIARY_ENTRIES) byDate.set(entry.date, entry);
  for (const entry of recorded) byDate.set(entry.date, entry);
  return [...byDate.values()].sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));
}

/** Upsert one entry into the recorded list, replacing any existing record for that day. */
export function upsertEntry(recorded: DiaryEntry[], entry: DiaryEntry): DiaryEntry[] {
  const rest = recorded.filter((e) => e.date !== entry.date);
  return [...rest, entry];
}
