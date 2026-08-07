// Demo assessment definitions (big five / strength / love / family) + MBTI types
// (source: prototype lines ~6125-6233 `DEMO_ASSESSMENTS` and ~6767 `MBTI_TYPES`).

import { BIG_FIVE_FACETS, type BigFiveDim } from './bigFive';

export interface AssessmentDimMeta {
  name: string;
  label: string;
  color: string;
  desc: string;
}

/** A situational item. `f` (facet) and `r` (reverse) are present only on big-five items. */
export interface AssessmentItem {
  d: string;
  t: string;
  f?: string;
  r?: boolean;
}

export interface BigFiveFacetMeta {
  name: string;
  d: BigFiveDim;
}

export interface DemoAssessment {
  title: string;
  sub: string;
  kicker: string;
  introTitle: string;
  intro: string;
  notices: string[];
  resultTitle: string;
  resultSub: string;
  saveLabel: string;
  dims: Record<string, AssessmentDimMeta>;
  items: AssessmentItem[];
  /** Present only on the big-five assessment. */
  facetMeta?: Record<string, BigFiveFacetMeta>;
}

export type DemoAssessmentKind = 'bigfive' | 'strength' | 'love' | 'family';

// Big-five items/facetMeta are derived from BIG_FIVE_FACETS (prototype lines ~6230-6233).
function buildBigFiveItems(): AssessmentItem[] {
  const rounds = [0, 1, 2, 3] as const;
  const out: AssessmentItem[] = [];
  for (const round of rounds) {
    for (const facet of BIG_FIVE_FACETS) {
      const entry = facet.items[round];
      out.push({ d: facet.d, f: facet.f, t: entry[0], r: entry[1] });
    }
  }
  return out;
}

function buildBigFiveFacetMeta(): Record<string, BigFiveFacetMeta> {
  const meta: Record<string, BigFiveFacetMeta> = {};
  for (const facet of BIG_FIVE_FACETS) {
    meta[facet.f] = { name: facet.name, d: facet.d };
  }
  return meta;
}

export const DEMO_ASSESSMENTS: Record<DemoAssessmentKind, DemoAssessment> = {
  bigfive: {
    title: '大五人格',
    sub: '五个维度都是光谱，没有好坏',
    kicker: 'PERSONALITY PROFILE',
    introTitle: '你通常如何<br>感受、思考与行动？',
    intro: '请按照过去一年里大多数时候的真实状态回答，而不是理想中的自己。完成后会看到五个主要维度和三十个细分面向。',
    notices: ['完整版共120题，通常需要15–20分钟', '结果展示五维连续分数，不把你分成固定类型', '答案保存在当前设备，原始答案默认私密'],
    resultTitle: '人格底色',
    resultSub: '大五人格',
    saveLabel: '保存为我的人格底色',
    dims: {
      O: { name: '开放', label: '好奇开放', color: '#8FA4FF', desc: '愿意接触新观点、想象与复杂体验' },
      C: { name: '尽责', label: '可靠有序', color: '#6FD0B0', desc: '倾向规划、自律并把事情完成' },
      E: { name: '外向', label: '主动联结', color: '#E7B86D', desc: '容易从互动、表达和行动中获得能量' },
      A: { name: '宜人', label: '体谅合作', color: '#E58BBF', desc: '重视理解、信任与合作' },
      N: { name: '情绪敏感', label: '情绪敏锐', color: '#A997DB', desc: '更容易觉察压力、担忧与情绪波动' },
    },
    items: buildBigFiveItems(),
    facetMeta: buildBigFiveFacetMeta(),
  },
  strength: {
    title: '优势证据探索',
    sub: '不需要先知道答案，也不依赖关键词选择',
    kicker: 'STRENGTH EVIDENCE · SITUATIONAL DEMO',
    introTitle: '先看你会怎么做，<br>再反推你可能擅长什么。',
    intro: '这里不要求你先声明“我擅长什么”。请判断下面这些真实工作与生活情境有多像你，系统会从重复出现的行为证据中提炼优势信号。',
    notices: ['15题情境判断，可直接开始', '结果是待验证的优势假设，不是能力证明', '建议之后补充一段真实经历来增强可信度'],
    resultTitle: '优势画像',
    resultSub: '行为证据 · Demo 探索版',
    saveLabel: '把优势信号写入“我擅长”',
    dims: {
      structure: { name: '结构', label: '结构化思考', color: '#7F9EFF', desc: '把复杂信息拆开、整理并建立清楚路径' },
      empathy: { name: '共情', label: '理解他人', color: '#E88FB9', desc: '觉察感受与立场，帮助对话继续' },
      expression: { name: '表达', label: '清晰表达', color: '#C394E8', desc: '把模糊想法转化为别人能理解的语言或画面' },
      execution: { name: '推进', label: '推动落地', color: '#E7B36C', desc: '协调资源、处理阻力并把事情向前推进' },
      learning: { name: '学习', label: '快速学习', color: '#67CBAE', desc: '从反馈中抓住规律并迁移到新问题' },
    },
    items: [
      { d: 'structure', t: '信息混乱时，我会自然地给它们分类并找出主线' },
      { d: 'empathy', t: '两个人争执时，我常能听出双方真正担心什么' },
      { d: 'expression', t: '别人听不懂时，我能换一种说法或画法继续解释' },
      { d: 'execution', t: '计划卡住时，我会找到下一步可执行的小动作' },
      { d: 'learning', t: '接触新工具后，我能较快摸清它的基本规律' },
      { d: 'structure', t: '面对复杂任务，我会先明确目标、限制和优先级' },
      { d: 'empathy', t: '团队气氛微妙变化时，我通常能较早觉察' },
      { d: 'expression', t: '我能把长篇内容压缩成重点，又不丢掉关键含义' },
      { d: 'execution', t: '需要多人配合时，我会主动确认责任和时间点' },
      { d: 'learning', t: '一次失败后，我通常能总结出下次可调整的办法' },
      { d: 'structure', t: '我喜欢发现看似无关信息之间的关系' },
      { d: 'empathy', t: '别人表达不完整时，我能用提问帮他把想法说清楚' },
      { d: 'expression', t: '我对措辞、叙事或视觉呈现是否准确比较敏感' },
      { d: 'execution', t: '即使条件不完美，我也能先做出可验证的版本' },
      { d: 'learning', t: '我能把一个领域学到的方法迁移到另一个问题上' },
    ],
  },
  love: {
    title: '关系安全感与靠近方式',
    sub: '理解需要，不评判依恋类型',
    kicker: 'RELATIONSHIP SECURITY · DEMO CONSTRUCT VERSION',
    introTitle: '当关系变重要时，<br>你会怎样靠近或保护自己？',
    intro: '请想象一段对你重要的亲密关系，按照你真实的反应回答。题目参考依恋焦虑与回避构念重新编写，仅用于 Demo 自我探索。',
    notices: ['18题，观察安全感需求与距离调节', '高低都不是好坏，而是不同的保护方式', '结果不用于诊断，也不替代真实关系中的沟通'],
    resultTitle: '恋爱关系画像',
    resultSub: '亲密关系构念 · Demo 改写版',
    saveLabel: '写入“我在恋爱关系中在意”',
    dims: {
      anxiety: { name: '确认需要', label: '及时回应', color: '#EC8C86', desc: '关系不确定时，更需要清晰回应与稳定确认' },
      avoidance: { name: '距离需要', label: '尊重边界', color: '#8EA1D8', desc: '关系靠近时，更重视自主空间与不被侵入' },
    },
    items: [
      { d: 'anxiety', t: '对方回复变慢时，我会担心自己不再重要' },
      { d: 'avoidance', t: '关系太亲密时，我会担心失去自己的空间' },
      { d: 'anxiety', t: '发生矛盾后，如果问题悬着，我很难安心做别的事' },
      { d: 'avoidance', t: '我不太习惯把最脆弱的感受交给伴侣' },
      { d: 'anxiety', t: '我需要对方明确表达在乎，而不只是让我自己猜' },
      { d: 'avoidance', t: '遇到压力时，我通常更想自己消化而不是寻求伴侣支持' },
      { d: 'anxiety', t: '关系出现距离时，我容易反复回想是不是自己做错了什么' },
      { d: 'avoidance', t: '即使关系很好，我也需要保留不被追问的私人部分' },
      { d: 'anxiety', t: '我能相信对方即使暂时忙碌也不会离开', r: true },
      { d: 'avoidance', t: '我可以坦然依靠伴侣，也允许伴侣依靠我', r: true },
      { d: 'anxiety', t: '对方语气细微变化会明显影响我的安全感' },
      { d: 'avoidance', t: '谈到长期承诺时，我有时会本能地想后退' },
      { d: 'anxiety', t: '我担心自己投入得比对方更多' },
      { d: 'avoidance', t: '我不喜欢伴侣知道我所有的需要' },
      { d: 'anxiety', t: '冲突后得到一个明确的修复动作对我很重要' },
      { d: 'avoidance', t: '即使意见不同，我也能在关系中保持亲近', r: true },
      { d: 'anxiety', t: '我通常确信自己值得被稳定地爱', r: true },
      { d: 'avoidance', t: '表达依赖会让我觉得自己失去了主动权' },
    ],
  },
  family: {
    title: '家庭关系与期待',
    sub: '看见你想守住的家庭价值',
    kicker: 'FAMILY VALUES · DEMO CONSTRUCT VERSION',
    introTitle: '在家人之间，<br>什么让你感觉这是“家”？',
    intro: '请按照你真正期待的家庭关系回答，而不是判断原生家庭好坏。题目参考家庭凝聚、沟通、边界、责任与自主构念重新编写。',
    notices: ['20题，覆盖五个家庭关系维度', '测的是你的期待与偏好，不给家庭贴标签', '结果可继续用自定义关键词修正'],
    resultTitle: '家庭价值画像',
    resultSub: '家庭关系构念 · Demo 改写版',
    saveLabel: '写入“我在家庭关系中在意”',
    dims: {
      cohesion: { name: '支持', label: '彼此支持', color: '#6FD1B1', desc: '重要时刻能够互相靠近并提供实际支持' },
      communication: { name: '沟通', label: '坦诚沟通', color: '#7FA7E8', desc: '问题能被说出来，也能被认真听见' },
      boundary: { name: '边界', label: '尊重边界', color: '#A796D8', desc: '亲近不等于控制，允许保留个人空间' },
      responsibility: { name: '责任', label: '共同承担', color: '#E3B26E', desc: '家庭责任清楚、公平且说到做到' },
      autonomy: { name: '自主', label: '允许不同选择', color: '#E68FAD', desc: '家人可以拥有不同道路而不被否定' },
    },
    items: [
      { d: 'cohesion', t: '遇到真正困难时，家人愿意放下分歧一起面对' },
      { d: 'communication', t: '不舒服的事情可以直接说，而不用靠猜或冷战' },
      { d: 'boundary', t: '家人会先征求意见，再介入彼此的个人决定' },
      { d: 'responsibility', t: '照顾、家务和经济责任应当被清楚讨论' },
      { d: 'autonomy', t: '即使选择不同，家人也应尊重彼此的人生方向' },
      { d: 'cohesion', t: '重要时刻有人在场，比表面的热闹更重要' },
      { d: 'communication', t: '家里应该允许表达脆弱，而不被嘲笑或指责' },
      { d: 'boundary', t: '亲密关系里也应该保留隐私和独处空间' },
      { d: 'responsibility', t: '答应家人的事情应该尽量做到' },
      { d: 'autonomy', t: '爱不应该以服从为前提' },
      { d: 'cohesion', t: '家人之间的支持应当包括实际行动，而不只是口头关心' },
      { d: 'communication', t: '发生冲突后，愿意回来修复比假装没事更重要' },
      { d: 'boundary', t: '家人不应通过愧疚感来迫使彼此答应要求' },
      { d: 'responsibility', t: '承担更多的人也应该有权表达疲惫和需要' },
      { d: 'autonomy', t: '成年人有权决定自己的伴侣、工作和生活方式' },
      { d: 'cohesion', t: '即使不常联系，也应让彼此知道需要时可以求助' },
      { d: 'communication', t: '家人之间应该说清期待，而不是把“你应该懂”当作规则' },
      { d: 'boundary', t: '关心一个人不代表可以替他做所有决定' },
      { d: 'responsibility', t: '家庭里的付出需要被看见，而不是被当作理所当然' },
      { d: 'autonomy', t: '家庭和睦不意味着所有人必须想法一致' },
    ],
  },
};

/**
 * 大五低分端标签（source: prototype `demoResultTags` 的 low 表）。五个维度都是光谱，
 * 低分不是缺陷，所以低端也给一个正向命名，而不是把高端标签取反。
 */
export const BIGFIVE_LOW_LABELS: Record<BigFiveDim, string> = {
  O: '务实聚焦',
  C: '灵活随性',
  E: '安静蓄能',
  A: '独立判断',
  N: '情绪稳定',
};

/** 大五 / 恋爱等维度分的高分阈值（百分比），对齐 iOS resultTags。 */
export const HIGH_SCORE_THRESHOLD = 58;

export const MBTI_TYPES = [
  'ISTJ',
  'ISFJ',
  'INFJ',
  'INTJ',
  'ISTP',
  'ISFP',
  'INFP',
  'INTP',
  'ESTP',
  'ESFP',
  'ENFP',
  'ENTP',
  'ESTJ',
  'ESFJ',
  'ENFJ',
  'ENTJ',
] as const;

export type MBTIType = (typeof MBTI_TYPES)[number];
