// 人生实验室 (life lab) simulation seed data + pure helpers.
// Scenario copy is defined inline in the prototype's #resultPage HTML
// (万花筒-认识自己-原型.html lines ~2222-2300). Choice-type detection mirrors
// `detectLabChoiceType` (~4098); load steps mirror `getLoadSteps` (~4555).

import type { CarryCardKey, LabChoiceDeckKey } from './lab';

/** Which推演 scenario tab is shown first / addressed by a segmented control. */
export type ScenarioKey = 'best' | 'likely' | 'worst';

/** A single `[label, value]` dimension row in a scenario summary card. */
export type ScenarioDim = readonly [label: string, value: string];

/** A titled list (可能获得 / 需要满足的条件 / …) inside a scenario panel. */
export interface ScenarioList {
  title: string;
  /** CSS value used as the leading dot color, e.g. `var(--teal)`. */
  accent: string;
  items: string[];
}

/** One of the three推演 outcomes (best / likely / worst). */
export interface Scenario {
  key: ScenarioKey;
  /** Segmented-control label. */
  tab: string;
  /** Eyebrow inside the summary card, e.g. `BEST · 顺光面`. */
  eyebrow: string;
  /** Eyebrow / accent text color. */
  eyebrowColor: string;
  /** Verbatim inline `background` for the summary card. */
  sumBackground: string;
  /** Verbatim inline `border` for the summary card. */
  sumBorder: string;
  headline: string;
  dims: ScenarioDim[];
  lists: [ScenarioList, ScenarioList];
  /** 一般情况 only — text before the bold clause of the 最关键的条件 callout. */
  keyLead?: string;
  /** 一般情况 only — the bold clause of the 最关键的条件 callout. */
  keyBold?: string;
  /** 最坏 only — render the bottom-line stress test block. */
  floorTest?: boolean;
}

/** best / likely / worst, in segmented-control order (indices 0 / 1 / 2). */
export const SCENARIOS: Scenario[] = [
  {
    key: 'best',
    tab: '最好的结果',
    eyebrow: 'BEST · 顺光面',
    eyebrowColor: '#F06ACD',
    sumBackground: 'radial-gradient(280px 180px at 85% -20%,rgba(240,106,205,.4),transparent 60%),linear-gradient(150deg,#2C1533 0%,#1A1226 100%)',
    sumBorder: '1px solid rgba(240,106,205,.35)',
    headline: '你顺利转型为优秀的 AI 产品经理，在行业中建立起个人的影响力。',
    dims: [
      ['职业状态', '负责核心产品方向，影响重要决策'],
      ['收入趋势', '显著提升，进入行业中上水平'],
      ['生活节奏', '更忙，但成就感和掌控感强'],
      ['内心感受', '笃定、自信，对未来更有掌控感'],
    ],
    lists: [
      { title: '可能获得', accent: 'var(--teal)', items: ['快速的职业成长', '更高的收入和回报', '更广的行业资源和人脉'] },
      { title: '需要满足的条件', accent: 'var(--apricot)', items: ['持续学习和深度投入', '获得关键项目和机会', '敢于承担错误和责任'] },
    ],
  },
  {
    key: 'likely',
    tab: '一般情况',
    eyebrow: 'LIKELY · 大概率',
    eyebrowColor: '#6FA5FF',
    sumBackground: 'radial-gradient(280px 180px at 85% -20%,rgba(111,165,255,.45),transparent 60%),linear-gradient(150deg,#152048 0%,#11142B 100%)',
    sumBorder: '1px solid rgba(111,165,255,.35)',
    headline: '你可能成为有设计背景的 AI 产品经理，开始独立负责项目。',
    dims: [
      ['职业状态', '完成转型，独立负责项目'],
      ['收入趋势', '前期持平，后期有增长'],
      ['生活节奏', '学习和工作时间明显增加'],
      ['内心感受', '成长感增强，压力也更大'],
    ],
    lists: [
      { title: '可能获得', accent: 'var(--teal)', items: ['更大的产品决策权', 'AI 行业的一手经验', '设计与产品的复合优势'] },
      { title: '可能付出的代价', accent: 'var(--pink)', items: ['短期收入和稳定性波动', '私人时间减少', '需要重建专业话语权'] },
    ],
    keyLead: '最关键的条件：',
    keyBold: '能在第一年获得至少一个真实的 AI 项目经历。',
  },
  {
    key: 'worst',
    tab: '最坏的结果',
    eyebrow: 'WORST · 背光面',
    eyebrowColor: '#FF8A5E',
    sumBackground: 'radial-gradient(280px 180px at 85% -20%,rgba(255,122,77,.4),transparent 60%),linear-gradient(150deg,#33160E 0%,#1C0F0C 100%)',
    sumBorder: '1px solid rgba(255,122,77,.35)',
    headline: '转型过程困难，方向反复，最终回到原岗位，信心受挫。',
    dims: [
      ['职业状态', '转型未达预期，回到设计岗位'],
      ['收入趋势', '短期收入下降，恢复缓慢'],
      ['生活节奏', '焦虑、反复尝试，精力消耗大'],
      ['内心感受', '失落、自我怀疑，动力下降'],
    ],
    lists: [
      { title: '可能的风险', accent: 'var(--pink)', items: ['缺乏真实项目经验', '学习碎片化，难以落地', '对产品工作兴趣不足'] },
      { title: '但仍会留下的价值', accent: 'var(--violet-soft)', items: ['拓宽了认知边界', '积累了跨领域经验', '更清楚自己真正想要的'] },
    ],
    floorTest: true,
  },
];

/** Index of a scenario in `SCENARIOS` (defaults to 一般情况 / index 1). */
export function scenarioIndex(key: ScenarioKey): number {
  const i = SCENARIOS.findIndex((s) => s.key === key);
  return i < 0 ? 1 : i;
}

/**
 * Pick the choice deck that fits a question. Mirrors `detectLabChoiceType`:
 * an explicit topic hint wins, otherwise keywords are matched.
 */
export function detectLabChoiceType(question: string, topicHint = ''): LabChoiceDeckKey {
  if (topicHint === '情感') return 'relationship';
  if (topicHint === '家庭') return 'family';
  if (topicHint === '升学') return 'study';
  if (topicHint === '职业') return 'career';
  if (/父母|家人|家庭|亲子|兄弟|姐妹/.test(question)) return 'family';
  if (/感情|恋爱|伴侣|分手|婚姻|对象|爱情|复合/.test(question)) return 'relationship';
  if (/升学|考研|留学|学校|专业|读研|博士|学习|考试/.test(question)) return 'study';
  if (/工作|职业|转岗|离职|跳槽|创业|公司|岗位|产品|设计师|offer/i.test(question)) return 'career';
  return 'general';
}

/** Display metadata for a carry (底线) deck card — short label + evidence source. */
export interface CarryDeckItem {
  key: CarryCardKey;
  /** Short label on the deck card (differs from CARRY_META's longer name). */
  name: string;
  /** Evidence-source subtitle (对话线索 / 日记线索 / …). */
  clue: string;
}

/** The six carry deck cards, in prototype order (HTML lines ~2093-2098). */
export const CARRY_DECK: CarryDeckItem[] = [
  { key: 'income', name: '稳定收入', clue: '对话线索' },
  { key: 'health', name: '身体不透支', clue: '日记线索' },
  { key: 'relation', name: '重要关系', clue: '关系画像' },
  { key: 'craft', name: '专业积累', clue: '职业画像' },
  { key: 'creation', name: '创造实感', clue: '动态画像' },
  { key: 'exit', name: '保留退路', clue: '处境扫描' },
];

/** A user-authored choice card. */
export interface CustomChoice {
  id: string;
  name: string;
  desc: string;
}

/** The loading-overlay copy for one推演, adapting to how many carry cards are in play. */
export function labLoadSteps(carryCount: number): string[] {
  return carryCount > 0
    ? ['读取你的动态画像与对话……', `装入 ${String(carryCount)} 张不愿交换的底线卡……`, '用最坏结果逐张检验……']
    : ['读取你的动态画像与对话……', '沿着这条选择生成未来情境……', '比对相似旅人的真实经历……'];
}

/** Snapshot of the last推演 run, shared from the Lab tab to the result page. */
export interface LabRun {
  question: string;
  pick: string;
  year: number;
  carry: CarryCardKey[];
}

// Module-level singleton: the appStore contract is fixed (its PushPayload only
// carries `scenario`), so Lab hands the result page the rest of the run here.
const labRun: LabRun = {
  question: '我是否要从交互设计师转为产品经理？',
  pick: '转 AI 产品',
  year: 5,
  carry: [],
};

/** Record the run that a result page is about to show. */
export function setLabRun(next: LabRun): void {
  labRun.question = next.question;
  labRun.pick = next.pick;
  labRun.year = next.year;
  labRun.carry = [...next.carry];
}

/**
 * Outcomes for the current run, generated per run and read by the result page.
 *
 * Held alongside labRun for the same reason: the appStore's PushPayload contract is
 * fixed and only carries `scenario`. Null means the model was unavailable or gave
 * nothing usable, and the result page falls back to SCENARIOS.
 */
let labScenarios: Scenario[] | null = null;

export function setLabScenarios(next: Scenario[] | null): void {
  labScenarios = next;
}

export function getLabScenarios(): Scenario[] {
  return labScenarios ?? SCENARIOS;
}

/** True when the outcomes on screen were generated for this run, not seeded copy. */
export function hasGeneratedScenarios(): boolean {
  return labScenarios !== null;
}

/** Read a copy of the most recent推演 run. */
export function getLabRun(): LabRun {
  return { question: labRun.question, pick: labRun.pick, year: labRun.year, carry: [...labRun.carry] };
}
