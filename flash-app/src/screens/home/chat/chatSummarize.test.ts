import { describe, expect, it } from 'vitest';
import { fallbackSummary, parseSummary } from './chatSummarize';

const fb = fallbackSummary('想做的事', '不能失去的', '我先去问两个人');

const card = (h: string, b: string) => ({ heading: h, body: b });
const full = {
  problem: card('生成的问题', '生成的问题正文'),
  tension: card('生成的拉力', '生成的拉力正文'),
  clarity: card('生成的清楚', '生成的清楚正文'),
  next: card('生成的下一步', '生成的下一步正文'),
};

describe('fallbackSummary', () => {
  it('weaves the user answers into the tension card', () => {
    expect(fb.tension.body).toContain('想做的事');
    expect(fb.tension.body).toContain('不能失去的');
  });

  it('uses the last answer verbatim as the clarity card', () => {
    expect(fb.clarity.body).toBe('我先去问两个人');
  });

  it('labels every card with the product-owned eyebrow', () => {
    expect(fb.problem.eyebrow).toBe('你真正想解决的');
    expect(fb.tension.eyebrow).toBe('此刻的两股拉力');
    expect(fb.clarity.eyebrow).toBe('已经比较清楚的');
    expect(fb.next.eyebrow).toBe('下一步的小验证');
  });
});

describe('parseSummary', () => {
  it('reads all four cards from data', () => {
    const parsed = parseSummary({ data: full }, fb);
    expect(parsed?.problem.heading).toBe('生成的问题');
    expect(parsed?.next.body).toBe('生成的下一步正文');
  });

  it('falls back to parsing content when data is absent', () => {
    expect(parseSummary({ content: JSON.stringify(full) }, fb)?.clarity.heading).toBe('生成的清楚');
  });

  it.each([
    ['neither field', {}],
    ['unparseable content', { content: 'nope' }],
    ['an array payload', { data: [] }],
    ['an object with none of the four keys', { data: { other: 1 } }],
  ])('returns null for %s', (_label, input) => {
    expect(parseSummary(input, fb)).toBeNull();
  });

  it('keeps the product eyebrow even if the model sends its own', () => {
    const tampered = { ...full, problem: { ...card('h', 'b'), eyebrow: '模型写的' } };
    expect(parseSummary({ data: tampered }, fb)?.problem.eyebrow).toBe('你真正想解决的');
  });

  it('substitutes the scripted copy for a card the model omitted', () => {
    const partial = { problem: card('只有这个', '正文') };
    const parsed = parseSummary({ data: partial }, fb);
    expect(parsed?.problem.heading).toBe('只有这个');
    expect(parsed?.tension.body).toBe(fb.tension.body);
    expect(parsed?.next.heading).toBe(fb.next.heading);
  });

  it('substitutes the scripted copy for blank or mistyped fields', () => {
    const bad = { ...full, clarity: { heading: '   ', body: 42 } };
    const parsed = parseSummary({ data: bad }, fb);
    expect(parsed?.clarity.heading).toBe(fb.clarity.heading);
    expect(parsed?.clarity.body).toBe(fb.clarity.body);
  });

  it('trims whitespace around generated copy', () => {
    const padded = { ...full, next: card('  有空格  ', '  也有  ') };
    const parsed = parseSummary({ data: padded }, fb);
    expect(parsed?.next.heading).toBe('有空格');
    expect(parsed?.next.body).toBe('也有');
  });
});
