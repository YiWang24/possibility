// Structured 本次探索总结, generated from the real conversation via json_schema.
//
// The four cards on the summary page are fixed by the product; only their copy comes
// from the model. Anything missing falls back to the scripted wording so the page is
// always complete.

import { getChat } from '@/lib/lingguangAi';
import type { Turn } from './chatLlm';

export interface ChatSummaryCard {
  /** Card eyebrow — owned by the product, never by the model. */
  eyebrow: string;
  heading: string;
  body: string;
}

export interface ChatSummaryContent {
  /** 你真正想解决的 */
  problem: ChatSummaryCard;
  /** 此刻的两股拉力 */
  tension: ChatSummaryCard;
  /** 已经比较清楚的 */
  clarity: ChatSummaryCard;
  /** 下一步的小验证 */
  next: ChatSummaryCard;
}

const EYEBROWS = {
  problem: '你真正想解决的',
  tension: '此刻的两股拉力',
  clarity: '已经比较清楚的',
  next: '下一步的小验证',
} as const;

const SYSTEM_PROMPT = [
  '你要把刚才这场探索对话整理成一份总结，给用户自己回看。',
  '这不是定论，是他此刻更清楚的状态。四个部分：',
  '- problem：他真正想解决的到底是什么（往往不是「选哪个」，而是「什么值得承担代价」）。',
  '- tension：此刻拉扯他的两股力——想靠近的，和想保护的。两边都要说成是真的，不要把任何一边写成软弱。',
  '- clarity：这场对话里他已经说清楚的部分，尽量贴近他的原话。',
  '- next：一个未来 7 天内、成本很低、可以撤回的小验证，要具体到能做。',
  '',
  '每部分给 heading（一句话，不超过 24 字）和 body（两到三句话）。',
  '只依据他实际说过的内容，不要替他补充经历。不要给建议式的说教，不要打鸡血。',
  '不要用 markdown，不要输出 HTML 标签。全部使用中文。',
].join('\n');

const CARD_SCHEMA = {
  type: 'object',
  properties: { heading: { type: 'string' }, body: { type: 'string' } },
  required: ['heading', 'body'],
  additionalProperties: false,
};

const RESPONSE_SCHEMA = {
  type: 'object',
  properties: { problem: CARD_SCHEMA, tension: CARD_SCHEMA, clarity: CARD_SCHEMA, next: CARD_SCHEMA },
  required: ['problem', 'tension', 'clarity', 'next'],
  additionalProperties: false,
};

/** Scripted copy, used verbatim when the model is unreachable or a field is blank. */
export function fallbackSummary(a0: string, a1: string, last: string): ChatSummaryContent {
  return {
    problem: {
      eyebrow: EYEBROWS.problem,
      heading: '不是选出标准答案，而是确认什么值得你承担代价',
      body: '你的犹豫并不等于没有方向。它提醒你：愿望与代价需要被分开看见。',
    },
    tension: {
      eyebrow: EYEBROWS.tension,
      heading: '想靠近的，和想保护的',
      body: `一边是「${a0}」；另一边是「${a1}」。两边都是真的，不必把其中一边解释成软弱。`,
    },
    clarity: { eyebrow: EYEBROWS.clarity, heading: '你的原话比标签更重要', body: last },
    next: {
      eyebrow: EYEBROWS.next,
      heading: '先收集一个真实证据',
      body: '未来 7 天，做一次成本很低、可以撤回的小尝试。记录行动前后的期待、精力和抗拒，再判断你是“不想要”，还是“暂时承担不起”。',
    },
  };
}

function readCard(raw: unknown, eyebrow: string, fallback: ChatSummaryCard): ChatSummaryCard {
  if (typeof raw !== 'object' || raw === null) return fallback;
  const source = raw as Record<string, unknown>;
  const heading = typeof source['heading'] === 'string' ? source['heading'].trim() : '';
  const body = typeof source['body'] === 'string' ? source['body'].trim() : '';
  return {
    eyebrow,
    heading: heading === '' ? fallback.heading : heading,
    body: body === '' ? fallback.body : body,
  };
}

export function parseSummary(result: { content?: unknown; data?: unknown }, fallback: ChatSummaryContent): ChatSummaryContent | null {
  let payload: unknown = result.data;
  if (typeof payload !== 'object' || payload === null) {
    if (typeof result.content !== 'string') return null;
    try {
      payload = JSON.parse(result.content) as unknown;
    } catch {
      return null;
    }
  }
  if (typeof payload !== 'object' || payload === null || Array.isArray(payload)) return null;
  const source = payload as Record<string, unknown>;
  const keys = ['problem', 'tension', 'clarity', 'next'] as const;
  if (!keys.some((k) => k in source)) return null;
  return {
    problem: readCard(source['problem'], EYEBROWS.problem, fallback.problem),
    tension: readCard(source['tension'], EYEBROWS.tension, fallback.tension),
    clarity: readCard(source['clarity'], EYEBROWS.clarity, fallback.clarity),
    next: readCard(source['next'], EYEBROWS.next, fallback.next),
  };
}

export async function summarizeChat(seedQuestion: string, turns: Turn[], fallback: ChatSummaryContent): Promise<ChatSummaryContent | null> {
  const chat = getChat();
  if (!chat) return null;
  const transcript = turns.map((t) => `${t.role === 'user' ? '我' : '你'}：${t.text}`).join('\n');
  const result = await chat({
    messages: [
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user', content: `我想探索的问题：${seedQuestion}\n\n对话记录：\n${transcript}` },
    ],
    responseFormat: { type: 'json_schema', jsonSchema: { name: 'chat_summary', schema: RESPONSE_SCHEMA } },
    timeout: 90000,
  });
  return parseSummary(result, fallback);
}
