// Shared voice-diary state. DiaryCard (home) and DiaryPush/DiaryDay (push page) are
// siblings in the tree, so a recording made on one has to appear on the other —
// same reason screens/me/myProfileStore.ts exists.

import { create } from 'zustand';
import type { DiaryEntry } from '@/data/diary';
import { analyzeDiaryTranscript, type DiaryAnalysis } from './diaryAnalyze';
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

/**
 * Dictation runs as a chain of engine sessions, not one long one.
 *
 * The recogniser ends a session on its own after a pause — `continuous` defaults to
 * false in the host API and cannot be relied on even when requested. The product
 * promise is "talk until you tap 完成", so when a session ends by itself we bank its
 * text and open the next one. `onText` reports the full text of the *current* session
 * only, so without banking, everything said before a pause would be lost.
 */
let committed = '';
let live = '';
let restarts = 0;
/** Set while finishRecording is stopping, so onEnd does not reopen the session. */
let finishing = false;

/** How many self-restarts to allow before treating the engine as unusable. */
const MAX_RESTARTS = 40;
/** Time for the engine's last onText to arrive after stop() resolves. */
const FINAL_TEXT_GRACE_MS = 350;

function combined(): string {
  if (committed === '') return live;
  if (live === '') return committed;
  return `${committed} ${live}`;
}

type SetState = (partial: Partial<DiaryState>) => void;

/** Open one engine session, rechaining it when it ends before the user is done. */
async function openSession(set: SetState, get: () => DiaryState): Promise<void> {
  try {
    await startAsrSession({
      onText: (text) => {
        live = text;
        set({ transcript: combined() });
      },
      onError: (message, code) => {
        // A pause-triggered no-speech is normal mid-dictation; onEnd rechains it.
        if (code === 'no-speech' || code === 'aborted') return;
        finishing = true;
        set({ phase: 'error', error: message });
      },
      onEnd: () => {
        if (finishing || get().phase !== 'recording') return;
        // Bank this session's text, then continue listening.
        if (live.trim() !== '') {
          committed = combined();
          live = '';
          set({ transcript: committed });
        }
        restarts += 1;
        if (restarts > MAX_RESTARTS) {
          finishing = true;
          set({ phase: 'error', error: '录音一直中断，请检查麦克风或稍后再试' });
          return;
        }
        void openSession(set, get);
      },
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : '无法启动录音，请检查麦克风权限';
    finishing = true;
    set({ phase: 'error', error: message, asrSupported: isAsrAvailable() });
  }
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
    // Manual-entry path only; dictation goes through pushLive() below.
    committed = text;
    live = '';
    set({ transcript: text });
  },

  tick: () => {
    set((s) => (s.phase === 'recording' ? { seconds: s.seconds + 1 } : {}));
  },

  startRecording: async () => {
    committed = '';
    live = '';
    restarts = 0;
    finishing = false;
    set({ phase: 'recording', transcript: '', seconds: 0, error: null, analysisFailedDate: null });
    await openSession(set, get);
  },

  finishRecording: async () => {
    if (get().phase !== 'recording') return;
    finishing = true;
    try {
      await stopAsrSession();
    } catch {
      // A failed stop still leaves whatever text already arrived usable.
    }
    // The engine may emit its last onText just after stop() resolves, so give that
    // final chunk a moment to land rather than reading an empty transcript.
    await new Promise((r) => setTimeout(r, FINAL_TEXT_GRACE_MS));

    const seconds = get().seconds;
    const text = combined().trim();
    if (text === '') {
      set({
        phase: 'error',
        // Distinct from the host's own no-speech copy, so the two failures stay
        // tellable apart when someone reports this.
        error: '这段没有录到内容，可以再说一次，或直接手动写下来',
        transcript: '',
      });
      return;
    }
    set({ phase: 'analyzing' });
    await persist(set, get, text, seconds);
  },

  cancelRecording: async () => {
    // Before aborting, or onEnd would rechain a session the user just dismissed.
    finishing = true;
    committed = '';
    live = '';
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
    // An analysis failure leaves phase 'done' with the entry already saved, so only
    // a genuine error state returns to idle — dismissing must not undo a save.
    set({ error: null, phase: get().phase === 'error' ? 'idle' : get().phase });
  },

  reset: () => {
    committed = '';
    live = '';
    finishing = true;
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
  // Annotated rather than inferred: the platform's build runs a stricter check than the
  // local one and rejects an evolving `let x = null`.
  let analysis: DiaryAnalysis | null = null;
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
