export const LIMITS = {
  message: 4_000,
  transcript: 20_000,
  topic: 40,
  question: 2_000,
  choice: 1_000,
  historyMessages: 20,
} as const;

function env(name: string, fallback?: string): string {
  const value = Deno.env.get(name)?.trim();
  if (value) return value;
  if (fallback !== undefined) return fallback;
  throw new Error(`Missing required environment variable: ${name}`);
}

export const runtimeConfig = {
  get supabaseUrl(): string {
    return env("SUPABASE_URL");
  },
  get supabaseAnonKey(): string {
    return env("SUPABASE_ANON_KEY");
  },
  get deepseekApiKey(): string {
    return env("DEEPSEEK_API_KEY");
  },
  get deepseekBaseUrl(): string {
    return env("DEEPSEEK_BASE_URL", "https://api.deepseek.com");
  },
  // 对话流式：低延迟优先，默认 flash。
  get chatModel(): string {
    return env("DEEPSEEK_CHAT_MODEL", "deepseek-v4-flash");
  },
  // 结构化生成（simulate/match/persona/community/lab-choices）：质量优先，默认 pro。
  get structuredModel(): string {
    return env("DEEPSEEK_STRUCTURED_MODEL", "deepseek-v4-pro");
  },
  // 日记/信号抽取（analyze-diary/diary-summary/chat signal）：质量优先，默认 pro。
  get diaryModel(): string {
    return env("DEEPSEEK_DIARY_MODEL", "deepseek-v4-pro");
  },
} as const;
