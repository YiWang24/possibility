"use client";
/* 卡面图标语义表 —— 移植自 iOS Core/DesignSystem/CardIcon.swift。
 *
 * lab-choices 的选择卡按问题现生成，glyph 交给模型自由发挥拿回来的是彩色 emoji，
 * 字重/光学尺寸/配色全不受控。这里把图标收敛成一份有限语义表：服务端只给语义键，
 * 端上统一用单色描边 SVG 渲染，并按 currentColor 着色（配合点缀色）。
 * 模型给不出合法键时（含历史 emoji 数据）按中文关键词兜底。 */
import type { ReactNode } from "react";

export type CardIconKey =
  | "stay"
  | "deepen"
  | "pivot"
  | "retreat"
  | "explore"
  | "experiment"
  | "learn"
  | "build"
  | "create"
  | "leap"
  | "connect"
  | "speak"
  | "relocate"
  | "rest"
  | "pause"
  | "observe"
  | "timing"
  | "hybrid"
  | "balance"
  | "secure"
  | "money"
  | "home"
  | "health"
  | "custom"
  | "unknown";

export const CARD_ICON_KEYS: CardIconKey[] = [
  "stay",
  "deepen",
  "pivot",
  "retreat",
  "explore",
  "experiment",
  "learn",
  "build",
  "create",
  "leap",
  "connect",
  "speak",
  "relocate",
  "rest",
  "pause",
  "observe",
  "timing",
  "hybrid",
  "balance",
  "secure",
  "money",
  "home",
  "health",
  "custom",
  "unknown",
];

/** 中文关键词兜底表（词要够长以避免误伤，同 iOS）。 */
const KEYWORDS: Record<CardIconKey, string[]> = {
  stay: ["留在", "留下", "维持现状", "保持现状", "按兵不动", "原地", "坚守", "守住", "现有岗位", "不换"],
  deepen: ["深耕", "精进", "打磨", "专精", "钻研", "沉淀", "积累", "做深", "扎根", "内功"],
  pivot: ["转岗", "转型", "转行", "换赛道", "跳槽", "换方向", "调岗", "换岗", "转做", "切换到", "换一条"],
  retreat: ["退回", "止损", "撤回", "退出", "保留退路", "回到原", "回头", "放弃"],
  explore: ["调研", "打听", "摸底", "探索", "考察", "访谈", "搜集", "问清", "了解清楚"],
  experiment: ["试验", "实验", "小步", "试水", "验证", "试点", "跑通", "先试", "试一", "小规模", "原型"],
  learn: ["学习", "进修", "补课", "读书", "考证", "上课", "培训", "自学", "课程", "念书"],
  build: ["搭建", "动手", "开发", "落地", "做出", "从零做", "工程化", "写代码"],
  create: ["创作", "设计", "写作", "作品", "创造", "策展", "表达自己"],
  leap: ["全力", "孤注", "梭哈", "放手一搏", "破釜", "彻底转", "一次性", "重注", "下决心"],
  connect: ["人脉", "内推", "社群", "圈子", "合作", "搭档", "团队", "伙伴", "引荐", "牵线", "认识人"],
  speak: ["沟通", "协商", "争取", "谈一谈", "提出", "对话", "反馈", "摊牌", "说清楚"],
  relocate: ["换城市", "异地", "出国", "远程", "外派", "搬到", "去外地", "迁移"],
  rest: ["休息", "休整", "恢复", "放慢", "慢下来", "调整节奏", "喘口气", "减负", "间隔年"],
  pause: ["暂缓", "暂停", "缓一", "先不", "推迟", "延后", "搁置", "等等再"],
  observe: ["观望", "先看", "再看看", "静观", "观察", "不表态", "等信号"],
  timing: ["时机", "窗口期", "再等", "熬过", "期限", "倒计时", "时间换"],
  hybrid: ["混合", "兼职", "副业", "跨界", "双线", "并行", "两边都", "同时做", "复合"],
  balance: ["平衡", "取舍", "权衡", "折中", "兼顾", "分配精力"],
  secure: ["保底", "稳住", "兜底", "底线", "保障", "稳定", "备份", "抗风险"],
  money: ["收入", "薪资", "涨薪", "降薪", "现金", "储蓄", "财务", "预算", "成本", "养家"],
  home: ["家庭", "家人", "父母", "孩子", "伴侣", "陪伴", "生育", "婚"],
  health: ["健康", "身体", "体力", "睡眠", "精力", "锻炼", "透支"],
  custom: [],
  unknown: [],
};

/** 关键词命中最长者胜：「转岗体验」取更具体的那个。 */
export function matchText(text: string): CardIconKey | null {
  let best: { icon: CardIconKey; length: number } | null = null;
  for (const icon of CARD_ICON_KEYS) {
    for (const word of KEYWORDS[icon]) {
      if (text.includes(word) && (!best || word.length > best.length)) {
        best = { icon, length: word.length };
      }
    }
  }
  return best?.icon ?? null;
}

/** 标题命中优先于描述（标题写的是这张卡的意图）。 */
export function matchTitleDesc(title: string, desc: string): CardIconKey | null {
  return matchText(title) ?? matchText(desc);
}

/** 服务端语义键 → 图标；键不合法（含历史 emoji）时按文案做关键词兜底。 */
export function resolveIcon(key: string | null | undefined, title: string, desc: string): CardIconKey {
  const normalized = key?.trim().toLowerCase();
  if (normalized && (CARD_ICON_KEYS as string[]).includes(normalized)) {
    return normalized as CardIconKey;
  }
  return matchTitleDesc(title, desc) ?? "unknown";
}

/* ============ 图标字形（24×24 单色描边 SVG，stroke=currentColor） ============ */

const PATHS: Record<CardIconKey, ReactNode> = {
  stay: (
    <>
      <path d="M12 21c4-4.5 6-7.6 6-10.5A6 6 0 0 0 6 10.5C6 13.4 8 16.5 12 21Z" />
      <circle cx="12" cy="10.5" r="2.2" />
    </>
  ),
  deepen: (
    <>
      <path d="M4 8l8-4 8 4-8 4-8-4Z" />
      <path d="M4 12l8 4 8-4" />
      <path d="M4 16l8 4 8-4" />
    </>
  ),
  pivot: (
    <>
      <path d="M6 3v6a3 3 0 0 0 3 3h9" />
      <path d="M15 9l3 3-3 3" />
      <path d="M6 21v-4" />
    </>
  ),
  retreat: (
    <>
      <path d="M9 14 4 9l5-5" />
      <path d="M4 9h9a7 7 0 0 1 7 7v4" />
    </>
  ),
  explore: (
    <>
      <circle cx="11" cy="11" r="6" />
      <path d="M20 20l-4.3-4.3" />
    </>
  ),
  experiment: (
    <>
      <path d="M9 3h6" />
      <path d="M10 3v6l-5 8a2 2 0 0 0 1.8 3h10.4A2 2 0 0 0 19 17l-5-8V3" />
      <path d="M7.5 14h9" />
    </>
  ),
  learn: (
    <>
      <path d="M4 5.5A2 2 0 0 1 6 4h5v15H6a2 2 0 0 0-2 1.5Z" />
      <path d="M20 5.5A2 2 0 0 0 18 4h-5v15h5a2 2 0 0 1 2 1.5Z" />
    </>
  ),
  build: (
    <>
      <path d="M14 7l3-3 3 3-3 3-3-3Z" />
      <path d="M15.5 8.5 5 19l-2-2L13.5 6.5" />
    </>
  ),
  create: (
    <>
      <path d="M4 20c0-3 2-4 4-4 2 0 3 1 3 3 0 1.5-1.3 2-3 2-2 0-4-.5-4-1Z" />
      <path d="M11 15 19 7a2 2 0 0 0-3-3l-8 8" />
    </>
  ),
  leap: <path d="M13 2 4 14h6l-1 8 9-12h-6l1-8Z" />,
  connect: (
    <>
      <circle cx="8" cy="8" r="3" />
      <circle cx="17" cy="10" r="2.5" />
      <path d="M3 20c0-3 2.5-5 5-5s5 2 5 5" />
      <path d="M14 20c0-2 1.5-3.5 3-3.5s3 1.3 3 3.5" />
    </>
  ),
  speak: (
    <>
      <path d="M4 5h11a2 2 0 0 1 2 2v4a2 2 0 0 1-2 2H9l-4 3v-3H4a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1Z" />
    </>
  ),
  relocate: (
    <>
      <path d="M3 12l17-7-5 16-3-6-6-3Z" />
    </>
  ),
  rest: (
    <>
      <path d="M20 4c-8 0-13 4-13 10a5 5 0 0 0 5 5c6 0 9-6 8-15Z" />
      <path d="M11 13c2-2 4-3 6-3" />
    </>
  ),
  pause: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M10 9v6M14 9v6" />
    </>
  ),
  observe: (
    <>
      <path d="M2 12s4-6 10-6 10 6 10 6-4 6-10 6-10-6-10-6Z" />
      <circle cx="12" cy="12" r="2.5" />
    </>
  ),
  timing: (
    <>
      <path d="M6 3h12M6 21h12" />
      <path d="M7 3c0 5 5 6 5 9 0-3 5-4 5-9" />
      <path d="M7 21c0-5 5-6 5-9 0 3 5 4 5 9" />
    </>
  ),
  hybrid: (
    <>
      <path d="M9 4a2 2 0 0 1 4 0c0 1 .5 1.5 1.5 1.5H17a1 1 0 0 1 1 1v2.5c0 1 .5 1.5 1.5 1.5a2 2 0 0 1 0 4c-1 0-1.5.5-1.5 1.5V19a1 1 0 0 1-1 1h-2.5c-1 0-1.5.5-1.5 1.5a2 2 0 0 1-4 0c0-1-.5-1.5-1.5-1.5H5a1 1 0 0 1-1-1v-2.5C4 15.5 3.5 15 2.5 15" />
    </>
  ),
  balance: (
    <>
      <path d="M12 4v16" />
      <path d="M5 8h14" />
      <path d="M5 8 2.5 14a2.5 2.5 0 0 0 5 0L5 8Z" />
      <path d="M19 8l-2.5 6a2.5 2.5 0 0 0 5 0L19 8Z" />
      <path d="M8 20h8" />
    </>
  ),
  secure: (
    <>
      <path d="M12 3 5 6v5c0 4.5 3 8 7 10 4-2 7-5.5 7-10V6l-7-3Z" />
      <path d="M9 12l2 2 4-4" />
    </>
  ),
  money: (
    <>
      <rect x="3" y="6" width="18" height="12" rx="2" />
      <circle cx="12" cy="12" r="2.5" />
      <path d="M6 9v6M18 9v6" />
    </>
  ),
  home: (
    <>
      <path d="M4 11 12 4l8 7" />
      <path d="M6 10v9h12v-9" />
    </>
  ),
  health: (
    <path d="M12 20C6 16 3 12.5 3 9a4.5 4.5 0 0 1 9-1 4.5 4.5 0 0 1 9 1c0 3.5-3 7-9 11Z" />
  ),
  custom: (
    <>
      <path d="M4 20h16" />
      <path d="M14 5l4 4L8 19H4v-4L14 5Z" />
    </>
  ),
  unknown: <circle cx="12" cy="12" r="8.5" strokeDasharray="4 4" />,
};

/** 无底衬图标（正文行内 / 拖拽浮标），颜色跟随 currentColor。 */
export function CardIconMark({
  icon,
  size = 14,
  strokeWidth = 1.8,
}: {
  icon: CardIconKey;
  size?: number;
  strokeWidth?: number;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      {PATHS[icon] ?? PATHS.unknown}
    </svg>
  );
}

/** 卡面图标徽章：圆角方 + 点缀色底衬（对齐 iOS CardIconChip）。 */
export function CardIconChip({
  icon,
  accent = "#5E96FF",
  size = 27,
  emphasized = false,
}: {
  icon: CardIconKey;
  accent?: string;
  size?: number;
  emphasized?: boolean;
}) {
  return (
    <div
      className="flex items-center justify-center"
      style={{
        width: size,
        height: size,
        borderRadius: size / 3,
        color: accent,
        background: withAlpha(accent, emphasized ? 0.2 : 0.12),
        border: `1px solid ${withAlpha(accent, emphasized ? 0.5 : 0.24)}`,
      }}
    >
      <CardIconMark icon={icon} size={size * 0.52} strokeWidth={1.9} />
    </div>
  );
}

/** #RRGGBB → rgba()（仅供徽章底衬用） */
function withAlpha(hex: string, alpha: number): string {
  const m = hex.trim().match(/^#?([0-9a-f]{6})$/i);
  if (!m) return hex;
  const n = parseInt(m[1], 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${alpha})`;
}
