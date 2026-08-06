// 月度 / 年度日记总结，基于用户真实落盘的日记生成。
//
// Previously the whole page was constants in diaryHelpers.ts and 「更新总结」 was an
// 850ms setTimeout. Now the real entries drive it, with those constants kept as the
// fallback so the page still reads well before anything has been recorded.

import { getChat } from '@/lib/lingguangAi';
import type { DiaryEntry } from '@/data/diary';
import { MONTH_INSIGHTS, MONTH_THEMES, YEAR_CHAPTERS, YEAR_CLOSING, YEAR_KEYWORDS, type DiaryInsight, type YearChapter } from './diaryHelpers';

export interface MonthSummary {
  kind: 'month';
  headline: string;
  intro: string;
  themes: string[];
  insights: DiaryInsight[];
}

export interface YearSummary {
  kind: 'year';
  headline: string;
  intro: string;
  keywords: string[];
  chapters: YearChapter[];
  closing: DiaryInsight;
}

export type DiarySummaryContent = MonthSummary | YearSummary;

const SHARED_RULES = [
  '只依据用户实际写下的日记，不要替他补充经历、情绪或结论。',
  '贴近他的原话，具体而克制。不要打鸡血，不要说教，不要用「你要相信自己」这类空话。',
  '不要下性格结论，不要贴人格标签——日记记录的是他经历了什么，不是他是什么样的人。',
  '不要用 markdown，不要输出 HTML 标签。全部使用中文。',
].join('\n');

const MONTH_PROMPT = [
  '你要把用户这个月的语音日记整理成一份月度回顾。',
  '- headline：一句话说出这个月最明显的变化或走向，不超过 30 字。',
  '- intro：两到三句话展开这个变化。',
  '- themes：3–5 个反复出现的主题，每个形如「转岗选择 · 9次」，次数要与日记里实际出现的情况相符。',
  '- insights：2 条洞察，每条给 cap（如「最明显的变化」「值得照顾的信号」）、title（一句话）、copy（两句话）。',
  '',
  SHARED_RULES,
].join('\n');

const YEAR_PROMPT = [
  '你要把用户这一年的语音日记整理成一份年度回顾。',
  '- headline：一句话说出这一年他身上发生的根本变化，不超过 30 字。',
  '- intro：两到三句话展开。',
  '- keywords：4–6 个年度关键词，按出现频次与情绪权重排序。',
  '- chapters：把这一年分成 3–4 个章节，每章给 span（如「1–3月 · 察觉」）、title（一句话，可以用他的原话）、copy（一句话）。',
  '- closing：写给年底的他，给 title（一句话）和 copy（两到三句话）。',
  '',
  SHARED_RULES,
].join('\n');

const INSIGHT_SCHEMA = {
  type: 'object',
  properties: { cap: { type: 'string' }, title: { type: 'string' }, copy: { type: 'string' } },
  required: ['cap', 'title', 'copy'],
  additionalProperties: false,
};

const MONTH_SCHEMA = {
  type: 'object',
  properties: {
    headline: { type: 'string' },
    intro: { type: 'string' },
    themes: { type: 'array', items: { type: 'string' }, minItems: 3, maxItems: 5 },
    insights: { type: 'array', items: INSIGHT_SCHEMA, minItems: 2, maxItems: 2 },
  },
  required: ['headline', 'intro', 'themes', 'insights'],
  additionalProperties: false,
};

const YEAR_SCHEMA = {
  type: 'object',
  properties: {
    headline: { type: 'string' },
    intro: { type: 'string' },
    keywords: { type: 'array', items: { type: 'string' }, minItems: 4, maxItems: 6 },
    chapters: {
      type: 'array',
      minItems: 3,
      maxItems: 4,
      items: {
        type: 'object',
        properties: { span: { type: 'string' }, title: { type: 'string' }, copy: { type: 'string' } },
        required: ['span', 'title', 'copy'],
        additionalProperties: false,
      },
    },
    closing: {
      type: 'object',
      properties: { title: { type: 'string' }, copy: { type: 'string' } },
      required: ['title', 'copy'],
      additionalProperties: false,
    },
  },
  required: ['headline', 'intro', 'keywords', 'chapters', 'closing'],
  additionalProperties: false,
};

export const FALLBACK_MONTH: MonthSummary = {
  kind: 'month',
  headline: '这个月，你从“必须马上决定”走向了“先用行动收集答案”',
  intro: '焦虑没有完全消失，但它不再只是反复盘旋，而是逐渐被拆成访谈、共创和项目复盘等可以验证的下一步。',
  themes: [...MONTH_THEMES],
  insights: MONTH_INSIGHTS.map((i) => ({ ...i })),
};

export const FALLBACK_YEAR: YearSummary = {
  kind: 'year',
  headline: '这一年，你在练习把人生从“证明自己”还给“选择自己”',
  intro: '工作的熟练带来认可，也带来停滞感。你开始允许自己不立刻跳走，而是先靠近真正感兴趣的问题。',
  keywords: [...YEAR_KEYWORDS],
  chapters: YEAR_CHAPTERS.map((c) => ({ ...c })),
  closing: { ...YEAR_CLOSING },
};

// ---- defensive parsing -------------------------------------------------------

function str(source: Record<string, unknown>, key: string, fallback: string): string {
  const value = source[key];
  const text = typeof value === 'string' ? value.trim() : '';
  return text === '' ? fallback : text;
}

function strList(raw: unknown, fallback: string[], max: number): string[] {
  const items = (Array.isArray(raw) ? raw : [])
    .filter((i): i is string => typeof i === 'string')
    .map((i) => i.trim())
    .filter((i) => i !== '')
    .slice(0, max);
  return items.length === 0 ? fallback : items;
}

function asRecord(raw: unknown): Record<string, unknown> | null {
  return typeof raw === 'object' && raw !== null && !Array.isArray(raw) ? (raw as Record<string, unknown>) : null;
}

function payloadOf(result: { content?: unknown; data?: unknown }): Record<string, unknown> | null {
  const direct = asRecord(result.data);
  if (direct) return direct;
  if (typeof result.content !== 'string') return null;
  try {
    return asRecord(JSON.parse(result.content));
  } catch {
    return null;
  }
}

export function parseMonthSummary(result: { content?: unknown; data?: unknown }): MonthSummary | null {
  const source = payloadOf(result);
  if (!source || !('headline' in source || 'themes' in source || 'insights' in source)) return null;
  const rawInsights: unknown[] = Array.isArray(source['insights']) ? source['insights'] : [];
  const insights = FALLBACK_MONTH.insights.map((fb, i) => {
    const item = asRecord(rawInsights[i]);
    if (!item) return { ...fb };
    return { cap: str(item, 'cap', fb.cap), title: str(item, 'title', fb.title), copy: str(item, 'copy', fb.copy) };
  });
  return {
    kind: 'month',
    headline: str(source, 'headline', FALLBACK_MONTH.headline),
    intro: str(source, 'intro', FALLBACK_MONTH.intro),
    themes: strList(source['themes'], FALLBACK_MONTH.themes, 5),
    insights,
  };
}

export function parseYearSummary(result: { content?: unknown; data?: unknown }): YearSummary | null {
  const source = payloadOf(result);
  if (!source || !('headline' in source || 'keywords' in source || 'chapters' in source)) return null;
  const rawChapters: unknown[] = Array.isArray(source['chapters']) ? source['chapters'] : [];
  const chapters =
    rawChapters.length === 0
      ? FALLBACK_YEAR.chapters.map((c) => ({ ...c }))
      : rawChapters.slice(0, 4).map((raw, i) => {
          const fb = FALLBACK_YEAR.chapters[i] ?? FALLBACK_YEAR.chapters[0];
          const item = asRecord(raw);
          if (!item || !fb) return fb ? { ...fb } : { span: '', title: '', copy: '' };
          return { span: str(item, 'span', fb.span), title: str(item, 'title', fb.title), copy: str(item, 'copy', fb.copy) };
        });
  const closingRaw = asRecord(source['closing']);
  const closing = closingRaw
    ? { cap: '', title: str(closingRaw, 'title', FALLBACK_YEAR.closing.title), copy: str(closingRaw, 'copy', FALLBACK_YEAR.closing.copy) }
    : { ...FALLBACK_YEAR.closing };
  return {
    kind: 'year',
    headline: str(source, 'headline', FALLBACK_YEAR.headline),
    intro: str(source, 'intro', FALLBACK_YEAR.intro),
    keywords: strList(source['keywords'], FALLBACK_YEAR.keywords, 6),
    chapters,
    closing,
  };
}

/** Compact transcript of the entries, kept short enough to stay well inside a context. */
export function entriesDigest(entries: DiaryEntry[], limit: number): string {
  return entries
    .slice(0, limit)
    .map((e) => `${e.date}｜${e.emotion}｜${e.title}｜${e.transcript.join(' ')}`)
    .join('\n');
}

export async function summarizeDiary(period: 'month' | 'year', entries: DiaryEntry[]): Promise<DiarySummaryContent | null> {
  const chat = getChat();
  if (!chat) return null;
  const isMonth = period === 'month';
  const result = await chat({
    messages: [
      { role: 'system', content: isMonth ? MONTH_PROMPT : YEAR_PROMPT },
      { role: 'user', content: `我的日记（共 ${String(entries.length)} 篇）：\n${entriesDigest(entries, isMonth ? 40 : 80)}` },
    ],
    responseFormat: { type: 'json_schema', jsonSchema: { name: isMonth ? 'diary_month' : 'diary_year', schema: isMonth ? MONTH_SCHEMA : YEAR_SCHEMA } },
    timeout: 120000,
  });
  return isMonth ? parseMonthSummary(result) : parseYearSummary(result);
}
