// Scripted exploration-dialogue copy (source: prototype startChat / renderInsight /
// confirmChatInsight / requestChatCorrection / sendChat, ~3733–3801).
// AI bubbles carry <b>/<br> markup, so they are rendered as HTML; every user-typed
// value is escaped first, exactly like the prototype's escapeHTML().

import { CHAT_PROMPTS, type ChatPromptKey } from '@/data/chat';

const HTML_ESCAPES: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
};

export function escapeHTML(value: string): string {
  return value.replace(/[&<>"']/g, (ch) => HTML_ESCAPES[ch] ?? ch);
}

const CHAT_KEYS: ChatPromptKey[] = ['职业', '家庭', '升学', '情感', '默认'];

/** The two clarifying prompts for a topic, falling back to 默认. */
export function promptsFor(topic: string | undefined): readonly [string, string] {
  const key: ChatPromptKey = topic !== undefined && (CHAT_KEYS as string[]).includes(topic) ? (topic as ChatPromptKey) : '默认';
  return CHAT_PROMPTS[key];
}

export function clarifyIntroHTML(topic: string | undefined): string {
  return `我先不急着给建议。想确认一件更关键的事：<br><br><b>${promptsFor(topic)[0]}</b>`;
}

export function clarifyFollowupHTML(topic: string | undefined): string {
  return `我听见了。再确认最后一层：<br><br><b>${promptsFor(topic)[1]}</b>`;
}

export function insightHTML(a0: string | undefined, a1: string | undefined): string {
  const first = escapeHTML(a0 ?? '真正重视的东西');
  const second = escapeHTML(a1 ?? '现实里已经出现的信号');
  return (
    `我先试着说一个<b>暂时的理解</b>：你卡住的可能不只是“该选哪一个”，而是既想保护「${first}」，又不想忽略「${second}」。` +
    `<br><br>所以你需要的也许不是别人替你判断，而是把<b>真实意愿</b>和<b>害怕付出的代价</b>拆开来看。这个理解接近你吗？`
  );
}

export function confirmAnalysisHTML(a0: string | undefined, a1: string | undefined): string {
  const first = escapeHTML(a0 ?? '真正想要的生活');
  const second = escapeHTML(a1 ?? '暂时不能失去的东西');
  return (
    `现在的信息已经够了。我的判断是：你并不是没有答案，而是<b>想靠近「${first}」的同时，也在保护「${second}」</b>。` +
    `<br><br>真正需要验证的，不是哪条路绝对正确，而是哪一种代价是你愿意承担、也有能力承担的。`
  );
}

export const CORRECTION_PROMPT_HTML = '谢谢你纠正我。<b>最不准确的是哪一部分？</b>你可以直接改写成你自己的话，我会以你的表达为准。';

export function correctionAckHTML(value: string): string {
  return `明白了。更准确的说法应该是：<b>${escapeHTML(value)}</b><br><br>我会保留你的原话，不再把它改写成一个性格结论。`;
}
