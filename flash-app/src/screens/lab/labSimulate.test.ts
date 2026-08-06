import { describe, expect, it } from 'vitest';
import { SCENARIOS } from '@/data/lab-sim';
import { applySimulation, buildRunPrompt, parseSimulation } from './labSimulate';

const list = (title: string) => ({ title, items: ['a', 'b', 'c'] });
const one = (headline: string) => ({
  headline,
  dims: [
    { label: '职业状态', value: 'v1' },
    { label: '收入趋势', value: 'v2' },
    { label: '生活节奏', value: 'v3' },
    { label: '内心感受', value: 'v4' },
  ],
  lists: [list('可能获得'), list('需要满足的条件')],
});

const full = {
  best: one('最好的样子'),
  likely: { ...one('大概率的样子'), keyLead: '最关键的是', keyBold: '拿到一个真实项目' },
  worst: one('最坏的样子'),
};

describe('buildRunPrompt', () => {
  it('carries the question, path and horizon into the prompt', () => {
    const prompt = buildRunPrompt({ question: '要不要转产品？', pick: '转 AI 产品', year: 3, carry: [] });
    expect(prompt).toContain('要不要转产品？');
    expect(prompt).toContain('转 AI 产品');
    expect(prompt).toContain('3 年后');
  });

  it('names the carried bottom lines when there are any', () => {
    const prompt = buildRunPrompt({ question: 'q', pick: 'p', year: 5, carry: ['income', 'health'] });
    expect(prompt).toMatch(/不愿交换的底线：.+、.+/);
  });

  it('says so explicitly when none were carried', () => {
    expect(buildRunPrompt({ question: 'q', pick: 'p', year: 5, carry: [] })).toContain('没有指定不愿交换的底线');
  });
});

describe('parseSimulation', () => {
  it('reads all three outcomes from data', () => {
    const result = parseSimulation({ data: full });
    expect(result?.best.headline).toBe('最好的样子');
    expect(result?.likely.headline).toBe('大概率的样子');
    expect(result?.worst.headline).toBe('最坏的样子');
  });

  it('falls back to parsing content when data is absent', () => {
    expect(parseSimulation({ content: JSON.stringify(full) })?.best.headline).toBe('最好的样子');
  });

  it.each([
    ['neither field', {}],
    ['unparseable content', { content: '<html>' }],
    ['an array payload', { data: [1, 2] }],
    ['an object with none of the three keys', { data: { foo: 1 } }],
  ])('returns null for %s', (_label, input) => {
    expect(parseSimulation(input)).toBeNull();
  });

  it('keeps the product-owned dim labels regardless of what the model sends', () => {
    const tampered = { ...full, best: { ...one('x'), dims: [{ label: '乱写的', value: '还行' }] } };
    const dims = parseSimulation({ data: tampered })?.best.dims;
    expect(dims?.map((d) => d[0])).toEqual(['职业状态', '收入趋势', '生活节奏', '内心感受']);
    expect(dims?.[0]?.[1]).toBe('还行');
  });

  it('fills missing dim values from the seeded copy instead of leaving blanks', () => {
    const partial = { ...full, worst: { ...one('x'), dims: [] } };
    const dims = parseSimulation({ data: partial })?.worst.dims;
    const seeded = SCENARIOS.find((s) => s.key === 'worst');
    expect(dims?.[0]?.[1]).toBe(seeded?.dims[0]?.[1]);
  });

  it('keeps the design-owned list accent, never one from the model', () => {
    const tampered = { ...full, best: { ...one('x'), lists: [{ ...list('可能获得'), accent: 'red' }, list('条件')] } };
    const seeded = SCENARIOS.find((s) => s.key === 'best');
    expect(parseSimulation({ data: tampered })?.best.lists[0].accent).toBe(seeded?.lists[0].accent);
  });

  it('falls back to the seeded list when the model sends no usable items', () => {
    const empty = { ...full, best: { ...one('x'), lists: [{ title: 't', items: [] }, list('条件')] } };
    const seeded = SCENARIOS.find((s) => s.key === 'best');
    expect(parseSimulation({ data: empty })?.best.lists[0].items).toEqual(seeded?.lists[0].items);
  });

  it('substitutes a seeded headline when the model omits one', () => {
    const noHeadline = { ...full, best: { ...one(''), headline: '' } };
    const seeded = SCENARIOS.find((s) => s.key === 'best');
    expect(parseSimulation({ data: noHeadline })?.best.headline).toBe(seeded?.headline);
  });

  it('only carries keyLead/keyBold on the outcome that renders them', () => {
    const parsed = parseSimulation({ data: full });
    expect(parsed?.likely.keyBold).toBe('拿到一个真实项目');
    expect(parsed?.best.keyBold).toBeUndefined();
    expect(parsed?.worst.keyBold).toBeUndefined();
  });
});

describe('applySimulation', () => {
  it('returns the seeded outcomes untouched when nothing was generated', () => {
    expect(applySimulation(null)).toBe(SCENARIOS);
  });

  it('replaces content while preserving every presentation field', () => {
    const applied = applySimulation(parseSimulation({ data: full }));
    const best = applied.find((s) => s.key === 'best');
    const seeded = SCENARIOS.find((s) => s.key === 'best');
    expect(best?.headline).toBe('最好的样子');
    expect(best?.tab).toBe(seeded?.tab);
    expect(best?.eyebrow).toBe(seeded?.eyebrow);
    expect(best?.eyebrowColor).toBe(seeded?.eyebrowColor);
    expect(best?.sumBackground).toBe(seeded?.sumBackground);
    expect(best?.sumBorder).toBe(seeded?.sumBorder);
  });

  it('keeps the floor test on the worst outcome', () => {
    const applied = applySimulation(parseSimulation({ data: full }));
    expect(applied.find((s) => s.key === 'worst')?.floorTest).toBe(true);
  });

  it('preserves tab order so the segmented control still lines up', () => {
    const applied = applySimulation(parseSimulation({ data: full }));
    expect(applied.map((s) => s.key)).toEqual(SCENARIOS.map((s) => s.key));
  });
});
