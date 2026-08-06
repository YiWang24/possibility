import { describe, expect, it } from 'vitest';
import { FALLBACK_OBSERVATION, parseObservation } from './contextObserve';

describe('parseObservation', () => {
  const good = { headline: '生成的观察标题', body: '生成的观察正文' };

  it('reads the observation from data', () => {
    expect(parseObservation({ data: good })).toEqual(good);
  });

  it('falls back to parsing content when data is absent', () => {
    expect(parseObservation({ content: JSON.stringify(good) })).toEqual(good);
  });

  it.each([
    ['neither field', {}],
    ['unparseable content', { content: 'nope' }],
    ['an array payload', { data: [] }],
    ['both fields blank', { data: { headline: '  ', body: '' } }],
    ['both fields mistyped', { data: { headline: 1, body: {} } }],
  ])('returns null for %s', (_label, input) => {
    expect(parseObservation(input)).toBeNull();
  });

  it('substitutes the scripted copy when only one field came back', () => {
    expect(parseObservation({ data: { headline: '只有标题' } })).toEqual({
      headline: '只有标题',
      body: FALLBACK_OBSERVATION.body,
    });
    expect(parseObservation({ data: { body: '只有正文' } })).toEqual({
      headline: FALLBACK_OBSERVATION.headline,
      body: '只有正文',
    });
  });

  it('trims surrounding whitespace', () => {
    expect(parseObservation({ data: { headline: '  h  ', body: '  b  ' } })).toEqual({ headline: 'h', body: 'b' });
  });

  it('keeps the fallback copy descriptive rather than a trait verdict', () => {
    // The product line is 状态不等于人格 — the default must not read as a character claim.
    expect(FALLBACK_OBSERVATION.headline).toContain('此刻');
    expect(FALLBACK_OBSERVATION.body).toContain('稳定倾向');
  });
});
