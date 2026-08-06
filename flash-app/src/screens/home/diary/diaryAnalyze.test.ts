import { describe, expect, it } from 'vitest';
import { parseAnalysis } from './diaryAnalyze';

describe('parseAnalysis', () => {
  const good = { title: '我决定先做一次访谈', emotion: '平静中带一点犹豫', emoji: '😌', keywords: ['转岗', '导师'] };

  it('reads structured output from data', () => {
    expect(parseAnalysis({ data: good })).toEqual(good);
  });

  it('falls back to parsing content when the host omits data', () => {
    expect(parseAnalysis({ content: JSON.stringify(good) })).toEqual(good);
  });

  it('prefers data over content when both are present', () => {
    expect(parseAnalysis({ data: good, content: '{"title":"别用我"}' })?.title).toBe(good.title);
  });

  it.each([
    ['neither field', {}],
    ['unparseable content', { content: 'not json at all' }],
    ['content that is not an object', { content: '"just a string"' }],
    ['an array payload', { data: [1, 2, 3] }],
    ['a null payload', { data: null, content: 'null' }],
    ['no title and no emotion', { data: { emoji: '😌', keywords: ['x'] } }],
  ])('returns null for %s', (_label, input) => {
    expect(parseAnalysis(input)).toBeNull();
  });

  it('substitutes defaults when only one of title/emotion came back', () => {
    expect(parseAnalysis({ data: { title: '只有标题' } })).toEqual({
      title: '只有标题',
      emotion: '说不太清的一天',
      emoji: '🙂',
      keywords: [],
    });
  });

  it('rejects an emoji outside the allowed set', () => {
    expect(parseAnalysis({ data: { ...good, emoji: '🚀' } })?.emoji).toBe('🙂');
    expect(parseAnalysis({ data: { ...good, emoji: 42 } })?.emoji).toBe('🙂');
  });

  it('keeps only string keywords, trimmed, capped at four', () => {
    const result = parseAnalysis({ data: { ...good, keywords: ['  a  ', 1, null, 'b', '', 'c', 'd', 'e'] } });
    expect(result?.keywords).toEqual(['a', 'b', 'c', 'd']);
  });

  it('tolerates keywords that are not an array', () => {
    expect(parseAnalysis({ data: { ...good, keywords: '转岗' } })?.keywords).toEqual([]);
    expect(parseAnalysis({ data: { ...good, keywords: undefined } })?.keywords).toEqual([]);
  });

  it('trims whitespace around title and emotion', () => {
    const result = parseAnalysis({ data: { ...good, title: '  有空格  ', emotion: '  也有  ' } });
    expect(result?.title).toBe('有空格');
    expect(result?.emotion).toBe('也有');
  });
});
