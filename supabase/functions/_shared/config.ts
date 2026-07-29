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
  // service_role 密钥：绕过 RLS 写共享表（如 travelers 无 insert 策略）。
  // Edge 运行时默认注入 SUPABASE_SERVICE_ROLE_KEY，本地 serve 需在 .env 提供。
  get serviceRoleKey(): string {
    return env("SUPABASE_SERVICE_ROLE_KEY");
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
  // Auth Send SMS Hook 的 standardwebhooks secret（形如 v1,whsec_<base64>）。
  // 本地默认值与 config.toml [auth.hook.send_sms].secrets 保持一致。
  get sendSmsHookSecret(): string {
    return env(
      "SEND_SMS_HOOK_SECRET",
      "v1,whsec_bG9jYWwtZGV2LXNlbmQtc21zLWhvb2stc2VjcmV0",
    );
  },
  // 阿里云短信（签名/模板需在阿里云控制台报备后填入 Function Secrets）
  get aliyunSmsAccessKeyId(): string {
    return env("ALIYUN_SMS_ACCESS_KEY_ID");
  },
  get aliyunSmsAccessKeySecret(): string {
    return env("ALIYUN_SMS_ACCESS_KEY_SECRET");
  },
  get aliyunSmsSignName(): string {
    return env("ALIYUN_SMS_SIGN_NAME");
  },
  get aliyunSmsTemplateCode(): string {
    return env("ALIYUN_SMS_TEMPLATE_CODE");
  },
} as const;
