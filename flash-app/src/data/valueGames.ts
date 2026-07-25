// 家庭 / 人际 价值卡牌游戏 (value card games) seed data
// (source: prototype line ~7794, `VALUE_CARD_GAMES`).

import type { SeverityLevel, SeverityMeta } from './common';

export interface ValueCard {
  id: string;
  name: string;
  glyph: string;
  group: string;
}

export interface ValueScenario {
  title: string;
  copy: string;
  theme: string;
  severity: SeverityLevel;
}

export interface ValueCardGame {
  title: string;
  dimensionTitle: string;
  introQuestion: string;
  introCopy: string;
  question: string;
  themeClass: string;
  glyph: string;
  /** DOM selector for the profile dimension target. */
  target: string;
  /** DOM selector for the profile dimension entry button. */
  button: string;
  dimensionKey: string;
  storageKey: string;
  cards: ValueCard[];
  scenarios: ValueScenario[];
  /** Severity copy, 1-indexed (index 0 is `null`). */
  severity: (SeverityMeta | null)[];
  /** Result copy keyed by the dominant card group. */
  groupCopy: Record<string, string>;
}

export type ValueGameKind = 'family' | 'social';

export const VALUE_CARD_GAMES: Record<ValueGameKind, ValueCardGame> = {
  family: {
    title: '家庭卡牌',
    dimensionTitle: '家庭关系',
    introQuestion: '当家庭不断要求取舍<br>你最后会守住什么？',
    introCopy: '先选出 9 张家庭底牌，再持续面对家庭情境。接受会保留底牌并提高下一轮压力；不接受则交换 2 张，直到自然剩下最关心的 3 点。',
    question: '在家庭关系中，你最想守住什么？',
    themeClass: 'family-theme',
    glyph: '⌂',
    target: '#dimFamily',
    button: '#dimBtnFamily',
    dimensionKey: 'family',
    storageKey: 'kaleido_family_cards_v1',
    cards: [
      { id: 'health', name: '健康平安', glyph: '＋', group: '安全' },
      { id: 'respect', name: '互相尊重', glyph: '◇', group: '边界' },
      { id: 'support', name: '有事一起承担', glyph: '∞', group: '支持' },
      { id: 'talk', name: '坦诚沟通', glyph: '“”', group: '沟通' },
      { id: 'understand', name: '被理解', glyph: '≈', group: '沟通' },
      { id: 'boundary', name: '清晰边界', glyph: '◌', group: '边界' },
      { id: 'choice', name: '允许不同选择', glyph: '↔', group: '自主' },
      { id: 'presence', name: '重要时刻在场', glyph: '◉', group: '支持' },
      { id: 'money', name: '经济安全', glyph: '◎', group: '安全' },
      { id: 'fairness', name: '公平分工', glyph: '▦', group: '责任' },
      { id: 'partner', name: '尊重彼此伴侣', glyph: '♡', group: '边界' },
      { id: 'elders', name: '照顾长辈', glyph: '⌂', group: '责任' },
      { id: 'contact', name: '保持联系', glyph: '⌁', group: '支持' },
      { id: 'vulnerable', name: '能表达脆弱', glyph: '▽', group: '沟通' },
      { id: 'noGuilt', name: '不用愧疚控制', glyph: '△', group: '自主' },
      { id: 'promise', name: '说到做到', glyph: '✓', group: '责任' },
      { id: 'harmony', name: '家庭和睦', glyph: '❋', group: '安全' },
      { id: 'self', name: '保留自我', glyph: '✦', group: '自主' },
    ],
    scenarios: [
      { title: '节日安排出现分歧', copy: '双方都希望你按自己的方式过节，你需要在陪伴与个人安排之间协调。', theme: '相处', severity: 1 },
      { title: '家人联系频率不同', copy: '有人希望每天联系，有人更习惯各自生活，彼此开始误读这种距离。', theme: '联系', severity: 1 },
      { title: '个人决定被频繁追问', copy: '家人出于关心不断询问你的工作、伴侣与生活计划。', theme: '边界', severity: 1 },
      { title: '家庭付出开始失衡', copy: '同一个人长期承担更多家务、情绪安抚与联络责任，却很少被看见。', theme: '分工', severity: 2 },
      { title: '亲属提出经济请求', copy: '一笔不小的家庭支出需要你支持，但它会明显影响自己的生活计划。', theme: '经济', severity: 2 },
      { title: '伴侣与父母意见冲突', copy: '最亲近的两方都希望你明确站在自己这边，关系边界变得紧张。', theme: '边界', severity: 2 },
      { title: '照顾责任突然加重', copy: '一位家人需要长期照料，时间、金钱与个人发展同时被挤压。', theme: '责任', severity: 3 },
      { title: '重要人生选择不被认可', copy: '你的城市、职业或伴侣选择遭到家人持续反对。', theme: '自主', severity: 3 },
      { title: '家庭经济进入低谷', copy: '收入骤减与持续支出让每个人都必须重新分配资源和责任。', theme: '安全', severity: 3 },
      { title: '家人长期用愧疚施压', copy: '爱与责任被反复用来要求服从，你很难在拒绝后保持平静。', theme: '控制', severity: 4 },
      { title: '重大疾病改变家庭结构', copy: '一场长期疾病让照顾、收入与未来安排都需要彻底重组。', theme: '危机', severity: 4 },
      { title: '家庭关系面临破裂', copy: '多年的冲突累积到临界点，有人考虑彻底停止往来。', theme: '修复', severity: 4 },
    ],
    severity: [
      null,
      { name: '日常磨合', copy: '先从家庭里常见的节奏与边界差异开始。' },
      { name: '持续拉扯', copy: '新的情境开始触及分工、经济与伴侣边界。' },
      { name: '重大责任', copy: '连续接受让选择进入照顾、发展与家庭安全。' },
      { name: '家庭危机', copy: '情境已经触及控制、疾病与关系能否继续。' },
    ],
    groupCopy: {
      安全: '你最先确认的，是家庭能否提供稳定、健康与不轻易崩塌的生活基础。',
      边界: '你需要亲近，也需要家人尊重彼此的选择与边界。',
      支持: '对你来说，家人的意义在于重要时刻能够真正出现并共同承担。',
      沟通: '你更在意真实感受能否被说出、听见和理解。',
      自主: '你希望爱不是服从，每个人都能保留自己的道路与完整性。',
      责任: '你看重承诺、分工与照顾能否被公平而具体地落实。',
    },
  },
  social: {
    title: '人际卡牌',
    dimensionTitle: '人际交往',
    introQuestion: '在人群与关系之间<br>你最后会守住什么？',
    introCopy: '先选出 9 张人际底牌，再持续面对交往情境。接受会保留底牌并提高下一轮压力；不接受则交换 2 张，直到自然剩下最关心的 3 点。',
    question: '在人际交往中，你最想守住什么？',
    themeClass: 'social-theme',
    glyph: '◎',
    target: '#dimSocial',
    button: '#dimBtnSocial',
    dimensionKey: 'social',
    storageKey: 'kaleido_social_cards_v1',
    cards: [
      { id: 'honesty', name: '真诚', glyph: '◇', group: '真诚' },
      { id: 'respect', name: '被尊重', glyph: '✦', group: '边界' },
      { id: 'response', name: '互相回应', glyph: '◉', group: '连接' },
      { id: 'reciprocity', name: '有来有往', glyph: '↔', group: '支持' },
      { id: 'safety', name: '情绪安全', glyph: '○', group: '轻松' },
      { id: 'secret', name: '保守秘密', glyph: '◌', group: '真诚' },
      { id: 'boundary', name: '清晰边界', glyph: '△', group: '边界' },
      { id: 'refuse', name: '允许拒绝', glyph: '×', group: '边界' },
      { id: 'interest', name: '共同兴趣', glyph: '❋', group: '连接' },
      { id: 'depth', name: '深度交流', glyph: '∞', group: '连接' },
      { id: 'ease', name: '轻松自在', glyph: '⌁', group: '轻松' },
      { id: 'contact', name: '稳定联系', glyph: '◎', group: '支持' },
      { id: 'repair', name: '冲突修复', glyph: '↻', group: '成长' },
      { id: 'help', name: '彼此支持', glyph: '＋', group: '支持' },
      { id: 'values', name: '价值观相近', glyph: '≈', group: '真诚' },
      { id: 'compare', name: '不被比较', glyph: '=', group: '轻松' },
      { id: 'admire', name: '被欣赏', glyph: '♡', group: '成长' },
      { id: 'space', name: '独处空间', glyph: '□', group: '轻松' },
    ],
    scenarios: [
      { title: '消息没有及时回复', copy: '一位重要朋友最近回复变慢，你不知道这是忙碌还是关系正在降温。', theme: '回应', severity: 1 },
      { title: '聚会里被暂时忽略', copy: '大家聊得热烈，你几次想加入却没有被接住。', theme: '融入', severity: 1 },
      { title: '观点出现明显不同', copy: '你和朋友对一件重要议题看法相反，气氛开始变得微妙。', theme: '差异', severity: 1 },
      { title: '付出长期不对等', copy: '你总是主动联系、倾听和帮助，对方却很少回应你的需要。', theme: '互惠', severity: 2 },
      { title: '秘密被转述给别人', copy: '一件只说给朋友听的事，后来出现在共同圈子里。', theme: '信任', severity: 2 },
      { title: '朋友提出越界请求', copy: '对方希望你付出大量时间或资源，并把拒绝理解成不够朋友。', theme: '边界', severity: 2 },
      { title: '共同好友要求你站队', copy: '两位朋友发生严重冲突，都希望你公开支持自己。', theme: '冲突', severity: 3 },
      { title: '重要机会形成竞争', copy: '你和朋友同时争取一个稀缺机会，比较与不安开始进入关系。', theme: '竞争', severity: 3 },
      { title: '价值观差异持续扩大', copy: '曾经亲近的人在重要选择上越来越不同，每次交流都更难自在。', theme: '变化', severity: 3 },
      { title: '关系里长期遭到贬低', copy: '对方不断用玩笑否定你的能力和感受，并说你太敏感。', theme: '尊重', severity: 4 },
      { title: '朋友圈出现集体排斥', copy: '熟悉的圈子开始有意绕开你，解释与修复的空间越来越少。', theme: '归属', severity: 4 },
      { title: '友谊进入信任危机', copy: '隐瞒、站队与失衡同时出现，你必须判断这段关系是否还能继续。', theme: '危机', severity: 4 },
    ],
    severity: [
      null,
      { name: '日常摩擦', copy: '先从回应、融入与观点不同开始。' },
      { name: '关系失衡', copy: '新的情境开始触及互惠、信任与边界。' },
      { name: '重要冲突', copy: '连续接受让选择进入竞争、站队与价值差异。' },
      { name: '信任危机', copy: '情境已经触及尊重、归属与关系能否继续。' },
    ],
    groupCopy: {
      真诚: '你最重视关系里的真实与可信，不愿靠猜测和表面和平维持连接。',
      边界: '你希望人际关系足够亲近，也允许拒绝并尊重彼此的界限。',
      连接: '深度交流与被回应，会让你真正感觉自己在关系之中。',
      支持: '你看重有来有往，关系需要在行动上互相接住。',
      轻松: '你需要的是不必持续证明自己、可以自然呼吸的相处。',
      成长: '你在意关系是否能容纳欣赏、修复与彼此变得更好。',
    },
  },
};
