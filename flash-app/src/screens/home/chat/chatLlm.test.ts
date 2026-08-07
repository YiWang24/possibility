import { describe, expect, it } from 'vitest';
import { buildMessages, unwrapModelText } from './chatLlm';
import { promptsFor } from './chatScript';

describe('buildMessages', () => {
  const seed = '我要不要辞掉现在的工作';

  // The canned questions used to be pasted into the system prompt as "参考方向", and
  // the model just rewrote them — so every conversation opened with the same line.
  // They are the fallback copy now, and the model must not see them.
  it('never hands the model the scripted questions', () => {
    for (const topic of ['职业', '家庭', '升学', '情感', undefined]) {
      const joined = buildMessages('clarify', topic, seed, [])
        .map((m) => m.content)
        .join('\n');
      for (const scripted of promptsFor(topic)) {
        expect(joined).not.toContain(scripted);
      }
    }
  });

  it('still tells the model which topic the user picked', () => {
    const joined = buildMessages('clarify', '职业', seed, [])
      .map((m) => m.content)
      .join('\n');
    expect(joined).toContain('职业');
    expect(joined).toContain(seed);
  });

  it('leaves the topic out when the user did not pick one', () => {
    const messages = buildMessages('clarify', undefined, seed, []);
    expect(messages[1]?.content).toBe(`我想探索的问题：${seed}`);
  });

  it('replays the transcript so each turn builds on the last', () => {
    const messages = buildMessages('review', '职业', seed, [
      { role: 'user', text: '我怕留下会后悔' },
      { role: 'assistant', text: '你担心的是错过' },
    ]);
    expect(messages.slice(-2)).toEqual([
      { role: 'user', content: '我怕留下会后悔' },
      { role: 'assistant', content: '你担心的是错过' },
    ]);
  });
});

const FENCE = '```';
const LINE = '你最近在考虑的事情里，最想得到的是什么，又最担心失去的是什么？';

describe('unwrapModelText', () => {
  it('leaves ordinary prose exactly as it is', () => {
    expect(unwrapModelText(LINE)).toBe(LINE);
    expect(unwrapModelText(`  ${LINE}  `)).toBe(LINE);
  });

  it('keeps paragraph breaks in ordinary prose', () => {
    expect(unwrapModelText('第一段\n\n第二段')).toBe('第一段\n\n第二段');
  });

  // The reported bug: the model answered with a fenced chat envelope and the
  // bubble showed the JSON instead of the question.
  it('unwraps a fenced chat envelope down to the line it carries', () => {
    const raw = [FENCE + 'json', '{', '  "role": "AI",', `  "content": "${LINE}"`, '}', FENCE].join('\n');
    expect(unwrapModelText(raw)).toBe(LINE);
  });

  it('unwraps a bare chat envelope with no fence', () => {
    expect(unwrapModelText(`{"role":"AI","content":"${LINE}"}`)).toBe(LINE);
  });

  it('unwraps a fence that carries plain prose rather than JSON', () => {
    expect(unwrapModelText([FENCE, LINE, FENCE].join('\n'))).toBe(LINE);
  });

  it('accepts the other field names models reach for', () => {
    expect(unwrapModelText(`{"text":"${LINE}"}`)).toBe(LINE);
    expect(unwrapModelText(`{"message":"${LINE}"}`)).toBe(LINE);
    expect(unwrapModelText(`{"reply":"${LINE}"}`)).toBe(LINE);
  });

  it('decodes the escapes a JSON string carries', () => {
    expect(unwrapModelText('{"content":"第一段\\n\\n第二段"}')).toBe('第一段\n\n第二段');
    expect(unwrapModelText('{"content":"他说\\"好\\"，然后走了"}')).toBe('他说"好"，然后走了');
  });

  it('joins an array of envelopes', () => {
    expect(unwrapModelText('[{"role":"AI","content":"第一句"},{"role":"AI","content":"第二句"}]')).toBe('第一句\n第二句');
  });

  // Mid-stream the envelope is still open, so the bubble must already be showing
  // prose rather than a growing brace salad.
  it('reads the line out of a half-arrived envelope while it streams', () => {
    const head = FENCE + 'json\n{\n  "role": "AI",\n  "content": "你最近在考虑';
    expect(unwrapModelText(head)).toBe('你最近在考虑');
    expect(unwrapModelText(FENCE + 'json\n{')).toBe('');
    expect(unwrapModelText(FENCE + 'json\n{\n  "role": "AI",')).toBe('');
  });

  it('does not choke on an escape that is still arriving', () => {
    expect(unwrapModelText('{"content":"第一段\\')).toBe('第一段');
    expect(unwrapModelText('{"content":"第一段\\u60')).toBe('第一段');
  });

  it('recovers the line from a field name we did not anticipate', () => {
    expect(unwrapModelText(`{"role":"AI","question":"${LINE}"}`)).toBe(LINE);
  });

  // '' is the caller's "no usable answer" signal, which swaps in the scripted copy for
  // the stage — better than putting a brace on screen.
  it('gives back nothing when the envelope carries no prose at all', () => {
    expect(unwrapModelText('{"a":1}')).toBe('');
  });

  it('never mistakes the envelope bookkeeping for the reply', () => {
    expect(unwrapModelText('{"role":"AI","content":""}')).toBe('');
    expect(unwrapModelText('{"role":"assistant","type":"message"}')).toBe('');
  });

  it('leaves prose that merely starts with a brace alone', () => {
    expect(unwrapModelText('{这不是 JSON，只是以括号开头的一句话')).toBe('{这不是 JSON，只是以括号开头的一句话');
  });

  it('is empty for empty input', () => {
    expect(unwrapModelText('')).toBe('');
    expect(unwrapModelText('   ')).toBe('');
  });
});
