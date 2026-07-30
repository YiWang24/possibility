/* 测评器计分与持久化 —— 移植 iOS AssessmentModel.swift 的计分/进度语义。
   通用李克特计分（反向题取反）+ 维度百分比；本地 localStorage 持久化进度与结果，
   结果可写回 save-profile（save_dimension）。纯 TS，无 React 依赖。 */

import {
  assessmentConfig,
  BIG_FIVE_FACETS,
  BIG_FIVE_LOW_LABELS,
  facetMeta,
  HOLLAND_PAIR_NARRATIVE,
  targetDimension,
  type AssessmentConfig,
  type AssessmentKind,
} from "./data";

/** 单维得分（含配置元信息，便于结果/工坊直接渲染） */
export interface DimScore {
  key: string;
  name: string;
  label: string;
  color: string;
  desc: string;
  score: number;
  max: number;
  /** 0..1 */
  percent: number;
}

/** 单 facet 得分（仅大五用） */
export interface FacetScore {
  facet: string;
  name: string;
  dim: string;
  score: number;
  max: number;
  percent: number;
}

/** 完成后的结果（持久化到 localStorage，供工坊读取） */
export interface AssessmentResult {
  kind: AssessmentKind;
  answers: (number | null)[];
  /** 按配置维度顺序 */
  dims: { key: string; score: number; max: number; percent: number }[];
  facets?: { facet: string; score: number; max: number; percent: number }[];
  /** 写入画像的关键词 */
  tags: string[];
  /** 大五推导的 MBTI 类型（仅 bigfive） */
  mbti?: string;
  completedAt: number;
}

/* ============ localStorage 帮手（SSR 安全） ============ */

const PROGRESS_PREFIX = "kaleido_assessment_";
const RESULT_PREFIX = "kaleido_assessment_result_";

interface Progress {
  /** 每题选择的李克特下标（0..likert.length-1），未答为 null */
  answers: (number | null)[];
  updatedAt: number;
}

function lsGet(key: string): string | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}
function lsSet(key: string, value: string) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(key, value);
  } catch {
    /* 隐私模式静默 */
  }
}
function lsRemove(key: string) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(key);
  } catch {
    /* ignore */
  }
}

export function loadProgress(kind: AssessmentKind, itemCount: number): (number | null)[] {
  const raw = lsGet(PROGRESS_PREFIX + kind);
  if (!raw) return new Array(itemCount).fill(null);
  try {
    const parsed = JSON.parse(raw) as Progress;
    const answers = Array.isArray(parsed.answers) ? parsed.answers : [];
    // 题量对齐（题库变更时截断/补齐）
    const out = new Array<number | null>(itemCount).fill(null);
    for (let i = 0; i < Math.min(itemCount, answers.length); i++) {
      const v = answers[i];
      out[i] = typeof v === "number" ? v : null;
    }
    return out;
  } catch {
    return new Array(itemCount).fill(null);
  }
}

export function saveProgress(kind: AssessmentKind, answers: (number | null)[]) {
  const payload: Progress = { answers, updatedAt: Date.now() };
  lsSet(PROGRESS_PREFIX + kind, JSON.stringify(payload));
}

export function clearProgress(kind: AssessmentKind) {
  lsRemove(PROGRESS_PREFIX + kind);
}

export function loadResult(kind: AssessmentKind): AssessmentResult | null {
  const raw = lsGet(RESULT_PREFIX + kind);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as AssessmentResult;
  } catch {
    return null;
  }
}

export function saveResult(result: AssessmentResult) {
  lsSet(RESULT_PREFIX + result.kind, JSON.stringify(result));
}

/* ============ 计分 ============ */

/** 单题得分：正向题取下标，反向题取 (max-下标)。未答按 0 计（结果只在全答后展示） */
function itemValue(index: number | null, likertMax: number, reversed?: boolean): number {
  if (index === null) return 0;
  return reversed ? likertMax - index : index;
}

/** 按配置维度顺序计分（通用于所有测评） */
export function scoreDims(cfg: AssessmentConfig, answers: (number | null)[]): DimScore[] {
  const likertMax = cfg.likert.length - 1;
  const totals = new Map<string, { score: number; count: number }>();
  cfg.items.forEach((item, i) => {
    const entry = totals.get(item.dim) ?? { score: 0, count: 0 };
    entry.score += itemValue(answers[i], likertMax, item.reversed);
    entry.count += 1;
    totals.set(item.dim, entry);
  });
  return cfg.dims.map((d) => {
    const t = totals.get(d.key) ?? { score: 0, count: 0 };
    const max = t.count * likertMax;
    return {
      key: d.key,
      name: d.name,
      label: d.label,
      color: d.color,
      desc: d.desc,
      score: t.score,
      max,
      percent: max > 0 ? t.score / max : 0,
    };
  });
}

/** 大五 30 facet 计分 */
export function scoreFacets(answers: (number | null)[]): FacetScore[] {
  const cfg = assessmentConfig("bigfive");
  const likertMax = cfg.likert.length - 1;
  const totals = new Map<string, { score: number; count: number }>();
  cfg.items.forEach((item, i) => {
    if (!item.facet) return;
    const entry = totals.get(item.facet) ?? { score: 0, count: 0 };
    entry.score += itemValue(answers[i], likertMax, item.reversed);
    entry.count += 1;
    totals.set(item.facet, entry);
  });
  return BIG_FIVE_FACETS.map((f) => {
    const t = totals.get(f.f) ?? { score: 0, count: 0 };
    const max = t.count * likertMax;
    return {
      facet: f.f,
      name: f.name,
      dim: f.d,
      score: t.score,
      max,
      percent: max > 0 ? t.score / max : 0,
    };
  });
}

/** 大五五维分数（O/C/E/A/N 顺序） → MBTI 四字母 */
export function deriveMbti(dims: DimScore[]): string {
  const byKey = new Map(dims.map((d) => [d.key, d.percent]));
  const p = (k: string) => byKey.get(k) ?? 0.5;
  const ei = p("E") >= 0.5 ? "E" : "I";
  const sn = p("O") >= 0.5 ? "N" : "S"; // 开放性 → 直觉
  const tf = p("A") >= 0.5 ? "F" : "T"; // 宜人性 → 情感
  const jp = p("C") >= 0.5 ? "J" : "P"; // 尽责性 → 判断
  return `${ei}${sn}${tf}${jp}`;
}

/** RIASEC 前两位组合叙事（尝试两种字母序） */
export function hollandNarrative(dims: DimScore[]): string {
  const top = [...dims].sort((a, b) => b.percent - a.percent).slice(0, 2);
  if (top.length < 2) return "";
  const [a, b] = top.map((d) => d.key);
  return HOLLAND_PAIR_NARRATIVE[`${a}${b}`] ?? HOLLAND_PAIR_NARRATIVE[`${b}${a}`] ?? "";
}

/** RIASEC 兴趣代码（前三位，得分>0） */
export function hollandCode(dims: DimScore[]): string {
  return [...dims]
    .filter((d) => d.score > 0)
    .sort((a, b) => b.percent - a.percent)
    .slice(0, 3)
    .map((d) => d.key)
    .join("");
}

/** 写入画像的关键词（kind 相关） */
export function deriveTags(kind: AssessmentKind, dims: DimScore[]): string[] {
  if (kind === "bigfive") {
    // 每维取高分端/低分端标签，共 5 个
    return dims.map((d) =>
      d.percent >= 0.5 ? d.label : BIG_FIVE_LOW_LABELS[d.key] ?? d.label,
    );
  }
  // 其它：按得分降序取前 3（且有得分）维度的 label
  return [...dims]
    .filter((d) => d.score > 0)
    .sort((a, b) => b.percent - a.percent)
    .slice(0, 3)
    .map((d) => d.label);
}

/** 完成一次测评：计分 + 生成结果对象（不落库） */
export function buildResult(kind: AssessmentKind, answers: (number | null)[]): AssessmentResult {
  const cfg = assessmentConfig(kind);
  const dims = scoreDims(cfg, answers);
  const tags = deriveTags(kind, dims);
  const result: AssessmentResult = {
    kind,
    answers,
    dims: dims.map((d) => ({ key: d.key, score: d.score, max: d.max, percent: d.percent })),
    tags,
    completedAt: Date.now(),
  };
  if (kind === "bigfive") {
    result.facets = scoreFacets(answers).map((f) => ({
      facet: f.facet,
      score: f.score,
      max: f.max,
      percent: f.percent,
    }));
    result.mbti = deriveMbti(dims);
  }
  return result;
}

/** save-profile 写回 payload（bigfive → personality 维度） */
export function saveProfilePayload(kind: AssessmentKind, result: AssessmentResult) {
  const dimension = targetDimension(kind) ?? "personality";
  return {
    action: "save_dimension" as const,
    dimension,
    tags: result.tags,
    source: "assessment" as const,
    assessment_kind: kind,
    assessment_answers: result.answers,
    assessment_scores: {
      dims: result.dims,
      facets: result.facets ?? [],
      mbti: result.mbti ?? null,
    },
  };
}

/** 结果维度补全配置元信息（供工坊/结果视图渲染持久化结果） */
export function hydrateDims(kind: AssessmentKind, stored: AssessmentResult["dims"]): DimScore[] {
  const cfg = assessmentConfig(kind);
  return stored.map((s) => {
    const meta = cfg.dims.find((d) => d.key === s.key);
    return {
      key: s.key,
      name: meta?.name ?? s.key,
      label: meta?.label ?? s.key,
      color: meta?.color ?? "#5E96FF",
      desc: meta?.desc ?? "",
      score: s.score,
      max: s.max,
      percent: s.percent,
    };
  });
}

/** facet → 所属维度名（结果视图分组用） */
export function facetDimName(facet: string): string {
  return facetMeta(facet)?.d ?? "";
}
