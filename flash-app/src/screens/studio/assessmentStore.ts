// 每种测评的答题进度与结果：选择即写 localStorage，可随时退出续答（对齐 iOS
// AssessmentModel 的 load / persist）。画像工作室的卡片状态也从这里读，不必为了
// 一行文案就跑一遍计分。

import { create } from 'zustand';
import { safeStoreGet, safeStoreSet } from '@/screens/me/myProfileStorage';
import { assessmentSpec, type AssessmentKind } from './assessmentConfig';
import { computeResult, type AssessmentResult } from './assessmentEngine';

export type AssessmentPhase = 'intro' | 'questions' | 'result';

/** 量表最高档的下标（0–4）。 */
const MAX_ANSWER = 4;

export interface AssessmentProgress {
  phase: AssessmentPhase;
  index: number;
  /** 每题 0–4，null 表示未答。长度恒等于题数。 */
  answers: (number | null)[];
  result: AssessmentResult | null;
}

// ---- 反序列化兜底（数据可能来自旧版本） -------------------------------------

function asRecord(value: unknown): Record<string, unknown> {
  return typeof value === 'object' && value !== null ? (value as Record<string, unknown>) : {};
}

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function toNumberRecord(raw: unknown): Record<string, number> {
  const source = asRecord(raw);
  const out: Record<string, number> = {};
  for (const key of Object.keys(source)) {
    const value = source[key];
    if (typeof value === 'number' && Number.isFinite(value)) out[key] = value;
  }
  return out;
}

function toStringList(raw: unknown): string[] {
  return asArray(raw).filter((value): value is string => typeof value === 'string');
}

function blankAnswers(total: number): (number | null)[] {
  return Array.from({ length: total }, () => null);
}

function normalizeResult(raw: unknown): AssessmentResult | null {
  const src = asRecord(raw);
  const scores = toNumberRecord(src['scores']);
  const ordered = toStringList(src['ordered']);
  if (ordered.length === 0 || Object.keys(scores).length === 0) return null;

  const facets = toNumberRecord(src['facets']);
  const selected = toStringList(src['selected']);
  const completedAt = src['completedAt'];
  const code = src['code'];
  const displayCode = src['displayCode'];

  return {
    scores,
    ordered,
    completedAt: typeof completedAt === 'number' ? completedAt : 0,
    ...(Object.keys(facets).length > 0 ? { facets } : {}),
    ...(selected.length > 0 ? { selected } : {}),
    ...(typeof code === 'string' ? { code } : {}),
    ...(typeof displayCode === 'string' ? { displayCode } : {}),
  };
}

function normalizeProgress(raw: unknown, total: number): AssessmentProgress {
  const empty: AssessmentProgress = { phase: 'intro', index: 0, answers: blankAnswers(total), result: null };
  const src = asRecord(raw);
  const stored = asArray(src['answers']);
  // 题数对不上说明题库改过：旧答案错位映射到新题比重来更糟，整条作废。
  if (stored.length !== total) return empty;

  const answers = stored.map((value) =>
    typeof value === 'number' && Number.isInteger(value) && value >= 0 && value <= MAX_ANSWER ? value : null,
  );
  const rawIndex = src['index'];
  const index =
    typeof rawIndex === 'number' && Number.isInteger(rawIndex) ? Math.min(Math.max(rawIndex, 0), Math.max(total - 1, 0)) : 0;
  const result = normalizeResult(src['result']);
  // phase 不持久化：重进时有结果就看结果，否则回到 intro，与 iOS 一致。
  return { phase: result !== null ? 'result' : 'intro', index, answers, result };
}

function persist(kind: AssessmentKind, progress: AssessmentProgress): void {
  safeStoreSet(assessmentSpec(kind).storeKey, {
    index: progress.index,
    answers: progress.answers,
    result: progress.result,
  });
}

function loadOne(kind: AssessmentKind): AssessmentProgress {
  const spec = assessmentSpec(kind);
  return normalizeProgress(safeStoreGet(spec.storeKey), spec.items.length);
}

// ---- store ------------------------------------------------------------------

type AssessmentMap = Record<AssessmentKind, AssessmentProgress>;

interface AssessmentState {
  byKind: AssessmentMap;
  /** 从第一道未答题开始（没有就从头），进入答题态。 */
  begin: (kind: AssessmentKind) => void;
  select: (kind: AssessmentKind, value: number) => void;
  previous: (kind: AssessmentKind) => void;
  /** 下一题；已是末题则校验空题或结算。返回需要 toast 的文案。 */
  next: (kind: AssessmentKind) => string | null;
  showResult: (kind: AssessmentKind) => void;
  showIntro: (kind: AssessmentKind) => void;
}

export const useAssessmentStore = create<AssessmentState>((set, get) => {
  const write = (kind: AssessmentKind, next: AssessmentProgress, save: boolean): void => {
    if (save) persist(kind, next);
    set((state) => {
      const byKind: AssessmentMap = { ...state.byKind };
      byKind[kind] = next;
      return { byKind };
    });
  };

  return {
    byKind: {
      bigfive: loadOne('bigfive'),
      bigfiveLite: loadOne('bigfiveLite'),
      strength: loadOne('strength'),
      love: loadOne('love'),
      family: loadOne('family'),
      holland: loadOne('holland'),
    },

    begin: (kind) => {
      const current = get().byKind[kind];
      const firstEmpty = current.answers.findIndex((value) => value === null);
      write(kind, { ...current, phase: 'questions', index: firstEmpty >= 0 ? firstEmpty : 0 }, true);
    },

    select: (kind, value) => {
      const current = get().byKind[kind];
      const answers = current.answers.map((prev, i) => (i === current.index ? value : prev));
      write(kind, { ...current, answers }, true);
    },

    previous: (kind) => {
      const current = get().byKind[kind];
      if (current.index <= 0) return;
      write(kind, { ...current, index: current.index - 1 }, true);
    },

    next: (kind) => {
      const spec = assessmentSpec(kind);
      const current = get().byKind[kind];
      if ((current.answers[current.index] ?? null) === null) return null;

      if (current.index < spec.items.length - 1) {
        write(kind, { ...current, index: current.index + 1 }, true);
        return null;
      }
      const missing = current.answers.findIndex((value) => value === null);
      if (missing >= 0) {
        write(kind, { ...current, index: missing }, true);
        return '还有一道题没有回答';
      }
      write(kind, { ...current, phase: 'result', result: computeResult(spec, current.answers) }, true);
      return null;
    },

    showResult: (kind) => {
      const current = get().byKind[kind];
      if (current.result === null) return;
      write(kind, { ...current, phase: 'result' }, false);
    },

    showIntro: (kind) => {
      write(kind, { ...get().byKind[kind], phase: 'intro' }, false);
    },
  };
});

// ---- 派生查询 ---------------------------------------------------------------

export function answeredCount(progress: AssessmentProgress): number {
  return progress.answers.filter((value) => value !== null).length;
}

export interface AssessmentSnapshot {
  answered: number;
  total: number;
  result: AssessmentResult | null;
}

/** 画像工作室卡片的状态快照。 */
export function snapshotOf(progress: AssessmentProgress): AssessmentSnapshot {
  return { answered: answeredCount(progress), total: progress.answers.length, result: progress.result };
}

export function useAssessment(kind: AssessmentKind): AssessmentProgress {
  return useAssessmentStore((state) => state.byKind[kind]);
}
