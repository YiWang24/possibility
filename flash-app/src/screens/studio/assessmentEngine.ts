// 六种测评共用的计分与结果文案（对齐 iOS AssessmentModel 的 completeDemo /
// completeHolland / resultTags / resultNarrative）。全部是纯函数，不碰存储也不碰
// React，便于单独验证。

import { BIGFIVE_LOW_LABELS, HIGH_SCORE_THRESHOLD } from '@/data/demoAssessments';
import { computeHollandResult, HOLLAND_PAIR_NARRATIVE } from '@/screens/me/hollandScoring';
import { isBigFive, type AssessmentDimSpec, type AssessmentSpec } from './assessmentConfig';

/** 5 点量表的最高分（0–4），维度满分 = 题数 × 该值。 */
const LIKERT_MAX = 4;

export interface AssessmentResult {
  /** 维度键 → 分数。percent 制为 0–100，sum 制（霍兰德）为原始总分 0–20。 */
  scores: Record<string, number>;
  /** 分数降序的维度键，同分按 spec.dims 声明序。 */
  ordered: string[];
  completedAt: number;
  /** facet 码 → 百分比，仅大五完整版。 */
  facets?: Record<string, number>;
  /** 并列组展开后选中的维度，仅霍兰德。 */
  selected?: string[];
  code?: string;
  displayCode?: string;
}

export function computeResult(spec: AssessmentSpec, answers: readonly (number | null)[]): AssessmentResult {
  return spec.scoring === 'sum' ? hollandResult(answers) : demoResult(spec, answers);
}

function hollandResult(answers: readonly (number | null)[]): AssessmentResult {
  const raw = computeHollandResult(answers);
  return {
    scores: { ...raw.scores },
    ordered: [...raw.ordered],
    selected: [...raw.selected],
    code: raw.code,
    displayCode: raw.displayCode,
    completedAt: Date.now(),
  };
}

function demoResult(spec: AssessmentSpec, answers: readonly (number | null)[]): AssessmentResult {
  const dimTotal = new Map<string, number>();
  const dimCount = new Map<string, number>();
  const facetTotal = new Map<string, number>();
  const facetCount = new Map<string, number>();

  spec.items.forEach((item, index) => {
    const raw = answers[index] ?? 0;
    // 反向题按 4 - v 折算，与 iOS completeDemo 一致。
    const value = item.r === true ? LIKERT_MAX - raw : raw;
    dimTotal.set(item.d, (dimTotal.get(item.d) ?? 0) + value);
    dimCount.set(item.d, (dimCount.get(item.d) ?? 0) + 1);
    if (item.f !== undefined) {
      facetTotal.set(item.f, (facetTotal.get(item.f) ?? 0) + value);
      facetCount.set(item.f, (facetCount.get(item.f) ?? 0) + 1);
    }
  });

  const scores: Record<string, number> = {};
  for (const dim of spec.dims) {
    scores[dim.key] = toPercent(dimTotal.get(dim.key) ?? 0, dimCount.get(dim.key) ?? 0);
  }

  const facets: Record<string, number> = {};
  for (const [code, total] of facetTotal) {
    facets[code] = toPercent(total, facetCount.get(code) ?? 0);
  }

  return {
    scores,
    ordered: orderDims(spec, scores),
    completedAt: Date.now(),
    ...(Object.keys(facets).length > 0 ? { facets } : {}),
  };
}

function toPercent(total: number, count: number): number {
  if (count === 0) return 0;
  return Math.round((total / (count * LIKERT_MAX)) * 100);
}

/** 分数降序；同分时按 spec.dims 的声明顺序，保证排序稳定可复现。 */
function orderDims(spec: AssessmentSpec, scores: Record<string, number>): string[] {
  return spec.dims
    .map((dim, index) => ({ key: dim.key, score: scores[dim.key] ?? 0, index }))
    .sort((a, b) => (a.score !== b.score ? b.score - a.score : a.index - b.index))
    .map((entry) => entry.key);
}

// ---- 结果文案 ---------------------------------------------------------------

const BIGFIVE_LOW = new Map<string, string>(Object.entries(BIGFIVE_LOW_LABELS));

export function dimOf(spec: AssessmentSpec, key: string): AssessmentDimSpec | undefined {
  return spec.dims.find((dim) => dim.key === key);
}

function labelOf(spec: AssessmentSpec, key: string): string {
  return dimOf(spec, key)?.label ?? key;
}

function isHigh(result: AssessmentResult, key: string): boolean {
  return (result.scores[key] ?? 0) >= HIGH_SCORE_THRESHOLD;
}

/** 可写入画像的关键词组。 */
export function resultTags(spec: AssessmentSpec, result: AssessmentResult): string[] {
  if (spec.kind === 'holland') {
    return (result.selected ?? result.ordered.slice(0, 3)).map((key) => labelOf(spec, key));
  }
  if (isBigFive(spec.kind)) {
    // 五个维度都给标签：高分端用维度标签，低分端用正向的低分命名。
    return spec.dims.map((dim) => (isHigh(result, dim.key) ? dim.label : (BIGFIVE_LOW.get(dim.key) ?? dim.label)));
  }
  if (spec.kind === 'love') {
    return [isHigh(result, 'anxiety') ? '及时回应' : '稳定信任', isHigh(result, 'avoidance') ? '尊重边界' : '亲密联结', '冲突后愿意修复'];
  }
  return result.ordered.slice(0, 3).map((key) => labelOf(spec, key));
}

export function resultNarrative(spec: AssessmentSpec, result: AssessmentResult): string {
  if (spec.kind === 'holland') return hollandNarrative(spec, result);
  if (spec.kind === 'love') return loveNarrative(result);

  const first = result.ordered[0];
  const second = result.ordered[1];
  const d0 = first !== undefined ? dimOf(spec, first) : undefined;
  const d1 = second !== undefined ? dimOf(spec, second) : undefined;
  if (d0 === undefined || d1 === undefined) return '';
  return `目前最突出的两个信号是“${d0.label}”和“${d1.label}”。${d0.desc}；同时也表现出${d1.desc}的倾向。`;
}

function hollandNarrative(spec: AssessmentSpec, result: AssessmentResult): string {
  // 并列组展开后超过 3 个，说明六类兴趣拉不开差距。
  if ((result.selected ?? []).length > 3) {
    return '你的六类兴趣比较接近。这不表示没有特点，可能意味着你能从多种活动中获得动力，也需要更多真实体验来拉开偏好。';
  }
  const a = result.ordered[0] ?? 'R';
  const b = result.ordered[1] ?? a;
  const pair = HOLLAND_PAIR_NARRATIVE[a + b];
  if (pair !== undefined) return pair;
  const nameA = dimOf(spec, a)?.name ?? a;
  const nameB = dimOf(spec, b)?.name ?? b;
  return `你的兴趣主要落在${nameA}与${nameB}之间。它们可以出现在很多行业、角色和生活项目里。`;
}

function loveNarrative(result: AssessmentResult): string {
  const anxious = isHigh(result, 'anxiety');
  const avoidant = isHigh(result, 'avoidance');
  if (anxious && avoidant) return '你既需要明确的回应，也会在过度靠近时保护自己的空间。关系里的确定感与边界感需要同时被看见。';
  if (anxious) return '你更容易通过及时回应、稳定承诺与冲突后的修复获得安全感。沉默和悬而未决可能比争执本身更消耗你。';
  if (avoidant) return '你重视自主与边界，更愿意在不被催促和侵入的前提下逐渐靠近。被尊重空间会帮助你表达需要。';
  return '你通常能在亲密与自主之间保持相对稳定，更看重坦诚、信任和双方都愿意修复关系。';
}

// ---- 大五细分面向 -----------------------------------------------------------

export interface TopFacet {
  code: string;
  name: string;
  dimLabel: string;
  score: number;
}

/** 得分最高的若干个 facet。快速版不带 facet 数据，这里自然返回空数组。 */
export function topFacets(spec: AssessmentSpec, result: AssessmentResult, limit = 6): TopFacet[] {
  const { facets } = result;
  const meta = spec.facetMeta;
  if (facets === undefined || meta === undefined) return [];
  return Object.entries(facets)
    .sort((a, b) => (a[1] !== b[1] ? b[1] - a[1] : a[0].localeCompare(b[0])))
    .slice(0, limit)
    .flatMap(([code, score]) => {
      const info = meta[code];
      if (info === undefined) return [];
      return [{ code, name: info.name, dimLabel: dimOf(spec, info.d)?.label ?? info.d, score }];
    });
}

// ---- 写入画像的文本 ---------------------------------------------------------

/**
 * 一个维度最多写入几个关键词。维度浮层手动保存本来就截前 5 个；测评结果也走同一
 * 上限，否则霍兰德六维并列时会写进 6 个词，比手填的还长。
 */
export const MAX_DIMENSION_KEYWORDS = 5;

/** 维度画像文本；`dimensionKeywords` 按同一分隔符还原。 */
export function joinKeywords(keywords: readonly string[]): string {
  return keywords.slice(0, MAX_DIMENSION_KEYWORDS).join(' · ');
}

/** 人格底色文本（对齐 iOS saveAssessment 的大五分支）。 */
export function personalityText(tags: readonly string[], mbti: string | null): string {
  const base = `大五：${tags.slice(0, 3).join(' · ')}`;
  return mbti !== null && mbti !== '' ? `${base} · MBTI：${mbti}` : base;
}
