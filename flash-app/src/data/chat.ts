// Exploration-chat clarifying prompts (source: prototype line ~3713, `CHAT_PROMPTS`).

export type ChatPromptKey = '职业' | '家庭' | '升学' | '情感' | '默认';

/** Two clarifying questions asked, in order, for each topic. */
export const CHAT_PROMPTS: Record<ChatPromptKey, [string, string]> = {
  职业: ['如果暂时不考虑“正确答案”，你更怕继续留下会错过什么，还是转身以后会失去什么？', '最近哪一个真实瞬间，让这个问题突然变得不能再搁置？'],
  家庭: ['这件事里，你最希望家人真正理解你的哪一部分？', '如果不需要照顾任何人的期待，你自己的答案会有什么不同？'],
  升学: ['你真正想靠这个选择得到的，是能力、机会、身份感，还是一种确定感？', '假设两条路都不会失败，你会自然走向哪一条？'],
  情感: ['这段关系里，你最舍不得失去的是什么，最不能继续忍受的又是什么？', '你希望对方改变，还是希望自己终于有勇气做一个决定？'],
  默认: ['这件事里，你最想得到什么，又最担心失去什么？', '最近哪一个真实瞬间，让它开始反复出现在你心里？'],
};
