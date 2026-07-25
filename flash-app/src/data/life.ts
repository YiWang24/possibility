// 人生卡牌 (life cards) seed data
// (source: prototype lines ~2937-3029: `LIFE_BASE_CARDS`, `LIFE_STAGES`, `LIFE_ROUNDS`,
// `LIFE_SEVERITY_META`, `lifeEventSeverity`).

import type { SeverityLevel, SeverityMeta } from './common';

export type LifeCardGroup = '关系' | '内在力量' | '价值原则' | '能力行动' | '现实支点' | '外部认可';

/** A base "底牌" the player picks before the game. */
export interface LifeBaseCard {
  id: string;
  name: string;
  glyph: string;
  group: LifeCardGroup;
}

export const LIFE_BASE_CARDS: LifeBaseCard[] = [
  { id: 'family', name: '亲情', glyph: '⌂', group: '关系' },
  { id: 'friend', name: '知心挚友', glyph: '☍', group: '关系' },
  { id: 'lover', name: '相濡以沫的恋人', glyph: '♡', group: '关系' },
  { id: 'confidence', name: '信心', glyph: '↗', group: '内在力量' },
  { id: 'kindness', name: '善良', glyph: '♧', group: '价值原则' },
  { id: 'talent', name: '才华', glyph: '✦', group: '能力行动' },
  { id: 'iq', name: '智商', glyph: '◇', group: '能力行动' },
  { id: 'trust', name: '信任', glyph: '∞', group: '关系' },
  { id: 'forgive', name: '原谅的勇气', glyph: '◌', group: '价值原则' },
  { id: 'provide', name: '养家的能力', glyph: '▣', group: '现实支点' },
  { id: 'strong', name: '坚强', glyph: '▲', group: '内在力量' },
  { id: 'loveAbility', name: '爱人的能力', glyph: '♥', group: '关系' },
  { id: 'justice', name: '正义感', glyph: '⚖', group: '价值原则' },
  { id: 'looks', name: '颜值', glyph: '✧', group: '外部认可' },
  { id: 'mentor', name: '伯乐', glyph: '◎', group: '外部认可' },
  { id: 'eq', name: '情商', glyph: '≈', group: '能力行动' },
  { id: 'health', name: '健康', glyph: '＋', group: '现实支点' },
  { id: 'pet', name: '爱宠', glyph: '♢', group: '关系' },
];

/** A life-event card: `[title, description, category]`. */
export type LifeEventCard = [title: string, desc: string, category: string];

export interface LifeStage {
  age: string;
  name: string;
  cards: LifeEventCard[];
}

export const LIFE_STAGES: LifeStage[] = [
  {
    age: '0–10 岁',
    name: '懵懂初生',
    cards: [
      ['家庭经济破产', '原本安稳的家庭突然失去经济来源。', '家庭安全'],
      ['父母经常吵架', '家里长期充满争吵与紧张。', '家庭安全'],
      ['成绩长期倒数', '无论怎样努力，成绩总在最后。', '自我评价'],
      ['经常被父母贬低', '重要的家人很少肯定你。', '自我评价'],
      ['爱宠离世', '陪伴你的宠物离开了。', '失去陪伴'],
      ['被同学欺负', '成长中长期遭到同龄人欺负。', '社会关系'],
      ['先天身体缺陷', '出生时便需要面对身体限制。', '健康'],
      ['被拐卖', '你被迫离开熟悉的家庭与环境。', '家庭安全'],
    ],
  },
  {
    age: '11–20 岁',
    name: '追风青春',
    cards: [
      ['被孤立', '你被排除在同龄人的圈子之外。', '社会关系'],
      ['考不上大学', '你没能进入期待的大学。', '成就'],
      ['家人病重', '重要的家人在此时患上重病。', '家庭安全'],
      ['作弊被抓', '一次错误选择让你失去他人的信任。', '社会评价'],
      ['犯罪入狱', '一次严重错误改变了人生轨迹。', '自由'],
      ['至亲离世', '你不得不提前面对重要亲人的离开。', '失去陪伴'],
      ['在校被造谣', '关于你的恶意传言在校园扩散。', '社会评价'],
      ['遭遇校园霸凌', '你长期遭受来自同龄人的伤害。', '社会关系'],
    ],
  },
  {
    age: '21–30 岁',
    name: '扎根生长',
    cards: [
      ['恋人背叛', '最亲密的人违背了彼此的承诺。', '亲密关系'],
      ['容貌变差', '外貌发生了让你难以接受的改变。', '自我评价'],
      ['十年没有工作', '长期无法获得稳定的工作机会。', '成就'],
      ['一直没有伴侣', '很长时间都没有建立亲密关系。', '亲密关系'],
      ['遭遇车祸', '一次事故改变了原有的生活节奏。', '健康'],
      ['长期住地下室', '你只能长期住在逼仄的空间里。', '现实安全'],
      ['挣不到钱', '付出很多，却始终无法获得足够收入。', '现实安全'],
      ['进入糟糕的婚姻', '婚姻没有成为想象中的支持。', '亲密关系'],
    ],
  },
  {
    age: '31–40 岁',
    name: '承责前行',
    cards: [
      ['遭遇网暴', '大量陌生人持续攻击和否定你。', '社会评价'],
      ['无家可归', '你失去了稳定居住的地方。', '现实安全'],
      ['疾病缠身', '身体状况长期影响你的生活。', '健康'],
      ['身无分文', '你失去了几乎全部经济积累。', '现实安全'],
      ['被裁员', '你突然失去了赖以稳定的工作。', '成就'],
      ['妻离子散', '原本的家庭关系彻底破裂。', '家庭安全'],
      ['家产被骗', '多年积累因欺骗而失去。', '信任'],
      ['职场霸凌', '工作中长期遭到打压和排挤。', '社会关系'],
      ['自杀未遂', '你经历了一段极端痛苦的低谷。', '生命意义'],
      ['遭遇家暴', '最亲近的关系带来了持续伤害。', '亲密关系'],
    ],
  },
  {
    age: '迟暮之年',
    name: '从容沉淀',
    cards: [
      ['患阿尔茨海默病', '记忆和熟悉的人事物逐渐离你而去。', '健康'],
      ['子女啃老', '子女长期依赖你的积蓄生活。', '家庭责任'],
      ['孤身一人', '晚年身边没有亲近的人陪伴。', '失去陪伴'],
      ['成为植物人', '你失去了自主表达和行动的能力。', '自主性'],
      ['长期住院', '余下的生活大部分在医院度过。', '健康'],
      ['子女不管', '需要照顾时，子女没有陪在身边。', '家庭关系'],
      ['白发人送黑发人', '你要面对晚辈先于自己离开。', '失去陪伴'],
      ['晚年拾荒', '你需要靠拾荒维持生活。', '现实安全'],
    ],
  },
];

export interface LifeRound {
  age: string;
  name: string;
  cards: LifeEventCard[];
}

const stageCards = (index: number): LifeEventCard[] => LIFE_STAGES[index]?.cards ?? [];

/** Rounds combine stages (source: `LIFE_ROUNDS` derived from `LIFE_STAGES`). */
export const LIFE_ROUNDS: LifeRound[] = [
  { age: '0–20 岁', name: '成长之初', cards: [...stageCards(0), ...stageCards(1)] },
  { age: '21–40 岁', name: '扎根承担', cards: [...stageCards(2), ...stageCards(3)] },
  { age: '人生后半程', name: '回望余生', cards: [...stageCards(4)] },
];

/** Severity copy, 1-indexed (index 0 is `null`). */
export const LIFE_SEVERITY_META: (SeverityMeta | null)[] = [
  null,
  { name: '普通波动', copy: '命运先从日常的不确定开始试探。' },
  { name: '持续加压', copy: '你选择接住上一轮，新的处境变得更棘手。' },
  { name: '重大冲击', copy: '连续接受正在把人生推向更难回避的转折。' },
  { name: '极限抉择', copy: '命运已经加码到极限，接下来仍由你决定接受或交换。' },
];

/** Classify a life-event card into a severity level (source: `lifeEventSeverity`). */
export function lifeEventSeverity(card: LifeEventCard): SeverityLevel {
  const title = card[0];
  if (/被拐卖|犯罪入狱|自杀未遂|遭遇家暴|阿尔茨海默|植物人|白发人送黑发人/.test(title)) return 4;
  if (/破产|病重|至亲离世|先天身体缺陷|车祸|无家可归|疾病缠身|身无分文|妻离子散|长期住院|晚年拾荒/.test(title)) return 3;
  if (/爱宠离世|被同学欺负|校园霸凌|恋人背叛|十年没有工作|地下室|糟糕的婚姻|网暴|家产被骗|职场霸凌|孤身一人|子女不管/.test(title)) return 2;
  return 1;
}
