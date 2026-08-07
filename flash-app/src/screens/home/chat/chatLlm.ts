// Real model turns for the exploration dialogue, via `lingguang.ai.streamChat`.
//
// The stage machine in ChatPush still drives the funnel (承接 → 澄清 → 可反驳的理解 →
// 用户确认或纠正). The model fills in what is said at each stage; it does not get to
// decide where the conversation goes. That keeps the product shape when the model is
// vague, and lets the scripted copy stand in verbatim when it is unreachable.

import { getChat } from '@/lib/lingguangAi';
import type { ChatMessage } from '@/lib/lingguangAi';
import { promptsFor } from './chatScript';

export type ChatStage = 'clarify' | 'review' | 'correction' | 'ready';

/** One exchange as the model should see it. */
export interface Turn {
  role: 'user' | 'assistant';
  text: string;
}

const BASE_PROMPT = [
  '你是一款帮助 22–30 岁年轻人想清人生岔路口的产品里的对话伙伴。',
  '用户往往在一个急性但还没成形的迷茫时刻找到你——他此刻缺的不是更多建议，也不是更多信息，',
  '而是先被承接住，然后把一团乱的困惑澄清成一个具体的岔路口。',
  '',
  '始终遵守：',
  '- 绝不替用户做决定，也不要给出「你应该……」式的建议。',
  '- 把「真正想要的」和「害怕付出的代价」拆开来说，这是你最重要的工作。',
  '- 用第二人称，语气平静克制。不要打鸡血，不要说「加油」「相信自己」「一切都会好的」。',
  '- 不要罗列条目、不要用 markdown、不要用星号或井号，就写成自然的话。',
  '- 只依据用户真正说过的内容，不要替他补充经历或情绪。',
  '- 全部使用中文，不要输出任何 HTML 标签。',
  '- 直接输出你要说的那段话本身，不要包进 JSON、代码块或任何字段名里。',
].join('\n');

const STAGE_PROMPT: Record<ChatStage, string> = {
  clarify: [
    '现在你只做一件事：提出一个能让用户的困惑变得更具体的问题。',
    '不要给建议，不要安慰，不要总结，不要罗列选项。',
    '一次只问一个问题，两到三句话之内，最后落在那个问题上。',
  ].join('\n'),
  review: [
    '现在给出一个「暂时的理解」：说出你认为他真正卡住的地方，通常是「既想靠近某样东西，又不想失去另一样」。',
    '这个理解必须是可以被反驳的——要说得足够具体，让他能判断准不准。',
    '不要下性格结论，不要贴标签。四到六句话。',
    '最后一句明确请他确认这个理解接不接近他。',
  ].join('\n'),
  correction: [
    '用户刚刚说你理解得不对，并给出了他自己的说法。',
    '以他的原话为准重新表述，不要辩解，不要坚持你原来的判断。',
    '明确表示你会保留他的表达，不把它改写成一个关于他性格的结论。三到四句话。',
  ].join('\n'),
  ready: [
    '用户已经确认了你的理解。现在给出你的判断。',
    '判断的重点不是哪条路更正确，而是哪一种代价是他愿意承担、也有能力承担的。',
    '四到六句话，说完就停，不要追加行动清单。',
  ].join('\n'),
};

function buildMessages(stage: ChatStage, topic: string | undefined, seedQuestion: string, turns: Turn[]): ChatMessage[] {
  const guidance = stage === 'clarify' ? `\n\n供参考的提问方向（可以改写得更贴合他刚才说的话，不必照抄）：\n- ${promptsFor(topic).join('\n- ')}` : '';
  const messages: ChatMessage[] = [
    { role: 'system', content: `${BASE_PROMPT}\n\n${STAGE_PROMPT[stage]}${guidance}` },
    { role: 'user', content: `我想探索的问题：${seedQuestion}` },
  ];
  for (const turn of turns) {
    messages.push({ role: turn.role === 'user' ? 'user' : 'assistant', content: turn.text });
  }
  return messages;
}

// `responseFormat: { type: 'text' }` asks for prose, and the prompt asks for prose, but
// a model still occasionally answers with its own chat envelope — a fenced
// `{"role": "AI", "content": "…"}` — and the bubble renders whatever it is handed. So the
// envelope is peeled off here, before anything downstream treats the text as the reply.

/** Fields a model puts its line in when it wraps the reply in an object. */
const TEXT_KEYS = ['content', 'text', 'message', 'reply'] as const;

/** Drop a ```lang fence, including a half-arrived one that has no closing marker yet. */
function stripFence(input: string): string {
  const opened = /^```[a-zA-Z0-9_+-]*[ \t]*\r?\n?/.exec(input);
  if (!opened) return input;
  return input.slice(opened[0].length).replace(/\r?\n?```\s*$/, '');
}

/** Pull the line out of a parsed envelope; null when no field looks like prose. */
function textFrom(value: unknown): string | null {
  if (typeof value === 'string') return value;
  if (Array.isArray(value)) {
    const parts = value.map(textFrom).filter((p): p is string => p !== null && p !== '');
    return parts.length === 0 ? null : parts.join('\n');
  }
  if (typeof value !== 'object' || value === null) return null;
  const record = value as Record<string, unknown>;
  for (const key of TEXT_KEYS) {
    const found = textFrom(record[key]);
    if (found !== null && found !== '') return found;
  }
  // An unfamiliar field name still beats losing the answer: the reply is the longest
  // string in there by a wide margin — "AI" and "assistant" lose to a whole sentence.
  return longestString(record);
}

/** Envelope bookkeeping — never the reply, so "AI" can't win the search below. */
const META_KEYS = new Set(['role', 'type', 'name', 'id', 'model', 'status', 'finish_reason', 'finishReason']);

function longestString(value: unknown): string | null {
  if (typeof value === 'string') return value === '' ? null : value;
  let children: unknown[] = [];
  if (Array.isArray(value)) children = value;
  else if (typeof value === 'object' && value !== null) {
    children = Object.entries(value as Record<string, unknown>)
      .filter(([key]) => !META_KEYS.has(key))
      .map(([, child]) => child);
  }
  let best: string | null = null;
  for (const child of children) {
    const found = longestString(child);
    if (found !== null && (best === null || found.length > best.length)) best = found;
  }
  return best;
}

/** Decode a JSON string body up to its closing quote, tolerating a truncated tail. */
function decodeUntilQuote(input: string): string {
  const ESCAPES: Record<string, string> = { n: '\n', t: '\t', r: '\r', b: '\b', f: '\f' };
  let out = '';
  for (let i = 0; i < input.length; i += 1) {
    const ch = input[i];
    if (ch === undefined || ch === '"') break;
    if (ch !== '\\') {
      out += ch;
      continue;
    }
    const next = input[i + 1];
    if (next === undefined) break;
    i += 1;
    if (next === 'u') {
      const hex = input.slice(i + 1, i + 5);
      if (!/^[0-9a-fA-F]{4}$/.test(hex)) break;
      out += String.fromCharCode(Number.parseInt(hex, 16));
      i += 4;
    } else {
      out += ESCAPES[next] ?? next;
    }
  }
  return out;
}

/** Mid-stream the envelope is still open, so JSON.parse cannot help — scan for the field. */
function textFromPartial(input: string): string | null {
  for (const key of TEXT_KEYS) {
    const opener = new RegExp(`"${key}"\\s*:\\s*"`).exec(input);
    if (opener) return decodeUntilQuote(input.slice(opener.index + opener[0].length));
  }
  return null;
}

/**
 * Reduce one model response to the prose it carries.
 *
 * Handles both the finished response and every partial prefix of it, so the same
 * envelope never shows up in the bubble while the answer is still streaming. Text that
 * is already prose is returned untouched. An envelope we cannot get prose out of
 * becomes '', which the caller reads as "no usable answer" and replaces with the
 * scripted copy for that stage — the funnel's existing way of degrading.
 */
export function unwrapModelText(raw: string): string {
  const body = stripFence(raw.trim()).trim();
  if (body === '') return '';
  if (body[0] !== '{' && body[0] !== '[') return body;
  try {
    return textFrom(JSON.parse(body))?.trim() ?? '';
  } catch {
    const found = textFromPartial(body);
    if (found !== null) return found;
    // Still arriving, or malformed: blank it only once it is clearly an envelope and
    // not a sentence that happens to open with a brace.
    return /^[{[]\s*("|$)/.test(body) ? '' : body;
  }
}

export interface AssistantRequest {
  stage: ChatStage;
  topic: string | undefined;
  seedQuestion: string;
  turns: Turn[];
  /** Called with the full text so far as it streams — overwrite, do not append. */
  onDelta: (text: string) => void;
}

/**
 * Produce the assistant's next line.
 *
 * Returns null when the capability is missing or the model returns nothing usable,
 * which the caller renders as the scripted copy for that stage.
 */
export async function requestAssistantTurn(req: AssistantRequest): Promise<string | null> {
  const chat = getChat();
  if (!chat) return null;
  const messages = buildMessages(req.stage, req.topic, req.seedQuestion, req.turns);

  const stream = (globalThis as { lingguang?: { ai?: { streamChat?: unknown } } }).lingguang?.ai?.streamChat;
  if (typeof stream === 'function') {
    const streamChat = stream as (o: {
      messages: ChatMessage[];
      responseFormat?: { type: 'text' };
      timeout?: number;
      onEvent?: (e: { type: string; text?: string; message?: string }) => void;
    }) => Promise<{ content: string }>;
    const result = await streamChat({
      messages,
      responseFormat: { type: 'text' },
      timeout: 60000,
      onEvent: (event) => {
        if (event.type !== 'text_delta' || typeof event.text !== 'string') return;
        // While only the envelope's opening has arrived there is nothing to show yet;
        // staying silent keeps the thinking indicator up instead of flashing an empty bubble.
        const partial = unwrapModelText(event.text);
        if (partial !== '') req.onDelta(partial);
      },
    });
    const text = typeof result.content === 'string' ? unwrapModelText(result.content) : '';
    return text === '' ? null : text;
  }

  // Hosts without streamChat still get a real answer, just without the typing effect.
  const result = await chat({ messages, responseFormat: { type: 'text' }, timeout: 60000 });
  const text = typeof result.content === 'string' ? unwrapModelText(result.content) : '';
  return text === '' ? null : text;
}
