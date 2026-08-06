import { describe, expect, it } from 'vitest';
import { FALLBACK_MONTH, FALLBACK_YEAR, entriesDigest, parseMonthSummary, parseYearSummary } from './diarySummarize';

const entry = (date: string, title: string) => ({
  date,
  label: '',
  emoji: '🙂',
  emotion: '平静',
  duration: '1:00',
  title,
  keywords: [],
  transcript: ['今天说了这些'],
});

describe('entriesDigest', () => {
  it('includes the date, emotion, title and transcript of each entry', () => {
    const digest = entriesDigest([entry('2026-08-06', '标题一')], 10);
    expect(digest).toContain('2026-08-06');
    expect(digest).toContain('平静');
    expect(digest).toContain('标题一');
    expect(digest).toContain('今天说了这些');
  });

  it('caps how many entries are sent so a long history cannot blow the context', () => {
    const many = Array.from({ length: 100 }, (_, i) => entry(`2026-01-${String((i % 28) + 1).padStart(2, '0')}`, `t${String(i)}`));
    expect(entriesDigest(many, 40).split('\n')).toHaveLength(40);
  });
});

describe('parseMonthSummary', () => {
  const good = {
    headline: '生成的月度标题',
    intro: '生成的月度引言',
    themes: ['# 主题一 · 3次', '# 主题二 · 2次', '# 主题三 · 1次'],
    insights: [
      { cap: 'cap1', title: 't1', copy: 'c1' },
      { cap: 'cap2', title: 't2', copy: 'c2' },
    ],
  };

  it('reads a full response', () => {
    const parsed = parseMonthSummary({ data: good });
    expect(parsed?.headline).toBe('生成的月度标题');
    expect(parsed?.themes).toHaveLength(3);
    expect(parsed?.insights[1]?.title).toBe('t2');
  });

  it('falls back to parsing content when data is absent', () => {
    expect(parseMonthSummary({ content: JSON.stringify(good) })?.intro).toBe('生成的月度引言');
  });

  it.each([
    ['neither field', {}],
    ['unparseable content', { content: 'nope' }],
    ['an array payload', { data: [] }],
    ['an unrelated object', { data: { other: 1 } }],
  ])('returns null for %s', (_label, input) => {
    expect(parseMonthSummary(input)).toBeNull();
  });

  it('substitutes the scripted copy for missing fields', () => {
    const parsed = parseMonthSummary({ data: { headline: '只有标题' } });
    expect(parsed?.headline).toBe('只有标题');
    expect(parsed?.intro).toBe(FALLBACK_MONTH.intro);
    expect(parsed?.themes).toEqual(FALLBACK_MONTH.themes);
    expect(parsed?.insights).toHaveLength(2);
  });

  it('always returns exactly two insights even if the model sends one', () => {
    const parsed = parseMonthSummary({ data: { ...good, insights: [{ cap: 'a', title: 'b', copy: 'c' }] } });
    expect(parsed?.insights).toHaveLength(2);
    expect(parsed?.insights[1]?.title).toBe(FALLBACK_MONTH.insights[1]?.title);
  });

  it('drops non-string themes rather than rendering them', () => {
    const parsed = parseMonthSummary({ data: { ...good, themes: ['ok', 3, null, ''] } });
    expect(parsed?.themes).toEqual(['ok']);
  });
});

describe('parseYearSummary', () => {
  const good = {
    headline: '生成的年度标题',
    intro: '生成的年度引言',
    keywords: ['k1', 'k2', 'k3', 'k4'],
    chapters: [
      { span: 's1', title: 't1', copy: 'c1' },
      { span: 's2', title: 't2', copy: 'c2' },
      { span: 's3', title: 't3', copy: 'c3' },
    ],
    closing: { title: '结语标题', copy: '结语正文' },
  };

  it('reads a full response', () => {
    const parsed = parseYearSummary({ data: good });
    expect(parsed?.headline).toBe('生成的年度标题');
    expect(parsed?.chapters).toHaveLength(3);
    expect(parsed?.closing.title).toBe('结语标题');
  });

  it('returns null when nothing usable came back', () => {
    expect(parseYearSummary({ data: { nope: 1 } })).toBeNull();
    expect(parseYearSummary({ content: '<html>' })).toBeNull();
  });

  it('caps chapters at four', () => {
    const many = { ...good, chapters: Array.from({ length: 9 }, (_, i) => ({ span: `s${String(i)}`, title: 't', copy: 'c' })) };
    expect(parseYearSummary({ data: many })?.chapters).toHaveLength(4);
  });

  it('falls back to the scripted chapters when the model sends none', () => {
    const parsed = parseYearSummary({ data: { ...good, chapters: [] } });
    expect(parsed?.chapters).toEqual(FALLBACK_YEAR.chapters);
  });

  it('falls back to the scripted closing when it is missing or mistyped', () => {
    expect(parseYearSummary({ data: { ...good, closing: undefined } })?.closing.title).toBe(FALLBACK_YEAR.closing.title);
    expect(parseYearSummary({ data: { ...good, closing: 'x' } })?.closing.copy).toBe(FALLBACK_YEAR.closing.copy);
  });

  it('keeps only string keywords', () => {
    expect(parseYearSummary({ data: { ...good, keywords: ['a', 1, null, 'b'] } })?.keywords).toEqual(['a', 'b']);
  });
});
