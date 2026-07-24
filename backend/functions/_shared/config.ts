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
  get anthropicApiKey(): string {
    return env("ANTHROPIC_API_KEY");
  },
  get anthropicBaseUrl(): string {
    return env("ANTHROPIC_BASE_URL", "https://api.anthropic.com");
  },
  get chatModel(): string {
    return env("ANTHROPIC_CHAT_MODEL");
  },
  get structuredModel(): string {
    return env("ANTHROPIC_STRUCTURED_MODEL");
  },
  get diaryModel(): string {
    return env("ANTHROPIC_DIARY_MODEL");
  },
} as const;
