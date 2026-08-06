// 处境扫描的「观察」生成。
//
// The prototype always intended a derived observation here — the original file's header
// notes it wrote 观察 copy back onto the 认识自己 page and left it unimplemented. This
// fills that slot from the four answers, via ai.chat with a json_schema.
//
// The product line is "状态不等于人格": these answers describe a moment, not a person,
// so the prompt forbids trait conclusions and the fallback copy stays descriptive.

import { getChat } from '@/lib/lingguangAi';

export interface ContextObservation {
  /** One line naming what the four answers add up to right now. */
  headline: string;
  /** Two or three sentences of description — never a verdict about who they are. */
  body: string;
}

const SYSTEM_PROMPT = [
  '用户刚做完一次「此刻的处境扫描」，回答了精力、现实压力、支持、选择空间四个问题。',
  '你要写一段简短的观察，帮他看清此刻的处境。',
  '',
  '最重要的一条：这些答案描述的是「此刻的状态」，不是「他是什么样的人」。',
  '- 绝不能写成性格结论或人格标签，不要出现「你是一个……的人」这类句子。',
  '- 不要给建议，不要安慰，不要说「加油」。',
  '- 如果他的处境确实受限，就直说受限，不要粉饰成「其实你很坚强」。',
  '- 特别注意区分「不想改变」和「暂时承担不起改变」——后者是条件问题，不是意愿问题。',
  '',
  'headline 一句话，不超过 24 字；body 两到三句话。',
  '不要用 markdown，不要输出 HTML 标签。全部使用中文。',
].join('\n');

const RESPONSE_SCHEMA = {
  type: 'object',
  properties: { headline: { type: 'string' }, body: { type: 'string' } },
  required: ['headline', 'body'],
  additionalProperties: false,
};

export const FALLBACK_OBSERVATION: ContextObservation = {
  headline: '这些答案描述的是此刻，不是你这个人',
  body: '精力、压力、支持和选择空间都会变化。数字人已经把它们和你的稳定倾向分开保存，下次处境不同了可以随时改。',
};

export function parseObservation(result: { content?: unknown; data?: unknown }): ContextObservation | null {
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
  const headline = typeof source['headline'] === 'string' ? source['headline'].trim() : '';
  const body = typeof source['body'] === 'string' ? source['body'].trim() : '';
  if (headline === '' && body === '') return null;
  return {
    headline: headline === '' ? FALLBACK_OBSERVATION.headline : headline,
    body: body === '' ? FALLBACK_OBSERVATION.body : body,
  };
}

/** `labelled` is the four questions with the option the user picked. */
export async function observeContext(labelled: { question: string; answer: string }[]): Promise<ContextObservation | null> {
  const chat = getChat();
  if (!chat) return null;
  const lines = labelled.map((l) => `${l.question} → ${l.answer}`).join('\n');
  const result = await chat({
    messages: [
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user', content: lines },
    ],
    responseFormat: { type: 'json_schema', jsonSchema: { name: 'context_observation', schema: RESPONSE_SCHEMA } },
    timeout: 60000,
  });
  return parseObservation(result);
}
