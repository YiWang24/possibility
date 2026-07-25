// Shared helpers + static summary copy for the 语音日记 detail push.
// Source: prototype renderDiaryDay / renderDiarySummary (~3467–3615).

import { DIARY_ENTRIES, type DiaryEntry } from '@/data/diary';

export type DiaryView = 'day' | 'month' | 'year';

/** Default open date — the newest recorded entry (matches openVoiceDiary fallback). */
export const DEFAULT_DIARY_DATE = DIARY_ENTRIES[DIARY_ENTRIES.length - 1]?.date ?? '2026-07-23';

export function getDiaryEntry(date: string): DiaryEntry | undefined {
  return DIARY_ENTRIES.find((entry) => entry.date === date);
}

export interface RailDate {
  date: string;
  week: string;
  day: string;
  emoji: string;
}

/** Build the horizontal date rail: every entry, plus a "今天" chip for 2026-07-23. */
export function buildRail(): RailDate[] {
  const rail: RailDate[] = DIARY_ENTRIES.map((diary) => ({
    date: diary.date,
    day: String(Number(diary.date.slice(-2))),
    week: diary.label.split('·')[1]?.trim() ?? '记录',
    emoji: diary.emoji,
  }));
  if (!rail.some((item) => item.date === '2026-07-23')) {
    rail.push({ date: '2026-07-23', day: '23', week: '今天', emoji: '·' });
  }
  return [...rail].sort((a, b) => a.date.localeCompare(b.date));
}

/** Archive list — every entry, newest first. */
export function buildArchive(): DiaryEntry[] {
  return [...DIARY_ENTRIES].sort((a, b) => b.date.localeCompare(a.date));
}

/** 24 waveform bar heights (%) seeded per entry (source: diaryWaveHTML). */
export function diaryWaveHeights(seed: number): number[] {
  return Array.from({ length: 24 }, (_, i) => 18 + ((i * 17 + seed * 11) % 72));
}

// ————————————————————————————— 月度总结 —————————————————————————————

export const MONTH_EMOTION: [string, number][] = [
  ['1–6日', 58],
  ['7–12日', 42],
  ['13–18日', 51],
  ['19–23日', 76],
];

export const MONTH_THEMES = ['# 转岗选择 · 9次', '# 睡眠与精力 · 6次', '# 被支持 · 5次', '# 低风险尝试 · 4次'];

export interface DiaryInsight {
  cap: string;
  title: string;
  copy: string;
}

export const MONTH_INSIGHTS: DiaryInsight[] = [
  {
    cap: '最明显的变化',
    title: '从寻找标准答案，到设计自己的验证过程',
    copy: '月初你频繁问“哪条路更正确”，月末开始谈论访谈、共创和可回退的小实验。',
  },
  {
    cap: '值得照顾的信号',
    title: '睡眠不足常出现在职业焦虑最强的几天',
    copy: '当你试图一次解决所有问题时，休息会最先被牺牲。稳定节奏可能比追加学习时间更重要。',
  },
];

// ————————————————————————————— 年度总结 —————————————————————————————

export const YEAR_KEYWORDS = ['# 职业转向', '# 自我认可', '# 真实尝试', '# 关系支持', '# 生活节奏', '# 不再硬撑'];

export interface YearChapter {
  span: string;
  title: string;
  copy: string;
}

export const YEAR_CHAPTERS: YearChapter[] = [
  { span: '1–3月 · 察觉', title: '“我做得很好，为什么还是不满足？”', copy: '对成长停滞的感受第一次被反复说出来。' },
  { span: '4–5月 · 拉扯', title: '在稳定与新可能之间反复比较', copy: '你很想改变，又担心积累清零，语音中的自我质疑达到高点。' },
  { span: '6月 · 求证', title: '开始向真实的人和项目靠近', copy: '导师、朋友和行业访谈成为新的信息来源。' },
  { span: '7月至今 · 行动', title: '把“大决定”拆成可回退的小实验', copy: '焦虑仍在，但行动感和掌控感明显回升。' },
];

export const YEAR_CLOSING: DiaryInsight = {
  cap: '',
  title: '不必因为仍在犹豫，就否定已经发生的改变',
  copy: '年初的你只敢想象另一条路；现在的你已经在用访谈、作品和共创靠近它。答案不只出现在某个决定里，也出现在你逐渐形成的行动方式里。',
};
