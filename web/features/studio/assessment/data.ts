/* 测评题库与配置 —— 全量移植 iOS AssessmentData.swift（HOLLAND / BIG_FIVE / DEMO_ASSESSMENTS）。 */

import type { DimensionKey } from "@/lib/dimensions";

export type AssessmentKind = "holland" | "bigfive" | "strength" | "love" | "family";

export const ASSESSMENT_KINDS: AssessmentKind[] = [
  "holland",
  "bigfive",
  "strength",
  "love",
  "family",
];

export function isAssessmentKind(v: string): v is AssessmentKind {
  return (ASSESSMENT_KINDS as string[]).includes(v);
}

/** 结果写入的画像维度（bigfive → 人格底色单独处理，返回 null） */
export function targetDimension(kind: AssessmentKind): DimensionKey | null {
  switch (kind) {
    case "holland":
      return "like";
    case "strength":
      return "skill";
    case "love":
      return "love";
    case "family":
      return "family";
    case "bigfive":
      return null;
  }
}

export interface AssessmentDim {
  key: string;
  name: string;
  label: string;
  color: string;
  desc: string;
}

export interface AssessmentItem {
  dim: string;
  facet?: string;
  text: string;
  reversed?: boolean;
}

export interface AssessmentConfig {
  kind: AssessmentKind;
  title: string;
  sub: string;
  kicker: string;
  introTitle: string;
  intro: string;
  notices: string[];
  resultTitle: string;
  resultSub: string;
  saveLabel: string;
  dims: AssessmentDim[];
  items: AssessmentItem[];
  likert: string[];
}

export function configDim(cfg: AssessmentConfig, key: string): AssessmentDim {
  return cfg.dims.find((d) => d.key === key)!;
}

/* ============ 霍兰德（O*NET Mini-IP，30 题，RIASEC） ============ */

export const HOLLAND_MAX = 20;

const HOLLAND_RAW: [string, string][] = [
  ["R", "制作厨房橱柜"],
  ["I", "研发一种新药"],
  ["A", "创作一本书或一部戏剧"],
  ["S", "帮助他人处理个人或情绪问题"],
  ["E", "管理大型公司中的一个部门"],
  ["C", "为大型计算机网络安装软件"],
  ["R", "修理家用电器"],
  ["I", "研究减少水污染的方法"],
  ["A", "作曲或编曲"],
  ["S", "为他人提供职业发展指导"],
  ["E", "创办自己的企业"],
  ["C", "使用计算器进行计算"],
  ["R", "组装电子零件"],
  ["I", "进行化学实验"],
  ["A", "为电影制作特效"],
  ["S", "提供康复治疗"],
  ["E", "谈判商业合同"],
  ["C", "整理货物收发记录"],
  ["R", "驾驶车辆向办公室和住户配送包裹"],
  ["I", "使用显微镜检查血液样本"],
  ["A", "绘制舞台布景"],
  ["S", "在非营利组织从事志愿工作"],
  ["E", "推广一个新的服装系列"],
  ["C", "使用手持设备盘点物资"],
  ["R", "在零件发货前检查其质量"],
  ["I", "研发更准确预测天气的方法"],
  ["A", "为电影或电视节目编写剧本"],
  ["S", "教授高中课程"],
  ["E", "在百货商店销售商品"],
  ["C", "为一个组织分拣和分发邮件"],
];

const HOLLAND: AssessmentConfig = {
  kind: "holland",
  title: "霍兰德兴趣测评",
  sub: "兴趣不是能力，也不是职业判决",
  kicker: "O*NET MINI INTEREST PROFILER",
  introTitle: "哪些活动，\n会让你自然地靠近？",
  intro:
    "接下来会出现30种活动。请只回答“喜欢不喜欢”，不要考虑自己现在会不会、薪资高不高或别人怎么看。",
  notices: [
    "这是霍兰德RIASEC模型的官方移动短版",
    "结果描述兴趣，不代表能力、资格或命定职业",
    "中文内容为产品验证中的翻译版本",
    "答案会保存在当前设备，可随时退出继续",
  ],
  resultTitle: "兴趣画像",
  resultSub: "正式量表来源 · O*NET Mini-IP",
  saveLabel: "将这组兴趣信号保存到我的画像",
  dims: [
    { key: "R", name: "实际型", label: "动手实践", color: "#7DB5A0", desc: "你容易被可以操作、制作和解决现场问题的活动吸引。" },
    { key: "I", name: "研究型", label: "深度探索", color: "#789EFF", desc: "你容易投入分析证据、追根究底和理解复杂问题的活动。" },
    { key: "A", name: "艺术型", label: "创意表达", color: "#D785C8", desc: "你更愿意在审美、想象和开放表达中形成自己的作品。" },
    { key: "S", name: "社会型", label: "理解与帮助", color: "#E99B78", desc: "你容易从支持、教学、沟通和帮助他人成长中获得意义。" },
    { key: "E", name: "企业型", label: "影响推动", color: "#D9B563", desc: "你对发起、谈判、组织资源和推动目标更容易产生兴趣。" },
    { key: "C", name: "常规型", label: "秩序组织", color: "#8F91B8", desc: "你更喜欢规则清楚、细节可靠和可以持续优化的工作方式。" },
  ],
  items: HOLLAND_RAW.map(([dim, text]) => ({ dim, text })),
  likert: ["非常不喜欢", "不喜欢", "不确定", "喜欢", "非常喜欢"],
};

/** 双字母兴趣组合叙事（原型 hollandNarrative） */
export const HOLLAND_PAIR_NARRATIVE: Record<string, string> = {
  RI: "你喜欢先弄清原理，再把想法变成可以工作的东西。",
  RA: "你在材料、技术和表达之间寻找创造的实感。",
  IA: "你容易在分析与想象之间建立新的解释。",
  IS: "你希望理解复杂问题，也希望这些理解能真正帮助到人。",
  AS: "表达和连接对你同样重要，你更愿意让创作抵达别人。",
  AE: "你不只喜欢产生想法，也容易被传播和推动它们吸引。",
  SE: "你更享受与人协作，并把共同目标向前推动。",
  SC: "你愿意用稳定、可靠的方式支持人的需要。",
  EC: "目标、资源和流程的组织容易激发你的投入感。",
  IC: "你擅长被复杂信息吸引，并愿意把它整理成可靠结构。",
};

/* ============ 大五人格（120 题 = 30 facet × 4 轮） ============ */

export interface Facet {
  d: string;
  f: string;
  name: string;
  /** 4 条 [题面, 是否反向] */
  items: [string, boolean][];
}

export const BIG_FIVE_FACETS: Facet[] = [
  { d: "N", f: "N1", name: "焦虑", items: [["我常为事情担心", false], ["我容易设想最坏的结果", false], ["许多事情会让我感到害怕", false], ["我很容易感到压力", false]] },
  { d: "E", f: "E1", name: "友善", items: [["我很容易结交新朋友", false], ["和别人在一起时我通常很自在", false], ["我会避免与别人接触", true], ["我习惯和别人保持距离", true]] },
  { d: "O", f: "O1", name: "想象力", items: [["我的想象力很丰富", false], ["我喜欢不受拘束地幻想", false], ["我喜欢做白日梦", false], ["我喜欢沉浸在自己的思绪中", false]] },
  { d: "A", f: "A1", name: "信任", items: [["我通常愿意信任别人", false], ["我相信大多数人抱有善意", false], ["我愿意相信别人说的话", false], ["我很难信任别人", true]] },
  { d: "C", f: "C1", name: "效能感", items: [["我能成功完成交给自己的任务", false], ["我通常能把自己做的事情做好", false], ["我能顺利处理大多数任务", false], ["我知道怎样把事情办成", false]] },
  { d: "N", f: "N2", name: "易怒", items: [["我很容易生气", false], ["我很容易被惹恼", false], ["我有时会控制不住脾气", false], ["我通常不会轻易恼火", true]] },
  { d: "E", f: "E2", name: "合群", items: [["我喜欢热闹的大型聚会", false], ["在聚会上我会和许多不同的人交谈", false], ["我更喜欢独处", true], ["我会避开拥挤的人群", true]] },
  { d: "O", f: "O2", name: "艺术兴趣", items: [["我相信艺术很重要", false], ["我能看到别人可能忽略的美", false], ["我不喜欢诗歌", true], ["我不享受参观美术馆或展览", true]] },
  { d: "A", f: "A2", name: "真诚", items: [["我会利用别人达到自己的目的", true], ["为了占优势，我可能会作弊", true], ["我会占别人的便宜", true], ["我会故意阻碍别人的计划", true]] },
  { d: "C", f: "C2", name: "条理", items: [["我喜欢整理和收拾东西", false], ["我常忘记把东西放回原位", true], ["我的房间或工作区经常很乱", true], ["我经常把物品随手乱放", true]] },
  { d: "N", f: "N3", name: "低落", items: [["我常感到情绪低落", false], ["我有时不喜欢自己", false], ["我经常提不起精神", false], ["我通常能自在地接纳自己", true]] },
  { d: "E", f: "E3", name: "主导性", items: [["需要时我会主动负责", false], ["我会尝试带领别人", false], ["我倾向主动掌控事情的进展", false], ["我通常等别人先带头", true]] },
  { d: "O", f: "O3", name: "情感丰富", items: [["我的情绪体验很强烈", false], ["我能感受到别人的情绪", false], ["我很少留意自己的情绪反应", true], ["我难以理解情绪反应强烈的人", true]] },
  { d: "A", f: "A3", name: "利他", items: [["我关心别人的处境", false], ["我喜欢帮助别人", false], ["我对别人的感受漠不关心", true], ["我不愿意为别人花时间", true]] },
  { d: "C", f: "C3", name: "责任感", items: [["我会遵守自己的承诺", false], ["我重视诚实地说出事实", false], ["我会随意破坏规则", true], ["我经常违背自己答应的事情", true]] },
  { d: "N", f: "N4", name: "社交敏感", items: [["我觉得主动接近别人很困难", false], ["我害怕成为别人注意的焦点", false], ["只有和熟人在一起时我才真正放松", false], ["困难的社交场合通常不会困扰我", true]] },
  { d: "E", f: "E4", name: "活跃度", items: [["我总让自己保持忙碌", false], ["我经常处于行动状态", false], ["空闲时间里我也会做很多事情", false], ["我喜欢放慢节奏、轻松度日", true]] },
  { d: "O", f: "O4", name: "冒险性", items: [["比起固定惯例，我更喜欢变化", false], ["我更愿意坚持自己熟悉的事物", true], ["我不喜欢变化", true], ["我很依恋传统的做法", true]] },
  { d: "A", f: "A4", name: "合作", items: [["我喜欢和别人激烈争斗", true], ["我会对别人大喊大叫", true], ["我会用言语羞辱别人", true], ["别人伤害我后，我会想办法报复", true]] },
  { d: "C", f: "C4", name: "成就追求", items: [["我常愿意做得比要求更多", false], ["我工作时很努力", false], ["我很少为工作投入时间和精力", true], ["我往往只做到刚好过关", true]] },
  { d: "N", f: "N5", name: "冲动", items: [["我有时会毫无节制地放纵自己", false], ["我很少过度放纵", true], ["我通常能抵抗诱惑", true], ["我能够控制自己的强烈欲望", true]] },
  { d: "E", f: "E5", name: "寻求刺激", items: [["我喜欢刺激的体验", false], ["我会主动寻找冒险", false], ["我有时享受不计后果的感觉", false], ["我偶尔喜欢表现得疯狂而不受拘束", false]] },
  { d: "O", f: "O5", name: "思辨", items: [["我喜欢阅读有挑战性的内容", false], ["我会避开哲学性的讨论", true], ["我较难理解抽象观念", true], ["我对理论讨论不感兴趣", true]] },
  { d: "A", f: "A5", name: "谦逊", items: [["我认为自己比别人更优秀", true], ["我对自己的评价非常高", true], ["我常觉得自己高人一等", true], ["我会向别人夸耀自己的优点", true]] },
  { d: "C", f: "C5", name: "自律", items: [["我通常会提前做好准备", false], ["我会执行自己制定的计划", false], ["我经常把时间浪费掉", true], ["我很难开始应该完成的任务", true]] },
  { d: "N", f: "N6", name: "脆弱性", items: [["我很容易陷入慌乱", false], ["事情一多我就容易不知所措", false], ["我有时觉得自己应付不了问题", false], ["压力之下我通常能保持冷静", true]] },
  { d: "E", f: "E6", name: "积极情绪", items: [["我经常流露出愉快的情绪", false], ["我生活中有许多快乐时刻", false], ["我热爱生活", false], ["我习惯看到事情积极的一面", false]] },
  { d: "O", f: "O6", name: "观念开放", items: [["我倾向支持更开放的社会观念", false], ["我认为是非并不总有绝对答案", false], ["我更倾向维护传统保守的社会观念", true], ["我认为对违规行为通常应采取强硬惩罚", true]] },
  { d: "A", f: "A6", name: "同理心", items: [["我会同情无家可归的人", false], ["我会为处境比自己艰难的人感到难过", false], ["我对别人的困难不感兴趣", true], ["我会刻意不去想处境困难的人", true]] },
  { d: "C", f: "C6", name: "审慎", items: [["我常没想清楚就直接行动", true], ["我有时会做出草率决定", true], ["我容易仓促行事", true], ["我会不经思考就采取行动", true]] },
];

export function facetMeta(f: string): Facet | undefined {
  return BIG_FIVE_FACETS.find((facet) => facet.f === f);
}

/** 大五低分端标签（原型 demoResultTags low 表） */
export const BIG_FIVE_LOW_LABELS: Record<string, string> = {
  O: "务实聚焦",
  C: "灵活随性",
  E: "安静蓄能",
  A: "独立判断",
  N: "情绪稳定",
};

const BIG_FIVE: AssessmentConfig = {
  kind: "bigfive",
  title: "大五人格",
  sub: "五个维度都是光谱",
  kicker: "PERSONALITY PROFILE",
  introTitle: "你通常如何\n感受、思考与行动？",
  intro:
    "请按照过去一年里大多数时候的真实状态回答，而不是理想中的自己。完成后会看到五个主要维度和三十个细分面向。",
  notices: [
    "完整版共120题，通常需要15–20分钟",
    "结果展示五维连续分数，不把你分成固定类型",
    "答案保存在当前设备，原始答案默认私密",
  ],
  resultTitle: "人格底色",
  resultSub: "大五人格",
  saveLabel: "保存为我的人格底色",
  dims: [
    { key: "O", name: "开放", label: "好奇开放", color: "#8FA4FF", desc: "愿意接触新观点、想象与复杂体验" },
    { key: "C", name: "尽责", label: "可靠有序", color: "#6FD0B0", desc: "倾向规划、自律并把事情完成" },
    { key: "E", name: "外向", label: "主动联结", color: "#E7B86D", desc: "容易从互动、表达和行动中获得能量" },
    { key: "A", name: "宜人", label: "体谅合作", color: "#E58BBF", desc: "重视理解、信任与合作" },
    { key: "N", name: "情绪敏感", label: "情绪敏锐", color: "#A997DB", desc: "更容易觉察压力、担忧与情绪波动" },
  ],
  items: Array.from({ length: 4 }, (_, round) =>
    BIG_FIVE_FACETS.map((facet) => ({
      dim: facet.d,
      facet: facet.f,
      text: facet.items[round][0],
      reversed: facet.items[round][1],
    })),
  ).flat(),
  likert: ["非常不符合", "比较不符合", "不确定", "比较符合", "非常符合"],
};

/* ============ 优势证据探索（15 题） ============ */

const STRENGTH: AssessmentConfig = {
  kind: "strength",
  title: "优势证据探索",
  sub: "不需要先知道答案，也不依赖关键词选择",
  kicker: "STRENGTH EVIDENCE · SITUATIONAL DEMO",
  introTitle: "先看你会怎么做，\n再反推你可能擅长什么。",
  intro:
    "这里不要求你先声明“我擅长什么”。请判断下面这些真实工作与生活情境有多像你，系统会从重复出现的行为证据中提炼优势信号。",
  notices: [
    "15题情境判断，可直接开始",
    "结果是待验证的优势假设，不是能力证明",
    "建议之后补充一段真实经历来增强可信度",
  ],
  resultTitle: "优势画像",
  resultSub: "行为证据 · Demo 探索版",
  saveLabel: "把优势信号写入“我擅长”",
  dims: [
    { key: "structure", name: "结构", label: "结构化思考", color: "#7F9EFF", desc: "把复杂信息拆开、整理并建立清楚路径" },
    { key: "empathy", name: "共情", label: "理解他人", color: "#E88FB9", desc: "觉察感受与立场，帮助对话继续" },
    { key: "expression", name: "表达", label: "清晰表达", color: "#C394E8", desc: "把模糊想法转化为别人能理解的语言或画面" },
    { key: "execution", name: "推进", label: "推动落地", color: "#E7B36C", desc: "协调资源、处理阻力并把事情向前推进" },
    { key: "learning", name: "学习", label: "快速学习", color: "#67CBAE", desc: "从反馈中抓住规律并迁移到新问题" },
  ],
  items: [
    { dim: "structure", text: "信息混乱时，我会自然地给它们分类并找出主线" },
    { dim: "empathy", text: "两个人争执时，我常能听出双方真正担心什么" },
    { dim: "expression", text: "别人听不懂时，我能换一种说法或画法继续解释" },
    { dim: "execution", text: "计划卡住时，我会找到下一步可执行的小动作" },
    { dim: "learning", text: "接触新工具后，我能较快摸清它的基本规律" },
    { dim: "structure", text: "面对复杂任务，我会先明确目标、限制和优先级" },
    { dim: "empathy", text: "团队气氛微妙变化时，我通常能较早觉察" },
    { dim: "expression", text: "我能把长篇内容压缩成重点，又不丢掉关键含义" },
    { dim: "execution", text: "需要多人配合时，我会主动确认责任和时间点" },
    { dim: "learning", text: "一次失败后，我通常能总结出下次可调整的办法" },
    { dim: "structure", text: "我喜欢发现看似无关信息之间的关系" },
    { dim: "empathy", text: "别人表达不完整时，我能用提问帮他把想法说清楚" },
    { dim: "expression", text: "我对措辞、叙事或视觉呈现是否准确比较敏感" },
    { dim: "execution", text: "即使条件不完美，我也能先做出可验证的版本" },
    { dim: "learning", text: "我能把一个领域学到的方法迁移到另一个问题上" },
  ],
  likert: ["非常不符合", "比较不符合", "不确定", "比较符合", "非常符合"],
};

/* ============ 关系安全感（18 题） ============ */

const LOVE: AssessmentConfig = {
  kind: "love",
  title: "关系安全感与靠近方式",
  sub: "理解需要，不评判依恋类型",
  kicker: "RELATIONSHIP SECURITY · DEMO CONSTRUCT VERSION",
  introTitle: "当关系变重要时，\n你会怎样靠近或保护自己？",
  intro:
    "请想象一段对你重要的亲密关系，按照你真实的反应回答。题目参考依恋焦虑与回避构念重新编写，仅用于 Demo 自我探索。",
  notices: [
    "18题，观察安全感需求与距离调节",
    "高低都不是好坏，而是不同的保护方式",
    "结果不用于诊断，也不替代真实关系中的沟通",
  ],
  resultTitle: "恋爱关系画像",
  resultSub: "亲密关系构念 · Demo 改写版",
  saveLabel: "写入“我在恋爱关系中在意”",
  dims: [
    { key: "anxiety", name: "确认需要", label: "及时回应", color: "#EC8C86", desc: "关系不确定时，更需要清晰回应与稳定确认" },
    { key: "avoidance", name: "距离需要", label: "尊重边界", color: "#8EA1D8", desc: "关系靠近时，更重视自主空间与不被侵入" },
  ],
  items: [
    { dim: "anxiety", text: "对方回复变慢时，我会担心自己不再重要" },
    { dim: "avoidance", text: "关系太亲密时，我会担心失去自己的空间" },
    { dim: "anxiety", text: "发生矛盾后，如果问题悬着，我很难安心做别的事" },
    { dim: "avoidance", text: "我不太习惯把最脆弱的感受交给伴侣" },
    { dim: "anxiety", text: "我需要对方明确表达在乎，而不只是让我自己猜" },
    { dim: "avoidance", text: "遇到压力时，我通常更想自己消化而不是寻求伴侣支持" },
    { dim: "anxiety", text: "关系出现距离时，我容易反复回想是不是自己做错了什么" },
    { dim: "avoidance", text: "即使关系很好，我也需要保留不被追问的私人部分" },
    { dim: "anxiety", text: "我能相信对方即使暂时忙碌也不会离开", reversed: true },
    { dim: "avoidance", text: "我可以坦然依靠伴侣，也允许伴侣依靠我", reversed: true },
    { dim: "anxiety", text: "对方语气细微变化会明显影响我的安全感" },
    { dim: "avoidance", text: "谈到长期承诺时，我有时会本能地想后退" },
    { dim: "anxiety", text: "我担心自己投入得比对方更多" },
    { dim: "avoidance", text: "我不喜欢伴侣知道我所有的需要" },
    { dim: "anxiety", text: "冲突后得到一个明确的修复动作对我很重要" },
    { dim: "avoidance", text: "即使意见不同，我也能在关系中保持亲近", reversed: true },
    { dim: "anxiety", text: "我通常确信自己值得被稳定地爱", reversed: true },
    { dim: "avoidance", text: "表达依赖会让我觉得自己失去了主动权" },
  ],
  likert: ["非常不符合", "比较不符合", "不确定", "比较符合", "非常符合"],
};

/* ============ 家庭关系与期待（20 题） ============ */

const FAMILY: AssessmentConfig = {
  kind: "family",
  title: "家庭关系与期待",
  sub: "看见你想守住的家庭价值",
  kicker: "FAMILY VALUES · DEMO CONSTRUCT VERSION",
  introTitle: "在家人之间，\n什么让你感觉这是“家”？",
  intro:
    "请按照你真正期待的家庭关系回答，而不是判断原生家庭好坏。题目参考家庭凝聚、沟通、边界、责任与自主构念重新编写。",
  notices: [
    "20题，覆盖五个家庭关系维度",
    "测的是你的期待与偏好，不给家庭贴标签",
    "结果可继续用自定义关键词修正",
  ],
  resultTitle: "家庭价值画像",
  resultSub: "家庭关系构念 · Demo 改写版",
  saveLabel: "写入“我在家庭关系中在意”",
  dims: [
    { key: "cohesion", name: "支持", label: "彼此支持", color: "#6FD1B1", desc: "重要时刻能够互相靠近并提供实际支持" },
    { key: "communication", name: "沟通", label: "坦诚沟通", color: "#7FA7E8", desc: "问题能被说出来，也能被认真听见" },
    { key: "boundary", name: "边界", label: "尊重边界", color: "#A796D8", desc: "亲近不等于控制，允许保留个人空间" },
    { key: "responsibility", name: "责任", label: "共同承担", color: "#E3B26E", desc: "家庭责任清楚、公平且说到做到" },
    { key: "autonomy", name: "自主", label: "允许不同选择", color: "#E68FAD", desc: "家人可以拥有不同道路而不被否定" },
  ],
  items: [
    { dim: "cohesion", text: "遇到真正困难时，家人愿意放下分歧一起面对" },
    { dim: "communication", text: "不舒服的事情可以直接说，而不用靠猜或冷战" },
    { dim: "boundary", text: "家人会先征求意见，再介入彼此的个人决定" },
    { dim: "responsibility", text: "照顾、家务和经济责任应当被清楚讨论" },
    { dim: "autonomy", text: "即使选择不同，家人也应尊重彼此的人生方向" },
    { dim: "cohesion", text: "重要时刻有人在场，比表面的热闹更重要" },
    { dim: "communication", text: "家里应该允许表达脆弱，而不被嘲笑或指责" },
    { dim: "boundary", text: "亲密关系里也应该保留隐私和独处空间" },
    { dim: "responsibility", text: "答应家人的事情应该尽量做到" },
    { dim: "autonomy", text: "爱不应该以服从为前提" },
    { dim: "cohesion", text: "家人之间的支持应当包括实际行动，而不只是口头关心" },
    { dim: "communication", text: "发生冲突后，愿意回来修复比假装没事更重要" },
    { dim: "boundary", text: "家人不应通过愧疚感来迫使彼此答应要求" },
    { dim: "responsibility", text: "承担更多的人也应该有权表达疲惫和需要" },
    { dim: "autonomy", text: "成年人有权决定自己的伴侣、工作和生活方式" },
    { dim: "cohesion", text: "即使不常联系，也应让彼此知道需要时可以求助" },
    { dim: "communication", text: "家人之间应该说清期待，而不是把“你应该懂”当作规则" },
    { dim: "boundary", text: "关心一个人不代表可以替他做所有决定" },
    { dim: "responsibility", text: "家庭里的付出需要被看见，而不是被当作理所当然" },
    { dim: "autonomy", text: "家庭和睦不意味着所有人必须想法一致" },
  ],
  likert: ["非常不符合", "比较不符合", "不确定", "比较符合", "非常符合"],
};

const CONFIGS: Record<AssessmentKind, AssessmentConfig> = {
  holland: HOLLAND,
  bigfive: BIG_FIVE,
  strength: STRENGTH,
  love: LOVE,
  family: FAMILY,
};

export function assessmentConfig(kind: AssessmentKind): AssessmentConfig {
  return CONFIGS[kind];
}

/* ============ MBTI ============ */

export const MBTI_TYPES = [
  "ISTJ", "ISFJ", "INFJ", "INTJ",
  "ISTP", "ISFP", "INFP", "INTP",
  "ESTP", "ESFP", "ENFP", "ENTP",
  "ESTJ", "ESFJ", "ENFJ", "ENTJ",
];
