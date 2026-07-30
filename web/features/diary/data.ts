/* 语音日记数据与派生 —— 移植 iOS DiaryData.swift / DiaryModel.swift。
   demo 底座（2026年7月，文案照抄）+ 今日云端真实条目覆盖；月/年总结真实优先、失败回退 demo。 */

import { emotionEmoji } from "@/lib/emotions";

export interface DiaryNote {
  date: string; // "2026-07-01"
  label: string; // "7月1日 · 周三"
  emoji: string;
  emotion: string;
  duration: string;
  title: string;
  keywords: string[];
  transcript: string[];
}

/** 日期中的「日」数字（"2026-07-22" → 22） */
export function dayNumber(date: string): number {
  return Number.parseInt(date.slice(-2), 10) || 0;
}

/** label 中的周几（"7月22日 · 周三" → "周三"），今天固定显示「今天」 */
export function weekday(note: DiaryNote): string {
  if (note.date === TODAY_DATE) return "今天";
  const parts = note.label.split("·");
  return parts[parts.length - 1]?.trim() || "记录";
}

/* ============ 日期工具（对齐 iOS SupabaseTimestamp） ============ */

const WEEK_CN = ["日", "一", "二", "三", "四", "五", "六"];

/** 本地时区 "yyyy-MM-dd" */
export function dayString(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/** "M月d日 · 周x" */
export function diaryLabel(date: Date): string {
  return `${date.getMonth() + 1}月${date.getDate()}日 · 周${WEEK_CN[date.getDay()]}`;
}

/** created_at（ISO8601 / 无时区兜底）→ Date；不认识返回 null */
export function parseTimestamp(raw?: string | null): Date | null {
  if (!raw) return null;
  const normalized = raw.replace(" ", "T");
  const d = new Date(normalized);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** 今天（客户端本地时区）。SSR 阶段回退到 demo 最近日期，避免水合不一致 */
export const TODAY_DATE =
  typeof window === "undefined" ? "2026-07-23" : dayString(new Date());

/** 当前月 ref（UTC，对齐服务端聚合边界）："2026-07" */
export function currentMonthRef(): string {
  const now = new Date();
  return `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}`;
}

/** 当前年 ref（UTC）："2026" */
export function currentYearRef(): string {
  return String(new Date().getUTCFullYear());
}

/* ============ 后端 wire 类型 ============ */

/** list-diary entries 元素 */
export interface RemoteDiaryEntry {
  id: number;
  transcript?: string | null;
  emotions?: string[] | null;
  keywords?: string[] | null;
  created_at: string;
}

export interface ListDiaryResponse {
  entries: RemoteDiaryEntry[];
  total: number;
}

/** diary-summary 出参（按月/年聚合 + LLM 洞察） */
export interface DiarySummaryResponse {
  period: string;
  ref: string;
  entry_count: number;
  top_emotions: string[];
  top_keywords: string[];
  insight: string;
  highlights: string[];
}

/** 远端行 → DiaryNote（真实表无标题/时长等富字段，做合理降级） */
export function noteFromRemote(row: RemoteDiaryEntry): DiaryNote | null {
  const transcript = row.transcript?.trim();
  if (!transcript) return null;
  const date = parseTimestamp(row.created_at) ?? new Date();
  const firstSentence =
    transcript.split(/[。！？!?\n]/).find((s) => s.trim().length > 0) ?? transcript;
  const emotions = row.emotions ?? [];
  return {
    date: dayString(date),
    label: diaryLabel(date),
    emoji: emotionEmoji(emotions[0], "🎙"),
    emotion: emotions.length ? emotions.join("，") : "已记录",
    duration: "--:--",
    title: firstSentence.slice(0, 24),
    keywords: row.keywords ?? [],
    transcript: transcript.split("\n").filter((line) => line.trim().length > 0),
  };
}

/* ============ demo 条目（对照原型 DIARY_ENTRIES，文案照抄） ============ */

export const DIARY_ENTRIES: DiaryNote[] = [
  {
    date: "2026-07-01",
    label: "7月1日 · 周三",
    emoji: "😶",
    emotion: "忙碌，感觉自己只是在完成任务",
    duration: "1:28",
    title: "这个月刚开始，我却已经有点疲惫",
    keywords: ["工作重复", "精力不足", "七月愿望"],
    transcript: [
      "今天连续开了四个会，事情都完成了，但说不上有什么成就感。我希望这个月不只是把待办清空，也能认真看看自己为什么越来越想换一个位置。",
    ],
  },
  {
    date: "2026-07-02",
    label: "7月2日 · 周四",
    emoji: "😐",
    emotion: "克制，心里有很多比较",
    duration: "1:54",
    title: "看见同龄人转岗成功，第一反应还是怀疑自己",
    keywords: ["同龄人比较", "转岗案例", "自我怀疑"],
    transcript: [
      "刷到以前同事转去做产品的消息，我替她高兴，也忍不住比较。后来提醒自己，我看到的是结果，不是她中间两年的准备。与其继续比较，不如找机会问问她真实经历。",
    ],
  },
  {
    date: "2026-07-03",
    label: "7月3日 · 周五",
    emoji: "🙂",
    emotion: "好奇，重新出现一点动力",
    duration: "2:12",
    title: "第一次认真拆解 AI 产品经理到底在做什么",
    keywords: ["岗位研究", "AI产品", "能力差距"],
    transcript: [
      "今天把三个 AI 产品经理的招聘描述放在一起看，发现不是我以为的只写需求。模型边界、数据反馈和业务判断都很重要。我缺的东西很多，但用户理解和原型沟通并不是从零开始。",
    ],
  },
  {
    date: "2026-07-05",
    label: "7月5日 · 周日",
    emoji: "😮‍💨",
    emotion: "焦虑，又怕自己学得太慢",
    duration: "2:36",
    title: "买了新课程，却没有因此更安心",
    keywords: ["课程焦虑", "学习计划", "害怕落后"],
    transcript: [
      "晚上又买了一门课，付款的时候觉得自己在前进，打开目录以后反而更焦虑。课程很多，时间却没有变多。我需要先明确想验证什么，再决定学哪一部分。",
    ],
  },
  {
    date: "2026-07-06",
    label: "7月6日 · 周一",
    emoji: "😌",
    emotion: "专注，事情开始变具体",
    duration: "1:45",
    title: "把课程目录删到只剩当前需要的四节",
    keywords: ["学习减法", "明确目标", "可执行"],
    transcript: [
      "今天没有追求学完整门课，只看了和需求判断、指标设计有关的四节。完成以后第一次觉得学习不是囤积，而是在为一个真实问题服务。",
    ],
  },
  {
    date: "2026-07-08",
    label: "7月8日 · 周三",
    emoji: "🙂",
    emotion: "受到启发，也更现实",
    duration: "2:18",
    title: "访谈了一位从设计转产品的前同事",
    keywords: ["从业者访谈", "内部转岗", "真实困难"],
    transcript: [
      "她说最难的不是不会写 PRD，而是从为体验负责变成同时为业务结果和协作推进负责。她建议我先在现在的项目里多承担一次目标定义，而不是急着换 title。",
    ],
  },
  {
    date: "2026-07-09",
    label: "7月9日 · 周四",
    emoji: "😕",
    emotion: "受挫，担心自己没有机会",
    duration: "1:39",
    title: "主动提出参与产品讨论，却没有得到回应",
    keywords: ["主动争取", "暂时受挫", "机会焦虑"],
    transcript: [
      "我给项目负责人发了消息，希望旁听下一次产品讨论，暂时没有回复。很容易把沉默理解成拒绝，但也可能只是对方在忙。明天我会补一句更具体的参与理由。",
    ],
  },
  {
    date: "2026-07-10",
    label: "7月10日 · 周五",
    emoji: "😊",
    emotion: "被看见，行动有了回音",
    duration: "1:58",
    title: "负责人同意我参加下周的需求评审",
    keywords: ["需求评审", "跨角色参与", "小机会"],
    transcript: [
      "今天收到回复，可以参加需求评审，还让我提前看看用户反馈。机会比想象中小，但也更真实。我想观察产品经理如何决定不做什么，而不只是记录他们做了什么。",
    ],
  },
  {
    date: "2026-07-12",
    label: "7月12日 · 周日",
    emoji: "😌",
    emotion: "安静，开始整理自己的判断",
    duration: "2:27",
    title: "复盘后发现，我真正喜欢的是定义问题",
    keywords: ["项目复盘", "定义问题", "职业线索"],
    transcript: [
      "整理过去三个项目时发现，最让我投入的时刻不是把界面磨得更漂亮，而是大家还没说清问题时，我通过访谈和结构梳理让方向变清楚。这可能是我想靠近产品工作的原因。",
    ],
  },
  {
    date: "2026-07-13",
    label: "7月13日 · 周一",
    emoji: "😐",
    emotion: "理性，但仍担心现实成本",
    duration: "1:51",
    title: "算了一遍如果转岗降薪，我能承受多久",
    keywords: ["现金流", "降薪预期", "风险边界"],
    transcript: [
      "我把房租、保险和每月固定支出都列了出来。如果降薪百分之二十，生活不会立刻失控，但需要减少旅行和冲动消费。数字没有替我做决定，却让“风险”不再是一团模糊的恐惧。",
    ],
  },
  {
    date: "2026-07-15",
    label: "7月15日 · 周三",
    emoji: "🙂",
    emotion: "踏实，开始接受循序渐进",
    duration: "2:05",
    title: "不再要求自己用一次跳槽证明转型决心",
    keywords: ["内部机会", "渐进转型", "停止证明"],
    transcript: [
      "以前总觉得真正想转型就应该辞职、全力投入。现在更愿意先争取内部项目，看看自己是否喜欢长期承担产品结果。渐进并不代表不勇敢，它可能更适合现在的我。",
    ],
  },
  {
    date: "2026-07-16",
    label: "7月16日 · 周四",
    emoji: "😌",
    emotion: "平静，知道明天可以做什么",
    duration: "1:43",
    title: "给自己定下一个六周验证周期",
    keywords: ["六周实验", "行动节奏", "复盘节点"],
    transcript: [
      "接下来六周，我会完成两次从业者访谈、参与一次 AI 共创，并把现在的项目补上产品判断。六周后再回来看，而不是每天都重新问一次要不要转岗。",
    ],
  },
  {
    date: "2026-07-17",
    label: "7月17日 · 周五",
    emoji: "🙂",
    emotion: "轻松，也有一点期待",
    duration: "1:36",
    title: "终于把一直拖着的作品集重新打开了",
    keywords: ["作品集重启", "小步开始", "周末计划"],
    transcript: [
      "今天下班后本来很累，但还是把作品集文件打开了。没有逼自己全部改完，只是重新整理了两个项目的顺序，意外地没有想象中那么难。",
      "我发现真正卡住我的不是能力，而是总想一次做到最好。这个周末先把第一个项目讲清楚，也许就够了。",
    ],
  },
  {
    date: "2026-07-18",
    label: "7月18日 · 周六",
    emoji: "😮‍💨",
    emotion: "疲惫，需要慢下来",
    duration: "2:08",
    title: "身体在提醒我，最近把自己逼得太紧",
    keywords: ["睡眠不足", "停止内耗", "允许休息"],
    transcript: [
      "昨晚又两点才睡，早上起来头很沉。我一直说想转岗，却把每个空闲时刻都安排成学习，好像只要停下来就会落后。",
      "下午没有继续看课程，去公园走了一圈。休息以后反而更能分清楚：我需要的是稳定地行动，不是持续惩罚自己。",
    ],
  },
  {
    date: "2026-07-19",
    label: "7月19日 · 周日",
    emoji: "😊",
    emotion: "被支持，心里很亮",
    duration: "1:52",
    title: "和朋友聊完，第一次觉得转岗不是孤军奋战",
    keywords: ["朋友支持", "转岗可能性", "真实反馈"],
    transcript: [
      "今天和阿梨吃饭，她听我讲完想做 AI 产品的原因，没有直接劝我辞职，也没有说我想太多。她只是问：如果半年后还没尝试，我会不会后悔。",
      "这句话让我轻松了一点。我不需要今天就证明选择正确，只需要为自己争取一次真实尝试的机会。",
    ],
  },
  {
    date: "2026-07-20",
    label: "7月20日 · 周一",
    emoji: "😐",
    emotion: "平静，但有些迟疑",
    duration: "2:21",
    title: "工作照常推进，心里却一直在问下一步",
    keywords: ["项目复盘", "成长停滞", "职业方向"],
    transcript: [
      "今天评审很顺利，大家也认可我的方案。但散会之后并没有特别开心，反而更确定自己已经熟悉这套工作方式。",
      "我不是讨厌设计，只是不想未来几年都只优化同一种问题。产品工作是否真的适合我，还需要更多证据。",
    ],
  },
  {
    date: "2026-07-21",
    label: "7月21日 · 周二",
    emoji: "🙂",
    emotion: "踏实，重新找回掌控感",
    duration: "1:47",
    title: "把转岗拆成了三个可以验证的小实验",
    keywords: ["行动清单", "AI产品", "低风险试错"],
    transcript: [
      "我列了三个小实验：跟一个产品经理做访谈、把现在的设计项目补一页产品判断、周末参加一次 AI 产品共创。",
      "这样想以后，转岗不再是辞职或者留下的二选一。我可以先收集证据，再决定要不要真正换赛道。",
    ],
  },
  {
    date: "2026-07-22",
    label: "7月22日 · 周三",
    emoji: "😌",
    emotion: "平静中带一点犹豫",
    duration: "2:34",
    title: "导师没有替我做决定，但让我看见真正担心的事",
    keywords: ["转岗的决定", "导师沟通40分钟", "最近睡得晚"],
    transcript: [
      "今天和导师聊了四十分钟。我说担心转产品以后积累归零，也担心留在设计岗位会越来越没有新鲜感。导师没有告诉我该选哪边，只问我更想解决什么类型的问题。",
      "我发现自己真正想要的不是一个更体面的职位，而是更靠近判断、策略和推动事情发生的位置。今晚还是有点犹豫，但已经知道下一步要验证什么了。",
    ],
  },
];

/* ============ 月度 / 年度总结（静态 demo） ============ */

export interface Stat {
  value: string;
  label: string;
}
export interface Insight {
  cap: string | null;
  title: string;
  body: string;
}
export interface EmotionBar {
  label: string;
  value: number;
}
export interface YearNode {
  period: string;
  title: string;
  body: string;
}

export const MONTH_SUMMARY = {
  cap: "JULY IN VOICE · 2026年7月",
  headline: "这个月，你从“必须马上决定”\n走向了“先用行动收集答案”",
  body: "焦虑没有完全消失，但它不再只是反复盘旋，而是逐渐被拆成访谈、共创和项目复盘等可以验证的下一步。",
  stats: [
    { value: "18", label: "记录天数" },
    { value: "46m", label: "语音时长" },
    { value: "52", label: "提取关键词" },
  ] as Stat[],
  emotionBars: [
    { label: "1–6日", value: 0.58 },
    { label: "7–12日", value: 0.42 },
    { label: "13–18日", value: 0.51 },
    { label: "19–23日", value: 0.76 },
  ] as EmotionBar[],
  themes: ["# 转岗选择 · 9次", "# 睡眠与精力 · 6次", "# 被支持 · 5次", "# 低风险尝试 · 4次"],
  insights: [
    {
      cap: "最明显的变化",
      title: "从寻找标准答案，到设计自己的验证过程",
      body: "月初你频繁问“哪条路更正确”，月末开始谈论访谈、共创和可回退的小实验。",
    },
    {
      cap: "值得照顾的信号",
      title: "睡眠不足常出现在职业焦虑最强的几天",
      body: "当你试图一次解决所有问题时，休息会最先被牺牲。稳定节奏可能比追加学习时间更重要。",
    },
  ] as Insight[],
};

export const YEAR_SUMMARY = {
  cap: "YOUR 2026 · 年度声音",
  headline: "这一年，你在练习把人生\n从“证明自己”还给“选择自己”",
  body: "工作的熟练带来认可，也带来停滞感。你开始允许自己不立刻跳走，而是先靠近真正感兴趣的问题。",
  stats: [
    { value: "143", label: "记录天数" },
    { value: "6.8h", label: "语音时长" },
    { value: "428", label: "提取关键词" },
  ] as Stat[],
  keywords: ["# 职业转向", "# 自我认可", "# 真实尝试", "# 关系支持", "# 生活节奏", "# 不再硬撑"],
  nodes: [
    {
      period: "1–3月 · 察觉",
      title: "“我做得很好，为什么还是不满足？”",
      body: "对成长停滞的感受第一次被反复说出来。",
    },
    {
      period: "4–5月 · 拉扯",
      title: "在稳定与新可能之间反复比较",
      body: "你很想改变，又担心积累清零，语音中的自我质疑达到高点。",
    },
    {
      period: "6月 · 求证",
      title: "开始向真实的人和项目靠近",
      body: "导师、朋友和行业访谈成为新的信息来源。",
    },
    {
      period: "7月至今 · 行动",
      title: "把“大决定”拆成可回退的小实验",
      body: "焦虑仍在，但行动感和掌控感明显回升。",
    },
  ] as YearNode[],
  letter: {
    cap: null,
    title: "不必因为仍在犹豫，就否定已经发生的改变",
    body: "年初的你只敢想象另一条路；现在的你已经在用访谈、作品和共创靠近它。答案不只出现在某个决定里，也出现在你逐渐形成的行动方式里。",
  } as Insight,
};
