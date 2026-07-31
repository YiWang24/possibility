/* 卡牌游戏数据 —— 1:1 移植自 iOS CardGameData.swift（原型 LIFE_BASE_CARDS / LIFE_STAGES / RELATIONSHIP_CARDS / VALUE_CARD_GAMES） */

import type {
  CardGameCatalog,
  CardGameRules,
} from "@possibility/shared-types";

export const CARD_GAME_KINDS = ["life", "marriage", "family", "social"] as const;
export type CardGameKind = string;

/* 结果写入的画像维度（life 走人生底牌签名） */
export function targetDimension(kind: CardGameKind): string | null {
  switch (kind) {
    case "life":
      return null;
    case "marriage":
      return "love";
    case "family":
      return "family";
    case "social":
      return "social";
    default:
      return kind;
  }
}

export interface GameCard {
  id: string;
  name: string;
  glyph: string;
  group: string;
  copy: string;
}

export interface GameScenario {
  key?: string;
  title: string;
  copy: string;
  theme: string;
  severity: number;
}

export interface CardGameConfig {
  kind: CardGameKind;
  title: string;
  eyebrow: string;
  introTitle: string;
  introCopy: string;
  rules: [string, string][];
  selectTitle: string;
  cardPrefix: string;
  /** 压力等级 1–4 的名称与文案 */
  severityMeta: { name: string; copy: string }[];
  pressureLabel: string;
  cards: GameCard[];
  /** 情境池：life 按已交换次数分 3 轮；其余单池 */
  scenarioRounds: GameScenario[][];
  /** 结果分组文案（top group → copy） */
  groupCopy: Record<string, string>;
  /** 主题色 */
  accent: string;
  glyph: string;
  /** 是否包含内容提示 */
  contentWarning?: string;
  /** Server catalog metadata. Absent only for the built-in emergency fallback. */
  catalogVersion?: number;
  contentHash?: string;
  engineKey?: string;
  dynamicRules?: CardGameRules;
  stageMeta?: {
    age: string;
    name: string;
    activateAfterTrades: number;
  }[];
  sourceCatalog?: CardGameCatalog;
}

export function scenariosForTradeCount(config: CardGameConfig, traded: number): GameScenario[] {
  return config.scenarioRounds[Math.min(traded, config.scenarioRounds.length - 1)];
}

function card(id: string, name: string, glyph: string, group: string, copy = ""): GameCard {
  return { id, name, glyph, group, copy };
}

/* ============ 人生卡牌 ============ */

export const lifeBaseCards: GameCard[] = [
  card("family", "亲情", "⌂", "关系"),
  card("friend", "知心挚友", "☍", "关系"),
  card("lover", "相濡以沫的恋人", "♡", "关系"),
  card("confidence", "信心", "↗", "内在力量"),
  card("kindness", "善良", "♧", "价值原则"),
  card("talent", "才华", "✦", "能力行动"),
  card("iq", "智商", "◇", "能力行动"),
  card("trust", "信任", "∞", "关系"),
  card("forgive", "原谅的勇气", "◌", "价值原则"),
  card("provide", "养家的能力", "▣", "现实支点"),
  card("strong", "坚强", "▲", "内在力量"),
  card("loveAbility", "爱人的能力", "♥", "关系"),
  card("justice", "正义感", "⚖", "价值原则"),
  card("looks", "颜值", "✧", "外部认可"),
  card("mentor", "伯乐", "◎", "外部认可"),
  card("eq", "情商", "≈", "能力行动"),
  card("health", "健康", "＋", "现实支点"),
  card("pet", "爱宠", "♢", "关系"),
];

/** severity 按原型 lifeEventSeverity 正则 */
export function lifeEventSeverity(title: string): number {
  const s4 = ["被拐卖", "犯罪入狱", "自杀未遂", "遭遇家暴", "阿尔茨海默", "植物人", "白发人送黑发人"];
  const s3 = ["破产", "病重", "至亲离世", "先天身体缺陷", "车祸", "无家可归", "疾病缠身", "身无分文", "妻离子散", "长期住院", "晚年拾荒"];
  const s2 = ["爱宠离世", "被同学欺负", "校园霸凌", "恋人背叛", "十年没有工作", "地下室", "糟糕的婚姻", "网暴", "家产被骗", "职场霸凌", "孤身一人", "子女不管"];
  if (s4.some((w) => title.includes(w))) return 4;
  if (s3.some((w) => title.includes(w))) return 3;
  if (s2.some((w) => title.includes(w))) return 2;
  return 1;
}

function lifeScenario(title: string, copy: string, theme: string): GameScenario {
  return { title, copy, theme, severity: lifeEventSeverity(title) };
}

const lifeStage01: GameScenario[] = [
  lifeScenario("家庭经济破产", "原本安稳的家庭突然失去经济来源。", "家庭安全"),
  lifeScenario("父母经常吵架", "家里长期充满争吵与紧张。", "家庭安全"),
  lifeScenario("成绩长期倒数", "无论怎样努力，成绩总在最后。", "自我评价"),
  lifeScenario("经常被父母贬低", "重要的家人很少肯定你。", "自我评价"),
  lifeScenario("爱宠离世", "陪伴你的宠物离开了。", "失去陪伴"),
  lifeScenario("被同学欺负", "成长中长期遭到同龄人欺负。", "社会关系"),
  lifeScenario("先天身体缺陷", "出生时便需要面对身体限制。", "健康"),
  lifeScenario("被拐卖", "你被迫离开熟悉的家庭与环境。", "家庭安全"),
  lifeScenario("被孤立", "你被排除在同龄人的圈子之外。", "社会关系"),
  lifeScenario("考不上大学", "你没能进入期待的大学。", "成就"),
  lifeScenario("家人病重", "重要的家人在此时患上重病。", "家庭安全"),
  lifeScenario("作弊被抓", "一次错误选择让你失去他人的信任。", "社会评价"),
  lifeScenario("犯罪入狱", "一次严重错误改变了人生轨迹。", "自由"),
  lifeScenario("至亲离世", "你不得不提前面对重要亲人的离开。", "失去陪伴"),
  lifeScenario("在校被造谣", "关于你的恶意传言在校园扩散。", "社会评价"),
  lifeScenario("遭遇校园霸凌", "你长期遭受来自同龄人的伤害。", "社会关系"),
];

const lifeStage02: GameScenario[] = [
  lifeScenario("恋人背叛", "最亲密的人违背了彼此的承诺。", "亲密关系"),
  lifeScenario("容貌变差", "外貌发生了让你难以接受的改变。", "自我评价"),
  lifeScenario("十年没有工作", "长期无法获得稳定的工作机会。", "成就"),
  lifeScenario("一直没有伴侣", "很长时间都没有建立亲密关系。", "亲密关系"),
  lifeScenario("遭遇车祸", "一次事故改变了原有的生活节奏。", "健康"),
  lifeScenario("长期住地下室", "你只能长期住在逼仄的空间里。", "现实安全"),
  lifeScenario("挣不到钱", "付出很多，却始终无法获得足够收入。", "现实安全"),
  lifeScenario("进入糟糕的婚姻", "婚姻没有成为想象中的支持。", "亲密关系"),
  lifeScenario("遭遇网暴", "大量陌生人持续攻击和否定你。", "社会评价"),
  lifeScenario("无家可归", "你失去了稳定居住的地方。", "现实安全"),
  lifeScenario("疾病缠身", "身体状况长期影响你的生活。", "健康"),
  lifeScenario("身无分文", "你失去了几乎全部经济积累。", "现实安全"),
  lifeScenario("被裁员", "你突然失去了赖以稳定的工作。", "成就"),
  lifeScenario("妻离子散", "原本的家庭关系彻底破裂。", "家庭安全"),
  lifeScenario("家产被骗", "多年积累因欺骗而失去。", "信任"),
  lifeScenario("职场霸凌", "工作中长期遭到打压和排挤。", "社会关系"),
  lifeScenario("自杀未遂", "你经历了一段极端痛苦的低谷。", "生命意义"),
  lifeScenario("遭遇家暴", "最亲近的关系带来了持续伤害。", "亲密关系"),
];

const lifeStage03: GameScenario[] = [
  lifeScenario("患阿尔茨海默病", "记忆和熟悉的人事物逐渐离你而去。", "健康"),
  lifeScenario("子女啃老", "子女长期依赖你的积蓄生活。", "家庭责任"),
  lifeScenario("孤身一人", "晚年身边没有亲近的人陪伴。", "失去陪伴"),
  lifeScenario("成为植物人", "你失去了自主表达和行动的能力。", "自主性"),
  lifeScenario("长期住院", "余下的生活大部分在医院度过。", "健康"),
  lifeScenario("子女不管", "需要照顾时，子女没有陪在身边。", "家庭关系"),
  lifeScenario("白发人送黑发人", "你要面对晚辈先于自己离开。", "失去陪伴"),
  lifeScenario("晚年拾荒", "你需要靠拾荒维持生活。", "现实安全"),
];

/** life 三轮阶段信息（age, name） */
export const lifeRoundMeta: { age: string; name: string }[] = [
  { age: "0–20 岁", name: "成长之初" },
  { age: "21–40 岁", name: "扎根承担" },
  { age: "人生后半程", name: "回望余生" },
];

const life: CardGameConfig = {
  kind: "life",
  title: "人生卡牌",
  eyebrow: "LIFE CARDS",
  introTitle: "当人生不断要求交换\n你最后会留下什么？",
  introCopy:
    "从 18 张人生底牌中选出 9 张，持续经历命运事件。接受会保留底牌，但下一轮事件会加重；拒绝则固定交换 2 张，直到自然只剩 3 张。",
  rules: [
    ["选择 9 张人生底牌", "它们是你希望带着走完一生的能力、关系与信念。"],
    ["接受后，命运继续加码", "连续接受会让下一轮事件从普通、加压一路升级到极限抉择。"],
    ["拒绝一次，固定交换两张", "每次拒绝都放下两张；不额外补选，直到手中自然只剩三张。"],
  ],
  selectTitle: "你想带着什么出发？",
  cardPrefix: "LIFE",
  severityMeta: [
    { name: "普通波动", copy: "命运先从日常的不确定开始试探。" },
    { name: "持续加压", copy: "你选择接住上一轮，新的处境变得更棘手。" },
    { name: "重大冲击", copy: "连续接受正在把人生推向更难回避的转折。" },
    { name: "极限抉择", copy: "命运已经加码到极限，接下来仍由你决定接受或交换。" },
  ],
  pressureLabel: "命运压力",
  cards: lifeBaseCards,
  scenarioRounds: [lifeStage01, lifeStage02, lifeStage03],
  groupCopy: {
    关系: "重要关系与稳定的情感连接",
    内在力量: "依靠自己重新站起来的能力",
    能力行动: "理解问题并把事情做成的能力",
    价值原则: "即使困难也不愿违背的原则",
    现实支点: "健康与照顾生活的现实能力",
    外部认可: "被看见、被欣赏与获得机会",
  },
  accent: "#8F7BFF",
  glyph: "◇",
  contentWarning:
    "内容提示：游戏包含疾病、家庭冲突、暴力与死亡等敏感情境。它不是心理诊断，结果默认仅自己可见。",
  stageMeta: lifeRoundMeta.map((stage, index) => ({
    ...stage,
    activateAfterTrades: index,
  })),
};

/* ============ 婚姻卡牌 ============ */

const marriage: CardGameConfig = {
  kind: "marriage",
  title: "婚姻卡牌",
  eyebrow: "MARRIAGE CARDS",
  introTitle: "当婚姻不断要求取舍\n你最后会守住什么？",
  introCopy:
    "先选出 9 张婚姻底牌，再持续面对婚姻情境。接受会保留底牌，但下一轮压力会加重；不接受则交换 2 张，直到自然剩下最关心的 3 点。",
  rules: [
    ["选择 9 张婚姻底牌", "从安全、连接、自主、现实与未来中凭直觉选择。"],
    ["接受后，情境继续加码", "连续接受会从日常磨合逐渐进入关系低谷。"],
    ["不接受，就交换 2 张", "每次固定放下两张，直到自然留下最重要的三张。"],
  ],
  selectTitle: "婚姻中，你最想守住什么？",
  cardPrefix: "MARRIAGE",
  severityMeta: [
    { name: "日常磨合", copy: "先从婚姻中常见但可协商的差异开始。" },
    { name: "持续拉扯", copy: "你选择接受，新的情境开始触及长期生活安排。" },
    { name: "重要分歧", copy: "连续接受让选择进入事业、家庭与未来规划。" },
    { name: "关系低谷", copy: "情境已经触及信任与婚姻能否继续的核心。" },
  ],
  pressureLabel: "婚姻压力",
  cards: [
    card("trust", "彼此信任", "∞", "安全", "不用反复证明，也相信对方不会轻易离开"),
    card("response", "及时回应", "◉", "安全", "重要时刻不失联，让需要被明确接住"),
    card("stability", "稳定陪伴", "⌁", "安全", "不只在热烈时靠近，也愿意长期在场"),
    card("honesty", "坦诚沟通", "“”", "连接", "不靠猜测维持关系，愿意把真实说出来"),
    card("understand", "情绪被理解", "≈", "连接", "先看见感受，再急着处理问题"),
    card("intimacy", "亲密表达", "♡", "连接", "愿意表达喜欢、依赖与身体上的靠近"),
    card("space", "尊重边界", "◌", "自主", "亲密不等于侵入，彼此仍有自己的空间"),
    card("choice", "允许不同", "↔", "自主", "可以有不同意见、节奏与人生选择"),
    card("repair", "愿意修复", "↻", "成长", "冲突后不冷处理，愿意回来重新连接"),
    card("growth", "共同成长", "↗", "成长", "互相支持成为更完整的自己"),
    card("loyalty", "忠诚承诺", "◇", "安全", "把彼此放进长期选择，不轻易越过共同约定"),
    card("money", "经济共识", "◎", "现实", "对收入、消费、储蓄和风险有可协商的共识"),
    card("chores", "生活分工", "▦", "现实", "家务与照顾责任不默认落在一个人身上"),
    card("families", "家庭边界", "⌂", "现实", "面对双方家庭时，伴侣关系有清晰的共同边界"),
    card("children", "生育共识", "○", "未来", "是否生育、如何养育，都能诚实讨论并共同决定"),
    card("future", "共同目标", "✦", "未来", "愿意把城市、事业与生活方式放进同一张未来地图"),
    card("admiration", "彼此欣赏", "❋", "连接", "熟悉以后仍能看见对方的光，而不只看见不足"),
    card("selfhood", "保留自我", "△", "自主", "进入婚姻后仍保有朋友、兴趣和独立的精神世界"),
  ],
  scenarioRounds: [
    [
      { title: "重要约定临时落空", copy: "对方因为工作连续取消两次重要约定，并希望你再体谅一次。", theme: "承诺", severity: 1 },
      { title: "生活节奏越来越不同", copy: "一个人需要规律与计划，另一个人更习惯随性决定，日常摩擦开始增加。", theme: "生活", severity: 1 },
      { title: "争吵后需要长时间独处", copy: "每次冲突后，对方都需要几天才能重新沟通，而你更想当下把问题说开。", theme: "沟通", severity: 1 },
      { title: "收入差距逐渐扩大", copy: "一方的收入和资源快速增长，关系里的付出、话语权与消费方式开始失衡。", theme: "经济", severity: 2 },
      { title: "双方家庭频繁介入", copy: "父母不断参与住房、节日与生活安排，你们很难形成属于两个人的边界。", theme: "家庭", severity: 2 },
      { title: "长期异地成为常态", copy: "未来三年很难生活在同一座城市，见面、陪伴与个人发展需要重新排序。", theme: "距离", severity: 2 },
      { title: "事业机会只能支持一方", copy: "一份重要机会要求全家迁居，另一方也必须放下正在上升的事业路径。", theme: "选择", severity: 3 },
      { title: "生育决定出现分歧", copy: "对是否要孩子、什么时候要孩子，你们的答案开始走向不同方向。", theme: "未来", severity: 3 },
      { title: "照顾责任突然变重", copy: "双方父母都需要长期照顾，时间、金钱与情绪容量同时受到挤压。", theme: "责任", severity: 3 },
      { title: "信任出现明显裂缝", copy: "你发现对方长期隐瞒一件重要的事，解释并不足以立刻恢复安全感。", theme: "信任", severity: 4 },
      { title: "冲突变成持续回避", copy: "你们已经很久无法谈论真正的问题，表面平静，内心距离却越来越远。", theme: "修复", severity: 4 },
      { title: "婚姻进入重大低谷", copy: "长期压力让亲密、信任与共同目标同时动摇，你们必须决定如何继续。", theme: "关系", severity: 4 },
    ],
  ],
  groupCopy: {
    安全: "你最先确认的，是这段关系是否可靠、持续、能够接住彼此。",
    连接: "对你来说，被理解和真实靠近比表面上的和平更重要。",
    自主: "你需要的是不以失去自己为代价的亲密，尊重会让你更愿意靠近。",
    成长: "你看重关系面对问题后的变化能力，而不只是一开始是否合拍。",
    现实: "你关注婚姻能否真正承载生活，责任与边界需要被具体协商。",
    未来: "你在意的不只是当下相爱，也在意两个人能否走向同一个未来。",
  },
  accent: "#E35CC1",
  glyph: "♡",
};

/* ============ 家庭卡牌 ============ */

const family: CardGameConfig = {
  kind: "family",
  title: "家庭卡牌",
  eyebrow: "FAMILY CARDS",
  introTitle: "当家庭不断要求取舍\n你最后会守住什么？",
  introCopy:
    "先选出 9 张家庭底牌，再持续面对家庭情境。接受会保留底牌并提高下一轮压力；不接受则交换 2 张，直到自然剩下最关心的 3 点。",
  rules: [
    ["选择 9 张家庭底牌", "从安全、边界、支持、沟通、自主与责任中凭直觉选择。"],
    ["接受后，情境继续加码", "连续接受会从日常磨合逐渐进入家庭危机。"],
    ["不接受，就交换 2 张", "每次固定放下两张，直到自然留下最重要的三张。"],
  ],
  selectTitle: "在家庭关系中，你最想守住什么？",
  cardPrefix: "FAMILY",
  severityMeta: [
    { name: "日常磨合", copy: "先从家庭里常见的节奏与边界差异开始。" },
    { name: "持续拉扯", copy: "新的情境开始触及分工、经济与伴侣边界。" },
    { name: "重大责任", copy: "连续接受让选择进入照顾、发展与家庭安全。" },
    { name: "家庭危机", copy: "情境已经触及控制、疾病与关系能否继续。" },
  ],
  pressureLabel: "家庭压力",
  cards: [
    card("health", "健康平安", "＋", "安全"),
    card("respect", "互相尊重", "◇", "边界"),
    card("support", "有事一起承担", "∞", "支持"),
    card("talk", "坦诚沟通", "“”", "沟通"),
    card("understand", "被理解", "≈", "沟通"),
    card("boundary", "清晰边界", "◌", "边界"),
    card("choice", "允许不同选择", "↔", "自主"),
    card("presence", "重要时刻在场", "◉", "支持"),
    card("money", "经济安全", "◎", "安全"),
    card("fairness", "公平分工", "▦", "责任"),
    card("partner", "尊重彼此伴侣", "♡", "边界"),
    card("elders", "照顾长辈", "⌂", "责任"),
    card("contact", "保持联系", "⌁", "支持"),
    card("vulnerable", "能表达脆弱", "▽", "沟通"),
    card("noGuilt", "不用愧疚控制", "△", "自主"),
    card("promise", "说到做到", "✓", "责任"),
    card("harmony", "家庭和睦", "❋", "安全"),
    card("self", "保留自我", "✦", "自主"),
  ],
  scenarioRounds: [
    [
      { title: "节日安排出现分歧", copy: "双方都希望你按自己的方式过节，你需要在陪伴与个人安排之间协调。", theme: "相处", severity: 1 },
      { title: "家人联系频率不同", copy: "有人希望每天联系，有人更习惯各自生活，彼此开始误读这种距离。", theme: "联系", severity: 1 },
      { title: "个人决定被频繁追问", copy: "家人出于关心不断询问你的工作、伴侣与生活计划。", theme: "边界", severity: 1 },
      { title: "家庭付出开始失衡", copy: "同一个人长期承担更多家务、情绪安抚与联络责任，却很少被看见。", theme: "分工", severity: 2 },
      { title: "亲属提出经济请求", copy: "一笔不小的家庭支出需要你支持，但它会明显影响自己的生活计划。", theme: "经济", severity: 2 },
      { title: "伴侣与父母意见冲突", copy: "最亲近的两方都希望你明确站在自己这边，关系边界变得紧张。", theme: "边界", severity: 2 },
      { title: "照顾责任突然加重", copy: "一位家人需要长期照料，时间、金钱与个人发展同时被挤压。", theme: "责任", severity: 3 },
      { title: "重要人生选择不被认可", copy: "你的城市、职业或伴侣选择遭到家人持续反对。", theme: "自主", severity: 3 },
      { title: "家庭经济进入低谷", copy: "收入骤减与持续支出让每个人都必须重新分配资源和责任。", theme: "安全", severity: 3 },
      { title: "家人长期用愧疚施压", copy: "爱与责任被反复用来要求服从，你很难在拒绝后保持平静。", theme: "控制", severity: 4 },
      { title: "重大疾病改变家庭结构", copy: "一场长期疾病让照顾、收入与未来安排都需要彻底重组。", theme: "危机", severity: 4 },
      { title: "家庭关系面临破裂", copy: "多年的冲突累积到临界点，有人考虑彻底停止往来。", theme: "修复", severity: 4 },
    ],
  ],
  groupCopy: {
    安全: "你最先确认的，是家庭能否提供稳定、健康与不轻易崩塌的生活基础。",
    边界: "你需要亲近，也需要家人尊重彼此的选择与边界。",
    支持: "对你来说，家人的意义在于重要时刻能够真正出现并共同承担。",
    沟通: "你更在意真实感受能否被说出、听见和理解。",
    自主: "你希望爱不是服从，每个人都能保留自己的道路与完整性。",
    责任: "你看重承诺、分工与照顾能否被公平而具体地落实。",
  },
  accent: "#3ED9A4",
  glyph: "⌂",
};

/* ============ 人际卡牌 ============ */

const social: CardGameConfig = {
  kind: "social",
  title: "人际卡牌",
  eyebrow: "SOCIAL CARDS",
  introTitle: "在人群与关系之间\n你最后会守住什么？",
  introCopy:
    "先选出 9 张人际底牌，再持续面对交往情境。接受会保留底牌并提高下一轮压力；不接受则交换 2 张，直到自然剩下最关心的 3 点。",
  rules: [
    ["选择 9 张人际底牌", "从真诚、边界、连接、支持、轻松与成长中凭直觉选择。"],
    ["接受后，情境继续加码", "连续接受会从日常摩擦逐渐进入信任危机。"],
    ["不接受，就交换 2 张", "每次固定放下两张，直到自然留下最重要的三张。"],
  ],
  selectTitle: "在人际交往中，你最想守住什么？",
  cardPrefix: "SOCIAL",
  severityMeta: [
    { name: "日常摩擦", copy: "先从回应、融入与观点不同开始。" },
    { name: "关系失衡", copy: "新的情境开始触及互惠、信任与边界。" },
    { name: "重要冲突", copy: "连续接受让选择进入竞争、站队与价值差异。" },
    { name: "信任危机", copy: "情境已经触及尊重、归属与关系能否继续。" },
  ],
  pressureLabel: "人际压力",
  cards: [
    card("honesty", "真诚", "◇", "真诚"),
    card("respect", "被尊重", "✦", "边界"),
    card("response", "互相回应", "◉", "连接"),
    card("reciprocity", "有来有往", "↔", "支持"),
    card("safety", "情绪安全", "○", "轻松"),
    card("secret", "保守秘密", "◌", "真诚"),
    card("boundary", "清晰边界", "△", "边界"),
    card("refuse", "允许拒绝", "×", "边界"),
    card("interest", "共同兴趣", "❋", "连接"),
    card("depth", "深度交流", "∞", "连接"),
    card("ease", "轻松自在", "⌁", "轻松"),
    card("contact", "稳定联系", "◎", "支持"),
    card("repair", "冲突修复", "↻", "成长"),
    card("help", "彼此支持", "＋", "支持"),
    card("values", "价值观相近", "≈", "真诚"),
    card("compare", "不被比较", "=", "轻松"),
    card("admire", "被欣赏", "♡", "成长"),
    card("space", "独处空间", "□", "轻松"),
  ],
  scenarioRounds: [
    [
      { title: "消息没有及时回复", copy: "一位重要朋友最近回复变慢，你不知道这是忙碌还是关系正在降温。", theme: "回应", severity: 1 },
      { title: "聚会里被暂时忽略", copy: "大家聊得热烈，你几次想加入却没有被接住。", theme: "融入", severity: 1 },
      { title: "观点出现明显不同", copy: "你和朋友对一件重要议题看法相反，气氛开始变得微妙。", theme: "差异", severity: 1 },
      { title: "付出长期不对等", copy: "你总是主动联系、倾听和帮助，对方却很少回应你的需要。", theme: "互惠", severity: 2 },
      { title: "秘密被转述给别人", copy: "一件只说给朋友听的事，后来出现在共同圈子里。", theme: "信任", severity: 2 },
      { title: "朋友提出越界请求", copy: "对方希望你付出大量时间或资源，并把拒绝理解成不够朋友。", theme: "边界", severity: 2 },
      { title: "共同好友要求你站队", copy: "两位朋友发生严重冲突，都希望你公开支持自己。", theme: "冲突", severity: 3 },
      { title: "重要机会形成竞争", copy: "你和朋友同时争取一个稀缺机会，比较与不安开始进入关系。", theme: "竞争", severity: 3 },
      { title: "价值观差异持续扩大", copy: "曾经亲近的人在重要选择上越来越不同，每次交流都更难自在。", theme: "变化", severity: 3 },
      { title: "关系里长期遭到贬低", copy: "对方不断用玩笑否定你的能力和感受，并说你太敏感。", theme: "尊重", severity: 4 },
      { title: "朋友圈出现集体排斥", copy: "熟悉的圈子开始有意绕开你，解释与修复的空间越来越少。", theme: "归属", severity: 4 },
      { title: "友谊进入信任危机", copy: "隐瞒、站队与失衡同时出现，你必须判断这段关系是否还能继续。", theme: "危机", severity: 4 },
    ],
  ],
  groupCopy: {
    真诚: "你最重视关系里的真实与可信，不愿靠猜测和表面和平维持连接。",
    边界: "你希望人际关系足够亲近，也允许拒绝并尊重彼此的界限。",
    连接: "深度交流与被回应，会让你真正感觉自己在关系之中。",
    支持: "你看重有来有往，关系需要在行动上互相接住。",
    轻松: "你需要的是不必持续证明自己、可以自然呼吸的相处。",
    成长: "你在意关系是否能容纳欣赏、修复与彼此变得更好。",
  },
  accent: "#5E96FF",
  glyph: "◎",
};

const CONFIGS: Record<string, CardGameConfig> = { life, marriage, family, social };

export function cardGameConfig(kind: CardGameKind): CardGameConfig {
  const config = CONFIGS[kind];
  if (!config) throw new Error(`No built-in fallback catalog for ${kind}`);
  return config;
}

export function isCardGameKind(value: string): value is CardGameKind {
  return /^[a-z][a-z0-9_]{0,63}$/.test(value);
}
