// 婚姻卡牌 (marriage/relationship cards) seed data
// (source: prototype lines ~7403-7443: `RELATIONSHIP_CARDS`, `MARRIAGE_SCENARIOS`,
// `MARRIAGE_SEVERITY_META`).

import type { SeverityLevel, SeverityMeta } from './common';

export type RelationshipGroup = '安全' | '连接' | '自主' | '成长' | '现实' | '未来';

export interface RelationshipCard {
  id: string;
  name: string;
  glyph: string;
  group: RelationshipGroup;
  copy: string;
}

export const RELATIONSHIP_CARDS: RelationshipCard[] = [
  { id: 'trust', name: '彼此信任', glyph: '∞', group: '安全', copy: '不用反复证明，也相信对方不会轻易离开' },
  { id: 'response', name: '及时回应', glyph: '◉', group: '安全', copy: '重要时刻不失联，让需要被明确接住' },
  { id: 'stability', name: '稳定陪伴', glyph: '⌁', group: '安全', copy: '不只在热烈时靠近，也愿意长期在场' },
  { id: 'honesty', name: '坦诚沟通', glyph: '“”', group: '连接', copy: '不靠猜测维持关系，愿意把真实说出来' },
  { id: 'understand', name: '情绪被理解', glyph: '≈', group: '连接', copy: '先看见感受，再急着处理问题' },
  { id: 'intimacy', name: '亲密表达', glyph: '♡', group: '连接', copy: '愿意表达喜欢、依赖与身体上的靠近' },
  { id: 'space', name: '尊重边界', glyph: '◌', group: '自主', copy: '亲密不等于侵入，彼此仍有自己的空间' },
  { id: 'choice', name: '允许不同', glyph: '↔', group: '自主', copy: '可以有不同意见、节奏与人生选择' },
  { id: 'repair', name: '愿意修复', glyph: '↻', group: '成长', copy: '冲突后不冷处理，愿意回来重新连接' },
  { id: 'growth', name: '共同成长', glyph: '↗', group: '成长', copy: '互相支持成为更完整的自己' },
  { id: 'loyalty', name: '忠诚承诺', glyph: '◇', group: '安全', copy: '把彼此放进长期选择，不轻易越过共同约定' },
  { id: 'money', name: '经济共识', glyph: '◎', group: '现实', copy: '对收入、消费、储蓄和风险有可协商的共识' },
  { id: 'chores', name: '生活分工', glyph: '▦', group: '现实', copy: '家务与照顾责任不默认落在一个人身上' },
  { id: 'families', name: '家庭边界', glyph: '⌂', group: '现实', copy: '面对双方家庭时，伴侣关系有清晰的共同边界' },
  { id: 'children', name: '生育共识', glyph: '○', group: '未来', copy: '是否生育、如何养育，都能诚实讨论并共同决定' },
  { id: 'future', name: '共同目标', glyph: '✦', group: '未来', copy: '愿意把城市、事业与生活方式放进同一张未来地图' },
  { id: 'admiration', name: '彼此欣赏', glyph: '❋', group: '连接', copy: '熟悉以后仍能看见对方的光，而不只看见不足' },
  { id: 'selfhood', name: '保留自我', glyph: '△', group: '自主', copy: '进入婚姻后仍保有朋友、兴趣和独立的精神世界' },
];

export interface MarriageScenario {
  title: string;
  copy: string;
  theme: string;
  severity: SeverityLevel;
}

export const MARRIAGE_SCENARIOS: MarriageScenario[] = [
  { title: '重要约定临时落空', copy: '对方因为工作连续取消两次重要约定，并希望你再体谅一次。', theme: '承诺', severity: 1 },
  { title: '生活节奏越来越不同', copy: '一个人需要规律与计划，另一个人更习惯随性决定，日常摩擦开始增加。', theme: '生活', severity: 1 },
  { title: '争吵后需要长时间独处', copy: '每次冲突后，对方都需要几天才能重新沟通，而你更想当下把问题说开。', theme: '沟通', severity: 1 },
  { title: '收入差距逐渐扩大', copy: '一方的收入和资源快速增长，关系里的付出、话语权与消费方式开始失衡。', theme: '经济', severity: 2 },
  { title: '双方家庭频繁介入', copy: '父母不断参与住房、节日与生活安排，你们很难形成属于两个人的边界。', theme: '家庭', severity: 2 },
  { title: '长期异地成为常态', copy: '未来三年很难生活在同一座城市，见面、陪伴与个人发展需要重新排序。', theme: '距离', severity: 2 },
  { title: '事业机会只能支持一方', copy: '一份重要机会要求全家迁居，另一方也必须放下正在上升的事业路径。', theme: '选择', severity: 3 },
  { title: '生育决定出现分歧', copy: '对是否要孩子、什么时候要孩子，你们的答案开始走向不同方向。', theme: '未来', severity: 3 },
  { title: '照顾责任突然变重', copy: '双方父母都需要长期照顾，时间、金钱与情绪容量同时受到挤压。', theme: '责任', severity: 3 },
  { title: '信任出现明显裂缝', copy: '你发现对方长期隐瞒一件重要的事，解释并不足以立刻恢复安全感。', theme: '信任', severity: 4 },
  { title: '冲突变成持续回避', copy: '你们已经很久无法谈论真正的问题，表面平静，内心距离却越来越远。', theme: '修复', severity: 4 },
  { title: '婚姻进入重大低谷', copy: '长期压力让亲密、信任与共同目标同时动摇，你们必须决定如何继续。', theme: '关系', severity: 4 },
];

/** Severity copy, 1-indexed (index 0 is `null`). */
export const MARRIAGE_SEVERITY_META: (SeverityMeta | null)[] = [
  null,
  { name: '日常磨合', copy: '先从婚姻中常见但可协商的差异开始。' },
  { name: '持续拉扯', copy: '你选择接受，新的情境开始触及长期生活安排。' },
  { name: '重要分歧', copy: '连续接受让选择进入事业、家庭与未来规划。' },
  { name: '关系低谷', copy: '情境已经触及信任与婚姻能否继续的核心。' },
];
