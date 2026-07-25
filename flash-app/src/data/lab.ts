// 人生实验室 (life lab) choice decks + carry (底线) cards
// (source: prototype lines ~4064-4118: `CARRY_LIMIT`, `LAB_CHOICE_DECKS`, `CARRY_META`).

/** Max number of carry (底线) cards a player may bring into one round. */
export const CARRY_LIMIT = 3;

/** One choice card offered in the lab. */
export interface LabChoiceCard {
  g: string;
  name: string;
  copy: string;
  glow: string;
}

export type LabChoiceDeckKey = 'career' | 'study' | 'relationship' | 'family' | 'general';

export const LAB_CHOICE_DECKS: Record<LabChoiceDeckKey, LabChoiceCard[]> = {
  career: [
    { g: '🎨', name: '继续当前方向', copy: '留下来，继续积累', glow: 'rgba(94,150,255,.22)' },
    { g: '🧭', name: '直接切换方向', copy: '进入新的职业路径', glow: 'rgba(143,123,255,.24)' },
    { g: '🌱', name: '边做边尝试', copy: '保留工作，小步试水', glow: 'rgba(62,217,164,.2)' },
    { g: '⏸', name: '暂缓决定', copy: '先恢复精力和空间', glow: 'rgba(255,176,103,.18)' },
  ],
  study: [
    { g: '📖', name: '继续当前计划', copy: '按原目标投入准备', glow: 'rgba(94,150,255,.22)' },
    { g: '🧭', name: '更换学习方向', copy: '转专业或换项目', glow: 'rgba(143,123,255,.24)' },
    { g: '🌱', name: '先低成本试学', copy: '用课程和项目验证', glow: 'rgba(62,217,164,.2)' },
    { g: '⏳', name: '推迟一个周期', copy: '留出时间重新判断', glow: 'rgba(255,176,103,.18)' },
  ],
  relationship: [
    { g: '♡', name: '继续投入修复', copy: '坦白需要，共同调整', glow: 'rgba(240,106,205,.2)' },
    { g: '↔', name: '说清边界观察', copy: '约定改变，再看行动', glow: 'rgba(94,150,255,.22)' },
    { g: '◌', name: '暂时拉开距离', copy: '先恢复自己的感受', glow: 'rgba(143,123,255,.22)' },
    { g: '◇', name: '结束这段关系', copy: '承认不适合再继续', glow: 'rgba(255,122,77,.2)' },
    { g: '◎', name: '寻求第三方帮助', copy: '一起找专业支持', glow: 'rgba(62,217,164,.18)' },
  ],
  family: [
    { g: '⌂', name: '坦白沟通', copy: '把真实想法说清楚', glow: 'rgba(255,176,103,.2)' },
    { g: '🌱', name: '先做小范围尝试', copy: '用行动减少担心', glow: 'rgba(62,217,164,.2)' },
    { g: '↗', name: '保留自己的决定', copy: '理解家人，也不放弃自己', glow: 'rgba(143,123,255,.22)' },
  ],
  general: [
    { g: '＝', name: '保持现在', copy: '先不改变，继续观察', glow: 'rgba(94,150,255,.2)' },
    { g: '↗', name: '做出改变', copy: '接受代价，向前一步', glow: 'rgba(143,123,255,.23)' },
    { g: '🌱', name: '先做小实验', copy: '用一次行动收集证据', glow: 'rgba(62,217,164,.2)' },
  ],
};

/** A carry (底线) card definition. */
export interface CarryCardMeta {
  glyph: string;
  name: string;
  risk: string;
}

export type CarryCardKey = 'income' | 'health' | 'relation' | 'craft' | 'creation' | 'exit';

export const CARRY_META: Record<CarryCardKey, CarryCardMeta> = {
  income: { glyph: '▣', name: '稳定的生活来源', risk: '转型不顺时，收入可能在一段时间内下降，生活安全感受到直接冲击。' },
  health: { glyph: '＋', name: '不透支身体', risk: '反复尝试与加倍学习可能挤压睡眠和恢复时间，身体先替选择支付代价。' },
  relation: { glyph: '♡', name: '重要关系不被牺牲', risk: '压力与时间投入可能让你减少陪伴，也可能加剧家人对这次改变的不理解。' },
  craft: { glyph: '✦', name: '保住七年专业积累', risk: '最差情况下，新岗位没有站稳，原有专业身份也因中断而需要重新证明。' },
  creation: { glyph: '◇', name: '创造的实感', risk: '你可能进入一个更偏协调和推进的岗位，却发现真正动手创造的时刻反而更少。' },
  exit: { glyph: '↩', name: '仍有退路可选', risk: '如果投入过深、现金流下降或履历断裂，回到原路径的成本会明显升高。' },
};
