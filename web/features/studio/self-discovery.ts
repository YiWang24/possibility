/**
 * 「喜欢 × 擅长」完整探索题库。
 *
 * 题目采用产品化原创表达：兴趣 WHAT、优势动作 HOW、外部证据、环境 CONTEXT、
 * 价值判断与开放叙事共同生成结论；不复刻任何书籍或商业量表的原题。
 */

export type DiscoveryAxis = "like" | "skill" | "evidence" | "environment" | "choice" | "value" | "open";
export type DiscoveryKind = "interest" | "strength" | "select" | "environment" | "choice" | "open";

export interface DiscoveryOption { label: string; tag: string; glyph: string; }
export interface DiscoveryQuestion {
  id: string;
  axis: DiscoveryAxis;
  kind: DiscoveryKind;
  eyebrow: string;
  title: string;
  hint: string;
  tag?: string;
  options?: DiscoveryOption[];
  left?: string;
  right?: string;
}

export interface DiscoveryAnswer {
  selected: string[];
  custom: string[];
  like?: number;
  skill?: number;
  scale?: number;
  text?: string;
}

export interface RankedTag { tag: string; count: number; score?: number; }
export interface InterestProfile { tag: string; like: number; }
export interface StrengthProfile {
  tag: string;
  like: number;
  skill: number;
  zone: "天赋热爱区" | "兴趣潜力区" | "熟练消耗区" | "非优先区";
}
export interface DiscoveryInsight { label: string; evidence: string; reason: string; }
export interface DiscoveryDirection { title: string; why: string; first_step: string; }
export interface SelfDiscoveryAnalysis {
  summary: string;
  likes: DiscoveryInsight[];
  strengths: DiscoveryInsight[];
  directions: DiscoveryDirection[];
  confidence_note: string;
}

const icon = (index: number) => ["◎", "◌", "↗", "✦", "◇", "♡", "▦", "◈", "☼"][index % 9];
const interestThemes = [
  ["人与心理", ["我会自然想知道：一个人为什么会这样想、这样感受、这样选择？", "心理、人格、自我成长或人际关系的内容，常让我持续看下去。"]],
  ["社会与文化", ["热点事件出现后，我会想理解背后的群体、时代或社会机制。", "我喜欢比较不同群体、文化和生活方式的差异。"]],
  ["商业与市场", ["看到流行产品时，我会好奇：它为什么能被人选择或付费？", "新的商业模式、消费趋势或创业故事容易吸引我。"]],
  ["科技与未来", ["新技术出现时，我会主动想了解它能改变什么。", "我常会想象：技术继续发展后，人会怎样生活。"]],
  ["生命与自然", ["我会对人体、健康、生命机制或自然规律产生持续好奇。", "动植物、环境与生命科学的内容容易让我投入。"]],
  ["艺术与审美", ["我会不自觉观察画面、空间、产品或文字的美感。", "看到优秀作品时，我会想：如果由我来做，怎样会更好？"]],
  ["知识与思想", ["遇到感兴趣的问题时，我会一路查下去，而不只满足于结论。", "哲学、历史、理论或科学解释，容易让我长时间沉浸。"]],
  ["系统与效率", ["遇到混乱流程时，我会想把它重新整理得更清楚。", "理解复杂系统如何运转、怎样更有效率，会让我感到有趣。"]],
  ["生活与体验", ["我会主动研究怎样让日常生活变得更有趣、更舒服。", "美食、旅行、运动、空间或新的生活体验中，总有让我投入的领域。"]],
] as const;

const strengthActions = [
  ["探索求知", ["面对陌生问题时，我会主动找资料、追根究底。", "别人得到答案后，我常还会继续追问为什么。"]],
  ["分析洞察", ["面对零散信息时，我比较容易发现规律或问题本质。", "别人讨论表面问题时，我常能想到隐藏的原因。"]],
  ["创意构想", ["同一个问题，我通常能很快想到不止一种可能。", "听到一个想法后，我常会自然联想到新的做法。"]],
  ["结构设计", ["别人说了很多零散信息后，我能较快整理出框架。", "面对复杂任务时，我会自然拆出目标、限制与步骤。"]],
  ["表达呈现", ["我比较容易把复杂内容解释到别人能理解。", "我会自然思考怎样讲、写或呈现才能让人接受。"]],
  ["共情理解", ["别人没有明说时，我有时也能察觉他真正介意什么。", "发生冲突时，我通常能理解不同的人各自在担心什么。"]],
  ["教导赋能", ["看到别人不会一件事时，我会自然想到怎样教他。", "别人因为我的解释突然理解一个问题，会让我有满足感。"]],
  ["连接协作", ["我比较容易想到：这件事可以找谁一起做。", "在陌生群体中，我能够比较自然地建立连接。"]],
  ["影响推动", ["当我相信一件事值得做时，我会想办法争取支持。", "我不排斥说服、谈判或让别人对一件事产生兴趣。"]],
  ["组织统筹", ["很多事情同时出现时，我通常知道应先处理什么。", "多人协作时，我会自然关注时间、人员与资源安排。"]],
  ["执行推进", ["讨论足够以后，我会很快转向下一步具体做什么。", "长期任务中，我比较容易持续推进直到完成。"]],
  ["实践制作", ["比起一直讨论，我更容易通过先做一个版本找到答案。", "面对工具、实物、空间或真实操作时，我往往更有感觉。"]],
  ["优化精进", ["一个东西已经能用时，我还是会发现它可以改进的地方。", "重复做同一件事时，我会自然寻找更快、更准或更好的方法。"]],
] as const;

const strengthOptions: DiscoveryOption[] = strengthActions.map(([label], index) => ({ label, tag: label, glyph: icon(index) }));
const valueOptions: DiscoveryOption[] = [
  ["自由与创造", "✦"], ["成长与求真", "◎"], ["关怀与连接", "♡"], ["秩序与清晰", "▦"], ["影响与担当", "↗"], ["真实与实践", "◇"],
].map(([label, glyph]) => ({ label, tag: label, glyph }));

const evidencePrompts = [
  "哪类事情即使没人教，你也比较容易知道怎么做？",
  "哪类事情你通常练习几次，就能明显进步？",
  "别人最经常因为什么事情来找你帮忙？",
  "在学习、工作和生活中，哪些行为反复成为你的优势？",
];

const environmentPairs = [
  ["独立完成", "高频协作"], ["深度投入", "多任务切换"], ["稳定明确", "变化探索"], ["幕后分析创造", "台前表达影响"], ["自主定义方法", "清晰标准要求"],
  ["长期积累", "即时反馈"], ["专业深度", "综合统筹"], ["低频社交", "高频社交"], ["确定性", "不确定探索"], ["个人成果", "帮助他人"],
] as const;

const forcedChoices = [
  ["深入研究一个复杂问题", "快速把一个想法做出来"], ["帮一个人真正解决问题", "影响很多人接受一个观点"], ["从 0 到 1 想新方案", "把已有方案做到非常好"],
  ["自己深入思考", "和很多人讨论碰撞"], ["找规律和原因", "创造新的表达"], ["规划全局", "亲自推进执行"],
] as const;

const openPrompts = [
  "小时候没有人要求你时，你最容易沉迷什么？",
  "过去几年，有哪三件事让你觉得“虽然累，但做完特别满足”？",
  "别人最经常因为什么事情找你帮忙？请举一个真实例子。",
  "你最容易对别人产生哪种“这有什么难的？”的感觉？",
  "如果未来一年不考虑赚钱和别人怎么看，你最想系统探索哪三件事？",
] as const;

export const DISCOVERY_QUESTIONS: DiscoveryQuestion[] = [
  ...interestThemes.flatMap(([tag, prompts], themeIndex) => prompts.map((title, statementIndex) => ({
    id: `interest-${themeIndex + 1}-${statementIndex + 1}`, axis: "like" as const, kind: "interest" as const,
    eyebrow: `兴趣主题 · ${String(themeIndex + 1).padStart(2, "0")} / 09`, title, hint: "按真实投入感评分：1 完全没兴趣，5 即使没人要求也愿意持续投入时间。", tag,
  }))),
  ...strengthActions.flatMap(([tag, prompts], actionIndex) => prompts.map((title, statementIndex) => ({
    id: `strength-${actionIndex + 1}-${statementIndex + 1}`, axis: "skill" as const, kind: "strength" as const,
    eyebrow: `优势动作 · ${String(actionIndex + 1).padStart(2, "0")} / 13`, title, hint: "同一件事分别评价：你是否享受，以及它是否是自然、可复用的优势。", tag,
  }))),
  ...evidencePrompts.map((title, index) => ({
    id: `evidence-${index + 1}`, axis: "evidence" as const, kind: "select" as const, eyebrow: `外部证据 · E${index + 1}`,
    title, hint: "最多选 3 项。它们会用来交叉验证，而不是只听你对自己的判断。", options: strengthOptions,
  })),
  ...environmentPairs.map(([left, right], index) => ({
    id: `environment-${index + 1}`, axis: "environment" as const, kind: "environment" as const, eyebrow: `发挥环境 · ${String(index + 1).padStart(2, "0")} / 10`,
    title: "哪一端更接近让你稳定发挥的状态？", hint: "不是选择更好的一端，而是选择你更可持续的工作与学习方式。", left, right,
  })),
  ...forcedChoices.map(([left, right], index) => ({
    id: `choice-${index + 1}`, axis: "choice" as const, kind: "choice" as const, eyebrow: `取舍判断 · ${String(index + 1).padStart(2, "0")} / 06`,
    title: "如果只能选一种，你更愿意？", hint: "必须选择一项。它帮助结果在接近时形成更清晰的优先级。", options: [{ label: left, tag: left, glyph: "A" }, { label: right, tag: right, glyph: "B" }],
  })),
  {
    id: "value-contribution", axis: "value", kind: "select", eyebrow: "价值判断 · 想带来的影响", title: "你希望自己的投入最终为谁带来什么？", hint: "最多选 3 项。它不会改变你的喜欢和擅长，只帮助判断方向是否值得。", options: valueOptions,
  },
  {
    id: "value-boundary", axis: "value", kind: "select", eyebrow: "价值判断 · 不愿妥协", title: "看到什么状态时，你最容易感到不舒服？", hint: "最多选 3 项。它会提示你长期选择中的边界。", options: valueOptions,
  },
  ...openPrompts.map((title, index) => ({
    id: `open-${index + 1}`, axis: "open" as const, kind: "open" as const, eyebrow: `真实叙事 · ${String(index + 1).padStart(2, "0")} / 05`,
    title, hint: "写下 1–3 句真实经历。AI 会提取主题词、动作词、能量词与外界证据，而不是只做文本摘要。",
  })),
];

export const DISCOVERY_FIXED_COUNT = DISCOVERY_QUESTIONS.filter((question) => question.kind !== "open").length;

function answersFor(axis: DiscoveryAxis, answers: Record<string, DiscoveryAnswer>) {
  return DISCOVERY_QUESTIONS.filter((question) => question.axis === axis).map((question) => [question, answers[question.id]] as const);
}

export function rankedTags(axis: DiscoveryAxis, answers: Record<string, DiscoveryAnswer>, limit = 3): RankedTag[] {
  const scores = new Map<string, number>();
  const add = (tag: string, score: number) => scores.set(tag, (scores.get(tag) ?? 0) + score);
  for (const [question, answer] of answersFor(axis, answers)) {
    if (!answer) continue;
    if (axis === "like" && question.tag) add(question.tag, answer.like ?? 0);
    if (axis === "skill" && question.tag) add(question.tag, answer.skill ?? 0);
    if (axis === "evidence" || axis === "value" || axis === "choice") {
      for (const label of answer.selected) add(question.options?.find((item) => item.label === label)?.tag ?? label, axis === "evidence" ? 2 : 1);
    }
  }
  return [...scores.entries()].sort((a, b) => b[1] - a[1]).slice(0, limit).map(([tag, score]) => ({ tag, count: Math.round(score), score }));
}

export function interestProfiles(answers: Record<string, DiscoveryAnswer>): InterestProfile[] {
  const grouped = new Map<string, number[]>();
  for (const [question, answer] of answersFor("like", answers)) {
    if (!question.tag || !answer?.like) continue;
    grouped.set(question.tag, [...(grouped.get(question.tag) ?? []), answer.like]);
  }
  return [...grouped.entries()]
    .map(([tag, scores]) => ({ tag, like: Number((scores.reduce((sum, score) => sum + score, 0) / scores.length).toFixed(1)) }))
    .sort((a, b) => b.like - a.like);
}

export function strengthProfiles(answers: Record<string, DiscoveryAnswer>): StrengthProfile[] {
  const grouped = new Map<string, Array<{ like: number; skill: number }>>();
  for (const [question, answer] of answersFor("skill", answers)) {
    if (!question.tag || !answer?.like || !answer.skill) continue;
    grouped.set(question.tag, [...(grouped.get(question.tag) ?? []), { like: answer.like, skill: answer.skill }]);
  }
  return [...grouped.entries()].map(([tag, scores]) => {
    const like = Number((scores.reduce((sum, score) => sum + score.like, 0) / scores.length).toFixed(1));
    const skill = Number((scores.reduce((sum, score) => sum + score.skill, 0) / scores.length).toFixed(1));
    const zone: StrengthProfile["zone"] = like >= 3.5
      ? skill >= 3.5 ? "天赋热爱区" : "兴趣潜力区"
      : skill >= 3.5 ? "熟练消耗区" : "非优先区";
    return { tag, like, skill, zone };
  }).sort((a, b) => (b.like + b.skill) - (a.like + a.skill));
}

export function energySignals(answers: Record<string, DiscoveryAnswer>) {
  return answersFor("skill", answers).filter(([, answer]) => answer?.like && answer.like >= 4)
    .sort(([, a], [, b]) => (b?.like ?? 0) - (a?.like ?? 0)).map(([question]) => question.tag ?? "").filter(Boolean).filter((item, index, list) => list.indexOf(item) === index).slice(0, 3);
}

export function environmentSignals(answers: Record<string, DiscoveryAnswer>) {
  return answersFor("environment", answers).map(([question, answer]) => {
    if (!answer?.scale) return "";
    if (answer.scale === 3) return `${question.left} / ${question.right}`;
    return answer.scale < 3 ? question.left ?? "" : question.right ?? "";
  }).filter(Boolean).slice(0, 3);
}

export function rankedWithCustom(axis: DiscoveryAxis, answers: Record<string, DiscoveryAnswer>) {
  const ranked = rankedTags(axis, answers, 3);
  const defaults: Record<DiscoveryAxis, string[]> = {
    like: ["继续观察投入感", "寻找主动靠近的主题", "记录持续好奇的内容"], skill: ["继续收集他人反馈", "复盘自然行动模式", "记录低耗能的成功"],
    evidence: ["记录他人反馈", "复盘重复行为", "观察跨场景优势"], environment: ["观察发挥条件", "记录环境边界", "寻找适配节奏"],
    choice: ["继续做取舍", "用真实行动验证", "避免平均用力"], value: ["继续澄清价值排序", "记录重要选择", "观察不愿妥协之处"], open: ["补充真实经历", "记录能量变化", "回看外部反馈"],
  };
  const seen = new Set(ranked.map((item) => item.tag));
  for (const tag of defaults[axis]) { if (!seen.has(tag)) ranked.push({ tag, count: 1 }); if (ranked.length === 3) break; }
  return ranked.slice(0, 3);
}

function insight(item: RankedTag, axis: "like" | "skill") : DiscoveryInsight {
  const repeat = Math.max(1, Math.round(item.score ? item.score / 5 : item.count));
  return {
    label: item.tag,
    evidence: axis === "like" ? `在 ${repeat} 组兴趣强度回答中持续靠前` : `在优势双评分与外部证据中反复出现`,
    reason: axis === "like" ? "这说明它更像会让你主动靠近和持续投入的主题，而不只是当前身份或职业。" : "它同时考虑了自然程度、投入感与他人反馈，更接近可复用的优势动作。",
  };
}

export function localAnalysis(answers: Record<string, DiscoveryAnswer>): SelfDiscoveryAnalysis {
  const likes = rankedWithCustom("like", answers);
  const strengths = rankedWithCustom("skill", answers);
  const values = rankedWithCustom("value", answers);
  const energy = energySignals(answers);
  const context = environmentSignals(answers);
  const likeInsights = likes.map((item) => insight(item, "like"));
  const strengthInsights = strengths.map((item) => insight(item, "skill"));
  return {
    summary: `你的注意力更容易回到${likes.map((item) => item.tag).join("、")}，面对问题时则习惯用${strengths.map((item) => item.tag).join("、")}来推进。`,
    likes: likeInsights,
    strengths: strengthInsights,
    directions: likes.map((like, index) => {
      const strength = strengths[index % strengths.length]?.tag ?? "你的优势";
      const kind = ["职业", "副业", "兴趣"][index];
      return {
        title: `${kind}实验：用${strength}探索${like.tag}`,
        why: `它同时回应兴趣主题、优势动作，并靠近“${values[0]?.tag ?? "你重视的价值"}”。${energy.length ? ` 你会更容易从“${energy.slice(0, 2).join("、")}”中获得能量。` : ""}`,
        first_step: `这一周完成一个有关“${like.tag}”、能使用“${strength}”的小任务，并记录投入感、成果与外部反馈。${context.length ? ` 尽量放在“${context.slice(0, 2).join("、")}”的环境中进行。` : ""}`,
      };
    }),
    confidence_note: "这是一份基于兴趣强度、优势双评分、外部证据、环境偏好和真实叙事生成的行动假设；完成 30 天实验后回看，结论会更可靠。",
  };
}

export function analysisRequest(answers: Record<string, DiscoveryAnswer>): Record<string, unknown> {
  return {
    responses: DISCOVERY_QUESTIONS.map((question) => ({
      id: question.id, axis: question.axis, kind: question.kind, question: question.title, tag: question.tag,
      left: question.left, right: question.right, response: answers[question.id] ?? { selected: [], custom: [] },
    })),
    evidence: { likes: rankedTags("like", answers, 9), strengths: rankedTags("skill", answers, 13), values: rankedTags("value", answers, 6), energy: energySignals(answers), environment: environmentSignals(answers) },
  };
}

export function isSelfDiscoveryAnalysis(value: unknown): value is SelfDiscoveryAnalysis {
  if (!value || typeof value !== "object") return false;
  const data = value as Partial<SelfDiscoveryAnalysis>;
  const validInsights = (items: unknown) => Array.isArray(items) && items.length === 3 && items.every((item) => item && typeof item === "object" && typeof (item as DiscoveryInsight).label === "string" && typeof (item as DiscoveryInsight).evidence === "string" && typeof (item as DiscoveryInsight).reason === "string");
  const validDirections = Array.isArray(data.directions) && data.directions.length === 3 && data.directions.every((item) => item && typeof item === "object" && typeof (item as DiscoveryDirection).title === "string" && typeof (item as DiscoveryDirection).why === "string" && typeof (item as DiscoveryDirection).first_step === "string");
  return typeof data.summary === "string" && typeof data.confidence_note === "string" && validInsights(data.likes) && validInsights(data.strengths) && validDirections;
}
