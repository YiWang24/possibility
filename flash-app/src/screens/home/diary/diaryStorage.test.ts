import { describe, expect, it } from 'vitest';
import { DIARY_ENTRIES } from '@/data/diary';
import { diaryLabel, formatDuration, localIsoDate, mergeWithSeed, normalizeEntry, upsertEntry } from './diaryStorage';

describe('normalizeEntry', () => {
  const valid = {
    date: '2026-08-06',
    label: '8月6日 · 周四',
    emoji: '😌',
    emotion: '平静',
    duration: '1:20',
    title: '今天想清楚了一件事',
    keywords: ['转岗', '导师'],
    transcript: ['今天和导师聊了很久。'],
  };

  it('keeps a well-formed record and marks it as recorded', () => {
    expect(normalizeEntry(valid)).toEqual({ ...valid, recorded: true });
  });

  it.each([
    ['null', null],
    ['a string', 'nope'],
    ['an array', []],
    ['a number', 42],
  ])('drops %s', (_label, input) => {
    expect(normalizeEntry(input)).toBeNull();
  });

  it('drops records whose date is missing or malformed', () => {
    expect(normalizeEntry({ ...valid, date: undefined })).toBeNull();
    expect(normalizeEntry({ ...valid, date: '2026/08/06' })).toBeNull();
    expect(normalizeEntry({ ...valid, date: 20260806 })).toBeNull();
  });

  it('drops records with no usable transcript', () => {
    expect(normalizeEntry({ ...valid, transcript: [] })).toBeNull();
    expect(normalizeEntry({ ...valid, transcript: ['   ', ''] })).toBeNull();
    expect(normalizeEntry({ ...valid, transcript: 'not an array' })).toBeNull();
    expect(normalizeEntry({ ...valid, transcript: undefined })).toBeNull();
  });

  it('substitutes defaults for missing or mistyped display fields', () => {
    const entry = normalizeEntry({ date: '2026-08-06', transcript: ['说了点什么'] });
    expect(entry).not.toBeNull();
    expect(entry?.title).toBe('今天的记录');
    expect(entry?.emoji).toBe('🙂');
    expect(entry?.emotion).toBe('说不太清的一天');
    expect(entry?.duration).toBe('0:00');
    expect(entry?.label).toBe(diaryLabel(new Date('2026-08-06T00:00:00')));
  });

  it('substitutes defaults when fields are the wrong type', () => {
    const entry = normalizeEntry({ ...valid, title: 123, emoji: {}, emotion: [], duration: null });
    expect(entry?.title).toBe('今天的记录');
    expect(entry?.emoji).toBe('🙂');
    expect(entry?.emotion).toBe('说不太清的一天');
    expect(entry?.duration).toBe('0:00');
  });

  it('keeps only string keywords and trims them', () => {
    const entry = normalizeEntry({ ...valid, keywords: ['  转岗  ', 7, null, '', '导师'] });
    expect(entry?.keywords).toEqual(['转岗', '导师']);
  });

  it('tolerates keywords that are not an array', () => {
    expect(normalizeEntry({ ...valid, keywords: '转岗' })?.keywords).toEqual([]);
    expect(normalizeEntry({ ...valid, keywords: undefined })?.keywords).toEqual([]);
  });

  it('ignores unknown extra fields from a future schema', () => {
    const entry = normalizeEntry({ ...valid, mood: 'x', nested: { a: 1 } });
    expect(entry).toEqual({ ...valid, recorded: true });
  });
});

describe('mergeWithSeed', () => {
  it('returns the seeded entries when nothing was recorded', () => {
    expect(mergeWithSeed([])).toHaveLength(DIARY_ENTRIES.length);
  });

  it('sorts newest first', () => {
    const merged = mergeWithSeed([]);
    const dates = merged.map((e) => e.date);
    expect([...dates].sort((a, b) => (a < b ? 1 : -1))).toEqual(dates);
  });

  it('lets a real recording win over a seeded entry on the same day', () => {
    const seeded = DIARY_ENTRIES[0];
    if (!seeded) throw new Error('seed data is empty');
    const mine = { ...seeded, title: '这是我自己录的', recorded: true };
    const merged = mergeWithSeed([mine]);
    expect(merged.find((e) => e.date === seeded.date)?.title).toBe('这是我自己录的');
    expect(merged).toHaveLength(DIARY_ENTRIES.length);
  });

  it('adds recordings on dates the seed data does not cover', () => {
    const mine = { date: '2026-08-06', label: '', emoji: '🙂', emotion: '', duration: '0:30', title: '新的一天', keywords: [], transcript: ['x'], recorded: true };
    const merged = mergeWithSeed([mine]);
    expect(merged).toHaveLength(DIARY_ENTRIES.length + 1);
    expect(merged[0]?.date).toBe('2026-08-06');
  });
});

describe('upsertEntry', () => {
  const base = { date: '2026-08-06', label: '', emoji: '🙂', emotion: '', duration: '0:10', title: 'a', keywords: [], transcript: ['x'] };

  it('appends a new day', () => {
    expect(upsertEntry([], base)).toHaveLength(1);
  });

  it('replaces the existing record for the same day rather than duplicating it', () => {
    const updated = { ...base, title: 'b' };
    const result = upsertEntry([base], updated);
    expect(result).toHaveLength(1);
    expect(result[0]?.title).toBe('b');
  });
});

describe('date and duration helpers', () => {
  it('formats the local date, not UTC', () => {
    // 23:30 local on the 6th must stay the 6th even when UTC has rolled over.
    expect(localIsoDate(new Date(2026, 7, 6, 23, 30))).toBe('2026-08-06');
    expect(localIsoDate(new Date(2026, 0, 1, 0, 5))).toBe('2026-01-01');
  });

  it('formats durations with a padded seconds field', () => {
    expect(formatDuration(0)).toBe('0:00');
    expect(formatDuration(9)).toBe('0:09');
    expect(formatDuration(75)).toBe('1:15');
    expect(formatDuration(600)).toBe('10:00');
  });

  it('treats nonsense durations as zero rather than rendering NaN', () => {
    expect(formatDuration(Number.NaN)).toBe('0:00');
    expect(formatDuration(-5)).toBe('0:00');
    expect(formatDuration(Number.POSITIVE_INFINITY)).toBe('0:00');
  });
});
