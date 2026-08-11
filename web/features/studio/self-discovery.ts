/**
 * “喜欢 × 擅长”探索的数据与本地证据分析。
 *
 * 方法结构参考八木仁平的自我理解框架；题目、选项、标签与计分均为本产品
 * 的原创表达，不复刻书中受版权保护的题目文本。
 */

export type DiscoveryAxis = "like" | "skill" | "value";

export interface DiscoveryOption {
  label: string;
  tag: string;
  glyph: string;
}

export interface DiscoveryQuestion {
  id: string;
  axis: DiscoveryAxis;
  eyebrow: string;
  title: string;
  hint: string;
  options: DiscoveryOption[];
}

export interface DiscoveryAnswer {
  selected: string[];
  custom: string[];
}

export interface RankedTag {
  tag: string;
  count: number;
}

export interface DiscoveryInsight {
  label: string;
  evidence: string;
  reason: string;
}

export interface DiscoveryDirection {
  title: string;
  why: string;
  first_step: string;
}

export interface SelfDiscoveryAnalysis {
  summary: string;
  likes: DiscoveryInsight[];
  strengths: DiscoveryInsight[];
  directions: DiscoveryDirection[];
  confidence_note: string;
}

const q = (
  id: string,
  axis: DiscoveryAxis,
  eyebrow: string,
  title: string,
  hint: string,
  rows: Array<[string, string, string]>,
): DiscoveryQuestion => ({
  id,
  axis,
  eyebrow,
  title,
  hint,
  options: rows.map(([label, tag, glyph]) => ({ label, tag, glyph })),
});

export const DISCOVERY_QUESTIONS: DiscoveryQuestion[] = [
  q(
    "like-pull",
    "like",
    "喜欢的事 · 自然靠近",
    "没有任务和评价时，你会主动靠近什么？",
    "选 1–3 项，也可以写下选项之外的真实答案。",
    [
      ["内容、画面、音乐或故事", "创造与表达", "✦"],
      ["一个值得追到底的问题", "知识与探索", "◎"],
      ["人的经历、感受与关系", "人类与连接", "♡"],
      ["工具、流程与系统如何运作", "系统与优化", "▦"],
      ["社会变化与真实影响", "影响与推动", "↗"],
      ["自然、身体与动手体验", "实践与体验", "◇"],
    ],
  ),
  q(
    "like-flow",
    "like",
    "喜欢的事 · 心流证据",
    "哪些活动曾让你忘记时间？",
    "回想真实发生过的时刻，不选“理想中应该喜欢”的事。",
    [
      ["把想法做成作品", "创造与表达", "✦"],
      ["阅读、研究或拆解原理", "知识与探索", "◎"],
      ["深聊、陪伴或理解别人", "人类与连接", "♡"],
      ["整理、规划或持续改进", "系统与优化", "▦"],
      ["组织大家完成一件事", "影响与推动", "↗"],
      ["制作、运动或走进自然", "实践与体验", "◇"],
    ],
  ),
  q(
    "like-invest",
    "like",
    "喜欢的事 · 投入意愿",
    "你愿意持续把时间或金钱花在哪里？",
    "真正的兴趣通常会留下持续投入的痕迹。",
    [
      ["创作工具、审美与表达训练", "创造与表达", "✦"],
      ["课程、书籍与新知识", "知识与探索", "◎"],
      ["社群、关系与助人体验", "人类与连接", "♡"],
      ["效率工具、方法与系统", "系统与优化", "▦"],
      ["项目、公共议题与行动", "影响与推动", "↗"],
      ["手作、旅行、运动与体验", "实践与体验", "◇"],
    ],
  ),
  q(
    "like-admire",
    "like",
    "喜欢的事 · 羡慕线索",
    "你最容易羡慕哪种人的日常？",
    "羡慕不等于要成为对方，它可能提示你想靠近的内容世界。",
    [
      ["持续输出独特作品的人", "创造与表达", "✦"],
      ["不断发现和解释新知的人", "知识与探索", "◎"],
      ["真正理解并改善他人处境的人", "人类与连接", "♡"],
      ["把复杂事物变得清晰高效的人", "系统与优化", "▦"],
      ["召集别人创造真实变化的人", "影响与推动", "↗"],
      ["以身体和双手探索世界的人", "实践与体验", "◇"],
    ],
  ),
  q(
    "like-learn",
    "like",
    "喜欢的事 · 好奇方向",
    "即使短期没有回报，你仍想学什么？",
    "先把职业名称放在一边，只看你想持续理解的对象。",
    [
      ["叙事、视觉、音乐或设计", "创造与表达", "✦"],
      ["科学、技术、历史或思想", "知识与探索", "◎"],
      ["心理、教育、沟通或关系", "人类与连接", "♡"],
      ["商业、产品、流程或组织", "系统与优化", "▦"],
      ["领导力、社会创新或公共议题", "影响与推动", "↗"],
      ["自然、工艺、运动或生活实践", "实践与体验", "◇"],
    ],
  ),
  q(
    "skill-asked",
    "skill",
    "擅长的事 · 他人证据",
    "别人通常会来找你帮什么忙？",
    "擅长常是你觉得普通、别人却认为可靠的行为方式。",
    [
      ["想点子或打开新角度", "创意生成", "✦"],
      ["快速摸清陌生领域", "快速学习", "◎"],
      ["听懂没被说出口的需要", "共情连接", "♡"],
      ["把混乱信息理出主线", "结构化思考", "▦"],
      ["找到下一步并推动完成", "推动落地", "↗"],
      ["直接动手排查和解决", "实践解决", "◇"],
    ],
  ),
  q(
    "skill-natural",
    "skill",
    "擅长的事 · 自然反应",
    "面对一个混乱问题，你会自然先做什么？",
    "不是问应该怎么做，而是你往往不假思索就会怎么做。",
    [
      ["提出几种不同可能", "创意生成", "✦"],
      ["边做边学并找到规律", "快速学习", "◎"],
      ["理解每个人真正担心什么", "共情连接", "♡"],
      ["拆目标、约束与优先级", "结构化思考", "▦"],
      ["拉齐分工、时间和下一步", "推动落地", "↗"],
      ["先做一个能验证的版本", "实践解决", "◇"],
    ],
  ),
  q(
    "skill-success",
    "skill",
    "擅长的事 · 成功模式",
    "过去做成一件事时，你最常贡献什么？",
    "寻找多次成功背后重复出现的行为，而不只是职位和技能名。",
    [
      ["给出别人没想到的方案", "创意生成", "✦"],
      ["从反馈中迅速学会", "快速学习", "◎"],
      ["让不同的人愿意继续对话", "共情连接", "♡"],
      ["把复杂问题讲清楚", "结构化思考", "▦"],
      ["让卡住的事情重新前进", "推动落地", "↗"],
      ["把问题真正修好或做出来", "实践解决", "◇"],
    ],
  ),
  q(
    "skill-effortless",
    "skill",
    "擅长的事 · 低耗能优势",
    "哪些事你做起来不太费力，却常得到好反馈？",
    "优势不是“永远轻松”，而是相较别人更自然、更容易复现。",
    [
      ["迅速联想到新表达或新方案", "创意生成", "✦"],
      ["短时间抓住新事物重点", "快速学习", "◎"],
      ["察觉气氛并让人安心", "共情连接", "♡"],
      ["归纳信息并清楚表达", "结构化思考", "▦"],
      ["协调资源并按时交付", "推动落地", "↗"],
      ["试出来、修出来、做出来", "实践解决", "◇"],
    ],
  ),
  q(
    "skill-friction",
    "skill",
    "擅长的事 · 过度使用",
    "你最常因为哪种“做得太多”被提醒？",
    "优势用过头也会制造摩擦，这类反馈常藏着可用的能力。",
    [
      ["想法太多、容易跳出原方案", "创意生成", "✦"],
      ["总想再查清楚、再学一点", "快速学习", "◎"],
      ["太在意别人感受", "共情连接", "♡"],
      ["过度分析、追求逻辑完整", "结构化思考", "▦"],
      ["推进太快、总想立即行动", "推动落地", "↗"],
      ["不爱空谈、习惯先动手", "实践解决", "◇"],
    ],
  ),
  q(
    "value-discomfort",
    "value",
    "价值观 · 不适线索",
    "看到什么状态时，你最容易感到不舒服？",
    "这部分帮助 AI 判断你为何喜欢某件事，不会代替“喜欢”和“擅长”的结果。",
    [
      ["表达被限制、没有选择", "自由与创造", "✦"],
      ["停止成长、拒绝求真", "成长与求真", "◎"],
      ["人被忽略、关系缺少理解", "关怀与连接", "♡"],
      ["混乱低效、规则不透明", "秩序与清晰", "▦"],
      ["明知能改变却无人行动", "影响与担当", "↗"],
      ["脱离现实、只有概念没有体验", "真实与实践", "◇"],
    ],
  ),
  q(
    "value-contribution",
    "value",
    "价值观 · 贡献方向",
    "你希望自己的投入最终带来什么？",
    "这会作为组合“喜欢 × 擅长”时的判断标准。",
    [
      ["让人拥有更多表达与选择", "自由与创造", "✦"],
      ["让知识和成长更容易发生", "成长与求真", "◎"],
      ["让人被看见、理解和支持", "关怀与连接", "♡"],
      ["让复杂世界更清晰有序", "秩序与清晰", "▦"],
      ["推动值得发生的真实变化", "影响与担当", "↗"],
      ["创造可触摸、可使用的成果", "真实与实践", "◇"],
    ],
  ),
];

export function rankedTags(
  axis: DiscoveryAxis,
  answers: Record<string, DiscoveryAnswer>,
): RankedTag[] {
  const score = new Map<string, { count: number; order: number }>();
  let order = 0;
  for (const question of DISCOVERY_QUESTIONS.filter((item) => item.axis === axis)) {
    for (const label of answers[question.id]?.selected ?? []) {
      const option = question.options.find((item) => item.label === label);
      if (!option) continue;
      const current = score.get(option.tag);
      score.set(option.tag, {
        count: (current?.count ?? 0) + 1,
        order: current?.order ?? order++,
      });
    }
  }
  return [...score.entries()]
    .sort((a, b) => b[1].count - a[1].count || a[1].order - b[1].order)
    .slice(0, 3)
    .map(([tag, meta]) => ({ tag, count: meta.count }));
}

function localInsight(item: RankedTag, axis: "like" | "skill"): DiscoveryInsight {
  return {
    label: item.tag,
    evidence: `在 ${item.count} 个不同情境中重复出现`,
    reason: axis === "like"
      ? "它多次出现在你的注意力、投入感与主动选择中，值得优先用真实行动验证。"
      : "它多次出现在你的自然反应、他人反馈与成功模式中，可能是可复用的优势。",
  };
}

function rankedWithCustom(
  axis: DiscoveryAxis,
  answers: Record<string, DiscoveryAnswer>,
): RankedTag[] {
  const ranked = rankedTags(axis, answers);
  const seen = new Set(ranked.map((item) => item.tag));
  for (const question of DISCOVERY_QUESTIONS.filter((item) => item.axis === axis)) {
    for (const custom of answers[question.id]?.custom ?? []) {
      const tag = custom.trim().slice(0, 18);
      if (!tag || seen.has(tag)) continue;
      ranked.push({ tag, count: 1 });
      seen.add(tag);
      if (ranked.length === 3) return ranked;
    }
  }
  const defaults = axis === "like"
    ? ["继续观察投入感", "寻找主动靠近的主题", "记录持续好奇的内容"]
    : axis === "skill"
      ? ["继续收集他人反馈", "复盘自然行动模式", "记录低耗能的成功"]
      : ["继续澄清价值排序", "记录重要选择", "观察不愿妥协之处"];
  for (const tag of defaults) {
    if (seen.has(tag)) continue;
    ranked.push({ tag, count: 1 });
    if (ranked.length === 3) break;
  }
  return ranked.slice(0, 3);
}

export function localAnalysis(
  answers: Record<string, DiscoveryAnswer>,
): SelfDiscoveryAnalysis {
  const likes = rankedWithCustom("like", answers);
  const strengths = rankedWithCustom("skill", answers);
  const values = rankedWithCustom("value", answers);
  const likeInsights = likes.map((item) => localInsight(item, "like"));
  const strengthInsights = strengths.map((item) => localInsight(item, "skill"));
  const value = values[0]?.tag ?? "你重视的价值";

  return {
    summary: `你更容易被${likes.map((item) => item.tag).join("、")}吸引，并倾向用${strengths.map((item) => item.tag).join("、")}来解决问题。`,
    likes: likeInsights,
    strengths: strengthInsights,
    directions: likes.map((like, index) => {
      const strength = strengths[index % Math.max(strengths.length, 1)];
      return {
        title: `用${strength?.tag ?? "你的优势"}，去探索${like.tag}`,
        why: `这组组合同时回应了你的兴趣证据，并靠近“${value}”。`,
        first_step: `在一周内完成一个与“${like.tag}”有关、能使用“${strength?.tag ?? "你的优势"}”的小行动。`,
      };
    }),
    confidence_note: "这是基于选择频次生成的初步假设；继续记录真实行动中的投入感和反馈，结论会更准确。",
  };
}

export function analysisRequest(
  answers: Record<string, DiscoveryAnswer>,
): Record<string, unknown> {
  return {
    responses: DISCOVERY_QUESTIONS.map((question) => ({
      id: question.id,
      axis: question.axis,
      question: question.title,
      selected: answers[question.id]?.selected ?? [],
      custom: answers[question.id]?.custom ?? [],
    })),
    evidence: {
      likes: rankedTags("like", answers),
      strengths: rankedTags("skill", answers),
      values: rankedTags("value", answers),
    },
  };
}

export function isSelfDiscoveryAnalysis(value: unknown): value is SelfDiscoveryAnalysis {
  if (!value || typeof value !== "object") return false;
  const data = value as Partial<SelfDiscoveryAnalysis>;
  const validInsights = (items: unknown) => Array.isArray(items) && items.length === 3 &&
    items.every((item) => item && typeof item === "object" &&
      typeof (item as DiscoveryInsight).label === "string" &&
      typeof (item as DiscoveryInsight).evidence === "string" &&
      typeof (item as DiscoveryInsight).reason === "string");
  const validDirections = Array.isArray(data.directions) && data.directions.length === 3 &&
    data.directions.every((item) => item && typeof item === "object" &&
      typeof (item as DiscoveryDirection).title === "string" &&
      typeof (item as DiscoveryDirection).why === "string" &&
      typeof (item as DiscoveryDirection).first_step === "string");
  return typeof data.summary === "string" &&
    typeof data.confidence_note === "string" &&
    validInsights(data.likes) && validInsights(data.strengths) && validDirections;
}
