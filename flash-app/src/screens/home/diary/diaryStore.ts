// Shared voice-diary state. DiaryCard (home) and DiaryPush/DiaryDay (push page) are
// siblings in the tree, so a recording made on one has to appear on the other —
// same reason screens/me/myProfileStore.ts exists.

import { create } from 'zustand';
import type { DiaryEntry } from '@/data/diary';
import { analyzeDiaryTranscript } from './diaryAnalyze';
import { abortAsrSession, isAsrAvailable, startAsrSession, stopAsrSession } from './diaryAsr';
import { diaryLabel, formatDuration, loadRecordedEntries, localIsoDate, saveRecordedEntries, upsertEntry } from './diaryStorage';

/** idle → recording → analyzing → done, with error as a terminal branch of any step. */
export type RecordPhase = 'idle' | 'recording' | 'analyzing' | 'done' | 'error';

interface DiaryState {
  /** Real recordings only — seeded demo data is merged in on read. */
  recorded: DiaryEntry[];
  phase: RecordPhase;
  /** Live transcript during recording, final transcript afterwards. */
  transcript: string;
  seconds: number;
  error: string | null;
  /** Set when the transcript saved but the model could not be reached. */
  analysisFailedDate: string | null;
  asrSupported: boolean;

  startRecording: () => Promise<void>;
  finishRecording: () => Promise<void>;
  cancelRecording: () => Promise<void>;
  setTranscript: (text: string) => void;
  tick: () => void;
  saveManual: () => Promise<void>;
  retryAnalysis: (date: string) => Promise<void>;
  dismissError: () => void;
  reset: () => void;
}

function buildEntry(
  date: Date,
  transcript: string,
  seconds: number,
  analysis: { title: string; emotion: string; emoji: string; keywords: string[] } | null,
): DiaryEntry {
  return {
    date: localIsoDate(date),
    label: diaryLabel(date),
    emoji: analysis?.emoji ?? '🙂',
    emotion: analysis?.emotion ?? '还没有分析出情绪',
    duration: formatDuration(seconds),
    title: analysis?.title ?? '今天的记录',
    keywords: analysis?.keywords ?? [],
    transcript: [transcript],
  };
}

export const useDiaryStore = create<DiaryState>((set, get) => ({
  recorded: loadRecordedEntries(),
  phase: 'idle',
  transcript: '',
  seconds: 0,
  error: null,
  analysisFailedDate: null,
  asrSupported: isAsrAvailable(),

  setTranscript: (text) => {
    // Host pushes the full transcript each time — overwrite, never append.
    set({ transcript: text });
  },

  tick: () => {
    set((s) => (s.phase === 'recording' ? { seconds: s.seconds + 1 } : {}));
  },

  startRecording: async () => {
    set({ phase: 'recording', transcript: '', seconds: 0, error: null, analysisFailedDate: null });
    try {
      await startAsrSession({
        onText: (text) => {
          get().setTranscript(text);
        },
        onError: (message) => {
          set({ phase: 'error', error: message });
        },
        onEnd: (reason) => {
          if (reason === 'error') return;
          // 'stop' is handled by finishRecording; nothing to do for a clean abort.
        },
      });
    } catch (e) {
      const message = e instanceof Error ? e.message : '无法启动录音，请检查麦克风权限';
      set({ phase: 'error', error: message, asrSupported: isAsrAvailable() });
    }
  },

  finishRecording: async () => {
    if (get().phase !== 'recording') return;
    try {
      await stopAsrSession();
    } catch {
      // A failed stop still leaves whatever text already arrived usable.
    }
    const { transcript, seconds } = get();
    const text = transcript.trim();
    if (text === '') {
      set({ phase: 'error', error: '没有听清，靠近一点再说一次试试', transcript: '' });
      return;
    }
    set({ phase: 'analyzing' });
    await persist(set, get, text, seconds);
  },

  cancelRecording: async () => {
    try {
      await abortAsrSession();
    } catch {
      // Nothing to recover — the session is being discarded anyway.
    }
    set({ phase: 'idle', transcript: '', seconds: 0, error: null });
  },

  /** Fallback path when ASR is unavailable and the user typed the entry instead. */
  saveManual: async () => {
    const text = get().transcript.trim();
    if (text === '') {
      set({ error: '还没有内容，先写点什么吧' });
      return;
    }
    set({ phase: 'analyzing' });
    await persist(set, get, text, get().seconds);
  },

  retryAnalysis: async (date) => {
    const entry = get().recorded.find((e) => e.date === date);
    if (!entry) return;
    const text = entry.transcript.join('\n').trim();
    if (text === '') return;
    set({ phase: 'analyzing', error: null });
    try {
      const analysis = await analyzeDiaryTranscript(text);
      if (!analysis) {
        set({ phase: 'done', analysisFailedDate: date });
        return;
      }
      const updated: DiaryEntry = { ...entry, ...analysis };
      const recorded = upsertEntry(get().recorded, updated);
      saveRecordedEntries(recorded);
      set({ recorded, phase: 'done', analysisFailedDate: null });
    } catch {
      set({ phase: 'done', analysisFailedDate: date, error: '分析失败了，可以稍后再试' });
    }
  },

  dismissError: () => {
    set({ error: null, phase: 'idle' });
  },

  reset: () => {
    set({ phase: 'idle', transcript: '', seconds: 0, error: null, analysisFailedDate: null });
  },
}));

/**
 * Save the transcript, with the analysis if it can be obtained.
 *
 * The transcript is written either way: losing what the user actually said because a
 * model call failed would be the worst outcome here, so a failure only leaves the
 * keywords empty and flags the day for retry.
 */
async function persist(set: (partial: Partial<DiaryState>) => void, get: () => DiaryState, text: string, seconds: number): Promise<void> {
  const now = new Date();
  const date = localIsoDate(now);
  let analysis = null;
  let failed = false;
  try {
    analysis = await analyzeDiaryTranscript(text);
    failed = analysis === null;
  } catch {
    failed = true;
  }
  const entry = buildEntry(now, text, seconds, analysis);
  const recorded = upsertEntry(get().recorded, entry);
  const stored = saveRecordedEntries(recorded);
  set({
    recorded,
    phase: 'done',
    transcript: text,
    analysisFailedDate: failed ? date : null,
    error: stored ? null : '本地存储写入失败，这条日记可能不会被保留',
  });
}
