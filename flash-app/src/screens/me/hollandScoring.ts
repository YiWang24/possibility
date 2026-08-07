// Holland RIASEC scoring + narrative (source: prototype ~6412
// `completeHollandAssessment`, ~6431 `hollandNarrative`). Likert values 0–4 are
// summed per code; ties are grouped like the prototype's display code.

import { HOLLAND_ITEMS, type HollandCode } from '@/data/holland';

export const HOLLAND_CODES: readonly HollandCode[] = ['R', 'I', 'A', 'S', 'E', 'C'];

export const LIKERT_LABELS: readonly string[] = ['非常不喜欢', '不喜欢', '不确定', '喜欢', '非常喜欢'];

export interface HollandResult {
  scores: Record<HollandCode, number>;
  ordered: HollandCode[];
  selected: HollandCode[];
  code: string;
  displayCode: string;
}

export function computeHollandResult(answers: readonly (number | null)[]): HollandResult {
  const scores: Record<HollandCode, number> = { R: 0, I: 0, A: 0, S: 0, E: 0, C: 0 };
  HOLLAND_ITEMS.forEach((item, i) => {
    scores[item[0]] += answers[i] ?? 0;
  });
  const ordered = [...HOLLAND_CODES].sort((a, b) => scores[b] - scores[a]);
  const scoreLevels = [...new Set(ordered.map((k) => scores[k]))];
  const selected: HollandCode[] = [];
  const displayGroups: string[] = [];
  for (const level of scoreLevels) {
    const group = ordered.filter((k) => scores[k] === level);
    selected.push(...group);
    displayGroups.push(group.join('/'));
    if (selected.length >= 3) break;
  }
  return {
    scores,
    ordered,
    selected,
    code: ordered.slice(0, 3).join(''),
    displayCode: displayGroups.join('-'),
  };
}

/** 双字母兴趣组合叙事。叙事文案由 `assessmentEngine` 消费，那里能同时拿到六型元数据。 */
export const HOLLAND_PAIR_NARRATIVE: Record<string, string> = {
  RI: '你喜欢先弄清原理，再把想法变成可以工作的东西。',
  RA: '你在材料、技术和表达之间寻找创造的实感。',
  IA: '你容易在分析与想象之间建立新的解释。',
  IS: '你希望理解复杂问题，也希望这些理解能真正帮助到人。',
  AS: '表达和连接对你同样重要，你更愿意让创作抵达别人。',
  AE: '你不只喜欢产生想法，也容易被传播和推动它们吸引。',
  SE: '你更享受与人协作，并把共同目标向前推动。',
  SC: '你愿意用稳定、可靠的方式支持人的需要。',
  EC: '目标、资源和流程的组织容易激发你的投入感。',
  IC: '你擅长被复杂信息吸引，并愿意把它整理成可靠结构。',
};
