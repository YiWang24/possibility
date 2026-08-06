// Turn a raw voice-diary transcript into the structured fields the UI renders,
// via `lingguang.ai.chat` with a json_schema response format.

import { getChat } from '@/lib/lingguangAi';

/** Emoji the week strip can render. The model must pick one of these. */
export const DIARY_EMOJIS = ['😊', '🙂', '😌', '😐', '😶', '😮‍💨', '😔', '😤', '🤔', '😴'] as const;

export interface DiaryAnalysis {
  title: string;
  emotion: string;
  emoji: string;
  keywords: string[];
}

const SYSTEM_PROMPT = [
  '你在帮一位 22–30 岁、正处在职业或身份转换期的用户整理他的语音日记。',
  '用户刚说完一段话，你要把它整理成可回看的日记条目。',
  '要求：',
  '- title：一句话，用第一人称，写出这段话里最要紧的那件事或那个转折，不要套话，不超过 24 字。',
  '- emotion：一句话描述当下情绪状态，可以带层次（例如「平静中带一点犹豫」），不超过 16 字。',
  '- emoji：从给定选项中挑最贴近这段情绪的一个。',
  '- keywords：2–4 个关键词，每个不超过 8 字，抓住具体的人事物或议题，避免「成长」「思考」这类空词。',
  '只依据用户实际说过的内容，不要补充、不要引申、不要安慰。',
].join('\n');

const RESPONSE_SCHEMA = {
  type: 'object',
  properties: {
    title: { type: 'string' },
    emotion: { type: 'string' },
    emoji: { type: 'string', enum: [...DIARY_EMOJIS] },
    keywords: { type: 'array', items: { type: 'string' }, minItems: 1, maxItems: 4 },
  },
  required: ['title', 'emotion', 'emoji', 'keywords'],
  additionalProperties: false,
} satisfies Record<string, unknown>;

function readString(source: Record<string, unknown>, key: string): string {
  const value = source[key];
  return typeof value === 'string' ? value.trim() : '';
}

/**
 * Pull the analysis out of whatever the host returned.
 *
 * Structured output is requested but not trusted: `data` may be missing on older
 * hosts (in which case `content` holds the JSON as text), fields may be the wrong
 * type, and keywords may not be an array. Anything unusable becomes a null so the
 * caller can still save the transcript and offer a retry.
 */
export function parseAnalysis(result: { content?: unknown; data?: unknown }): DiaryAnalysis | null {
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

  const title = readString(source, 'title');
  const emotion = readString(source, 'emotion');
  if (title === '' && emotion === '') return null;

  const rawKeywords = source['keywords'];
  const keywords = (Array.isArray(rawKeywords) ? rawKeywords : [])
    .filter((k): k is string => typeof k === 'string')
    .map((k) => k.trim())
    .filter((k) => k !== '')
    .slice(0, 4);

  const emoji = readString(source, 'emoji');
  const safeEmoji = (DIARY_EMOJIS as readonly string[]).includes(emoji) ? emoji : '🙂';

  return {
    title: title === '' ? '今天的记录' : title,
    emotion: emotion === '' ? '说不太清的一天' : emotion,
    emoji: safeEmoji,
    keywords,
  };
}

/**
 * Analyse a transcript. Returns null when the capability is missing or the host
 * response cannot be read; throws only when the host call itself rejects.
 */
export async function analyzeDiaryTranscript(transcript: string): Promise<DiaryAnalysis | null> {
  const chat = getChat();
  if (!chat) return null;
  const result = await chat({
    messages: [
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user', content: transcript },
    ],
    responseFormat: {
      type: 'json_schema',
      jsonSchema: { name: 'diary_analysis', schema: RESPONSE_SCHEMA },
    },
    timeout: 60000,
  });
  return parseAnalysis(result);
}
