// 六种测评（大五完整 / 大五快速 / 优势 / 恋爱 / 家庭 / 霍兰德）统一成同一个 spec 形状，
// 让答题页、结果页与卡片状态共用一套渲染逻辑。题库本身不在这里重复，全部引自 @/data。

import { BIG_FIVE_FACETS } from '@/data/bigFive';
import { DEMO_ASSESSMENTS, type AssessmentItem, type BigFiveFacetMeta, type DemoAssessment, type DemoAssessmentKind } from '@/data/demoAssessments';
import { HOLLAND_ITEMS, HOLLAND_META } from '@/data/holland';
import { HOLLAND_CODES, LIKERT_LABELS as HOLLAND_LIKERT } from '@/screens/me/hollandScoring';
import type { PortraitDimKey } from './portraitStore';

export type AssessmentKind = DemoAssessmentKind | 'bigfiveLite' | 'holland';

export const ASSESSMENT_KINDS: readonly AssessmentKind[] = ['bigfive', 'bigfiveLite', 'strength', 'love', 'family', 'holland'];

export interface AssessmentDimSpec {
  key: string;
  name: string;
  label: string;
  color: string;
  desc: string;
}

export interface AssessmentSpec {
  kind: AssessmentKind;
  title: string;
  sub: string;
  kicker: string;
  /** 可能含 `<br>`，渲染时按 `<br>` 拆行。 */
  introTitle: string;
  intro: string;
  notices: readonly string[];
  resultTitle: string;
  resultSub: string;
  saveLabel: string;
  /** 有序维度表；结果页按此顺序画条，同分排序也以此为准。 */
  dims: readonly AssessmentDimSpec[];
  items: readonly AssessmentItem[];
  likert: readonly string[];
  /** 霍兰德用原始总分，其余用 0–100 百分比。 */
  scoring: 'sum' | 'percent';
  /** 条形图分母：霍兰德 20，百分比制 100。 */
  scoreMax: number;
  storeKey: string;
  /** 结果写入的画像维度。 */
  target: PortraitDimKey;
  /** 仅大五完整版有；决定结果页是否渲染 30 个细分面向。 */
  facetMeta?: Record<string, BigFiveFacetMeta>;
}

const DEMO_LIKERT: readonly string[] = ['非常不符合', '比较不符合', '不确定', '比较符合', '非常符合'];

const DEMO_TARGET: Record<DemoAssessmentKind, PortraitDimKey> = {
  bigfive: 'personality',
  strength: 'skill',
  love: 'love',
  family: 'family',
};

const DEMO_STORE_KEY: Record<DemoAssessmentKind, string> = {
  // 大五完整版沿用 iOS 的 v2 键；其余对齐 iOS 的 _v1 命名，便于将来对数据。
  bigfive: 'kaleido_demo_assessment_bigfive_v2',
  strength: 'kaleido_demo_assessment_strength_v1',
  love: 'kaleido_demo_assessment_love_v1',
  family: 'kaleido_demo_assessment_family_v1',
};

export const BIGFIVE_LITE_STORE_KEY = 'kaleido_demo_assessment_bigfive_lite_v1';

/** `DemoAssessment.dims` 是 Record，靠插入顺序表达维度次序，这里转成显式有序表。 */
function toDims(dims: DemoAssessment['dims']): AssessmentDimSpec[] {
  return Object.entries(dims).map(([key, meta]) => ({ key, ...meta }));
}

function demoSpec(kind: DemoAssessmentKind): AssessmentSpec {
  const src = DEMO_ASSESSMENTS[kind];
  return {
    kind,
    title: src.title,
    sub: src.sub,
    kicker: src.kicker,
    introTitle: src.introTitle,
    intro: src.intro,
    notices: src.notices,
    resultTitle: src.resultTitle,
    resultSub: src.resultSub,
    saveLabel: src.saveLabel,
    dims: toDims(src.dims),
    items: src.items,
    likert: DEMO_LIKERT,
    scoring: 'percent',
    scoreMax: 100,
    storeKey: DEMO_STORE_KEY[kind],
    target: DEMO_TARGET[kind],
    // exactOptionalPropertyTypes 下不能显式赋 undefined，只在存在时带上这个键。
    ...(src.facetMeta !== undefined ? { facetMeta: src.facetMeta } : {}),
  };
}

/**
 * 大五快速版：每个 facet 取第 1 题，共 30 题、每维 6 题。
 * 刻意不带 `f` 字段 —— 1 题/facet 的分辨率只有 0/25/50/75/100 五档，
 * 算出来的细分面向分是假精度，所以引擎连算都不算。
 */
const BIGFIVE_LITE_ITEMS: readonly AssessmentItem[] = BIG_FIVE_FACETS.map((facet) => ({
  d: facet.d,
  t: facet.items[0][0],
  r: facet.items[0][1],
}));

function bigFiveLiteSpec(): AssessmentSpec {
  const full = DEMO_ASSESSMENTS.bigfive;
  return {
    kind: 'bigfiveLite',
    title: '大五人格 · 快速版',
    sub: '五个维度都是光谱，没有好坏',
    kicker: 'PERSONALITY PROFILE · QUICK',
    introTitle: full.introTitle,
    intro: '快速版从每个细分面向各取一题，用 30 题给出五个主要维度的概览。想看 30 个细分面向，可以在这一页切换到完整版。',
    notices: ['快速版共30题，通常需要4–6分钟', '只给五个主要维度的概览，不展开30个细分面向', '与完整版进度分开保存，随时可以切换'],
    resultTitle: full.resultTitle,
    resultSub: '大五人格 · 快速版',
    saveLabel: full.saveLabel,
    dims: toDims(full.dims),
    items: BIGFIVE_LITE_ITEMS,
    likert: DEMO_LIKERT,
    scoring: 'percent',
    scoreMax: 100,
    storeKey: BIGFIVE_LITE_STORE_KEY,
    target: 'personality',
  };
}

const HOLLAND_SPEC: AssessmentSpec = {
  kind: 'holland',
  title: '霍兰德兴趣测评',
  sub: '兴趣不是能力，也不是职业判决',
  kicker: 'O*NET MINI INTEREST PROFILER',
  introTitle: '哪些活动，<br>会让你自然地靠近？',
  intro: '接下来会出现30种活动。请只回答“喜欢不喜欢”，不要考虑自己现在会不会、薪资高不高或别人怎么看。',
  notices: [
    '这是霍兰德RIASEC模型的官方移动短版',
    '结果描述兴趣，不代表能力、资格或命定职业',
    '中文内容为产品验证中的翻译版本',
    '答案会保存在当前设备，可随时退出继续',
  ],
  resultTitle: '兴趣画像',
  resultSub: '正式量表来源 · O*NET Mini-IP',
  saveLabel: '将这组兴趣信号保存到我的画像',
  dims: HOLLAND_CODES.map((code) => ({ key: code, ...HOLLAND_META[code] })),
  items: HOLLAND_ITEMS.map(([code, text]) => ({ d: code, t: text })),
  likert: HOLLAND_LIKERT,
  scoring: 'sum',
  scoreMax: 20,
  storeKey: 'kaleido_assessment_holland_v1',
  target: 'like',
};

const SPECS: Record<AssessmentKind, AssessmentSpec> = {
  bigfive: demoSpec('bigfive'),
  bigfiveLite: bigFiveLiteSpec(),
  strength: demoSpec('strength'),
  love: demoSpec('love'),
  family: demoSpec('family'),
  holland: HOLLAND_SPEC,
};

export function assessmentSpec(kind: AssessmentKind): AssessmentSpec {
  return SPECS[kind];
}

/** 两个版本的大五共用一个入口，答题页上可以互相切换。 */
export function isBigFive(kind: AssessmentKind): boolean {
  return kind === 'bigfive' || kind === 'bigfiveLite';
}
