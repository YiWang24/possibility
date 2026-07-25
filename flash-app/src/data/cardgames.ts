// Normalized card-deck adapter for the simplified 卡牌探索 hub → deck flow.
//
// Raw seed data lives in dedicated modules and is REUSED here (not re-ported):
//   @/data/relationship → RELATIONSHIP_CARDS, MARRIAGE_SCENARIOS, MARRIAGE_SEVERITY_META
//   @/data/valueGames   → VALUE_CARD_GAMES (family / social)
//   @/data/life         → LIFE_BASE_CARDS, LIFE_STAGES, LIFE_SEVERITY_META, lifeEventSeverity
//
// This module only adds the two summary-copy maps that aren't exported elsewhere
// (marriage relationshipResultCopy ~7742, life groupCopy ~7233) plus a single
// `CardDeck` shape the DeckView / DeckScenarios components render from.

import type { SeverityMeta } from './common';
import { MARRIAGE_SCENARIOS, MARRIAGE_SEVERITY_META, RELATIONSHIP_CARDS } from './relationship';
import { VALUE_CARD_GAMES, type ValueGameKind } from './valueGames';
import { LIFE_BASE_CARDS, LIFE_SEVERITY_META, LIFE_STAGES, lifeEventSeverity } from './life';

/** A base "底牌" the player can keep. `copy` only present on the marriage deck. */
export interface DeckCard {
  id: string;
  name: string;
  glyph: string;
  group: string;
  copy?: string;
}

/** A pressure scenario faced during the game. */
export interface DeckScenario {
  title: string;
  copy: string;
  theme: string;
  severity: 1 | 2 | 3 | 4;
}

/** Marriage summary copy keyed by the dominant card group (source: relationshipResultCopy ~7742). */
export const MARRIAGE_GROUP_COPY: Record<string, string> = {
  安全: '你最先确认的，是这段关系是否可靠、持续、能够接住彼此。',
  连接: '对你来说，被理解和真实靠近比表面上的和平更重要。',
  自主: '你需要的是不以失去自己为代价的亲密，尊重会让你更愿意靠近。',
  成长: '你看重关系面对问题后的变化能力，而不只是一开始是否合拍。',
  现实: '你关注婚姻能否真正承载生活，责任与边界需要被具体协商。',
  未来: '你在意的不只是当下相爱，也在意两个人能否走向同一个未来。',
};

/** Life-deck summary copy keyed by the dominant card group (source: prototype ~7233). */
export const LIFE_GROUP_COPY: Record<string, string> = {
  关系: '重要关系与稳定的情感连接',
  内在力量: '依靠自己重新站起来的能力',
  能力行动: '理解问题并把事情做成的能力',
  价值原则: '即使困难也不愿违背的原则',
  现实支点: '健康与照顾生活的现实能力',
  外部认可: '被看见、被欣赏与获得机会',
};

// ————————————————————————————— Normalized deck view —————————————————————————————

export type DeckKind = 'life' | 'marriage' | ValueGameKind;

export interface DeckRule {
  no: string;
  title: string;
  desc: string;
}

/** A single normalized descriptor the simplified hub → deck UI renders from. */
export interface CardDeck {
  kind: DeckKind;
  eyebrow: string;
  topTitle: string;
  topSub: string;
  dimensionTitle: string;
  introQuestionHTML: string;
  introCopy: string;
  rules: DeckRule[];
  contentWarning?: string;
  glyph: string;
  startLabel: string;
  cards: DeckCard[];
  scenarios: DeckScenario[];
  severity: (SeverityMeta | null)[];
  groupCopy: Record<string, string>;
  resultCap: string;
}

const LIFE_DECK: CardDeck = {
  kind: 'life',
  eyebrow: 'LIFE CARDS',
  topTitle: '人生卡牌',
  topSub: '一次关于取舍的模拟',
  dimensionTitle: '人生',
  introQuestionHTML: '当人生不断要求交换<br>你最后会留下什么？',
  introCopy: '从 18 张人生底牌中选出 9 张，持续经历命运事件。接受会保留底牌，但下一轮事件会加重；拒绝则固定交换 2 张，直到自然只剩 3 张。',
  rules: [
    { no: '01', title: '选择 9 张人生底牌', desc: '它们是你希望带着走完一生的能力、关系与信念。' },
    { no: '02', title: '接受后，命运继续加码', desc: '连续接受会让下一轮事件从普通、加压一路升级到极限抉择。' },
    { no: '03', title: '拒绝一次，固定交换两张', desc: '每次拒绝都放下两张；不额外补选，直到手中自然只剩三张。' },
  ],
  contentWarning: '内容提示：游戏包含疾病、家庭冲突、暴力与死亡等敏感情境。它不是心理诊断，结果默认仅自己可见。',
  glyph: '✦',
  startLabel: '开始这一生',
  cards: LIFE_BASE_CARDS,
  scenarios: LIFE_STAGES.flatMap((stage) =>
    stage.cards.map(([title, desc, category]) => ({ title, copy: desc, theme: category, severity: lifeEventSeverity([title, desc, category]) })),
  ),
  severity: LIFE_SEVERITY_META,
  groupCopy: LIFE_GROUP_COPY,
  resultCap: 'LIFE SIGNAL · 可写入画像',
};

const MARRIAGE_DECK: CardDeck = {
  kind: 'marriage',
  eyebrow: 'MARRIAGE CARDS',
  topTitle: '婚姻卡牌',
  topSub: '在多轮取舍中看见最关心的事',
  dimensionTitle: '婚姻关系',
  introQuestionHTML: '当婚姻不断要求取舍<br>你最后会守住什么？',
  introCopy: '先选出 9 张婚姻底牌，再持续面对婚姻情境。接受会保留底牌，但下一轮压力会加重；不接受则交换 2 张，直到自然剩下最关心的 3 点。',
  rules: [
    { no: '01', title: '选择 9 张婚姻底牌', desc: '从安全、连接、自主、现实与未来中凭直觉选择。' },
    { no: '02', title: '接受后，情境继续加码', desc: '连续接受会从日常磨合逐渐进入关系低谷。' },
    { no: '03', title: '不接受，就交换 2 张', desc: '每次固定放下两张，直到自然留下最重要的三张。' },
  ],
  glyph: '♡',
  startLabel: '开始婚姻取舍',
  cards: RELATIONSHIP_CARDS,
  scenarios: MARRIAGE_SCENARIOS,
  severity: MARRIAGE_SEVERITY_META,
  groupCopy: MARRIAGE_GROUP_COPY,
  resultCap: 'MARRIAGE SIGNAL · 可写入画像',
};

function valueDeck(kind: ValueGameKind): CardDeck {
  const cfg = VALUE_CARD_GAMES[kind];
  return {
    kind,
    eyebrow: kind === 'family' ? 'FAMILY CARDS' : 'CONNECTION CARDS',
    topTitle: cfg.title,
    topSub: '在多轮取舍中看见最关心的事',
    dimensionTitle: cfg.dimensionTitle,
    introQuestionHTML: cfg.introQuestion,
    introCopy: cfg.introCopy,
    rules: [
      { no: '01', title: `选择 9 张${cfg.dimensionTitle}底牌`, desc: '凭直觉选出此刻真正关心的关系优先级。' },
      { no: '02', title: '接受后，情境继续加码', desc: '连续接受会让下一轮情境的压力持续升级。' },
      { no: '03', title: '不接受，就交换 2 张', desc: '每次固定放下两张，直到自然留下最关心的三张。' },
    ],
    glyph: cfg.glyph,
    startLabel: `开始${cfg.dimensionTitle}取舍`,
    cards: cfg.cards,
    scenarios: cfg.scenarios,
    severity: cfg.severity,
    groupCopy: cfg.groupCopy,
    resultCap: `${kind === 'family' ? 'FAMILY' : 'SOCIAL'} SIGNAL · 可写入画像`,
  };
}

const DECKS: Record<DeckKind, CardDeck> = {
  life: LIFE_DECK,
  marriage: MARRIAGE_DECK,
  family: valueDeck('family'),
  social: valueDeck('social'),
};

export function getCardDeck(kind: DeckKind): CardDeck {
  return DECKS[kind];
}

/** Dominant card group among a set of kept cards → its summary copy. */
export function dominantGroup(cards: DeckCard[]): string {
  const counts = new Map<string, number>();
  cards.forEach((card) => {
    counts.set(card.group, (counts.get(card.group) ?? 0) + 1);
  });
  let top = cards[0]?.group ?? '';
  let best = -1;
  counts.forEach((count, group) => {
    if (count > best) {
      best = count;
      top = group;
    }
  });
  return top;
}
