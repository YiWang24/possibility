import { createDeepSeek } from "@ai-sdk/deepseek";
import { APICallError, generateObject, jsonSchema, streamText } from "ai";
import { runtimeConfig } from "./config.ts";
import { HttpError } from "./errors.ts";

/**
 * LLM 适配层：全部走 Vercel AI SDK（`ai` + `@ai-sdk/deepseek`），后端为 DeepSeek v4。
 *
 * 结构化输出用 `generateObject`（原生结构化 + 客户端 schema 校验）；对话用 `streamText`。
 *
 * 关键：DeepSeek v4（flash/pro）默认开启 reasoning（思维链），会占用 max_tokens 预算——
 * 小预算下正文会被思维链吃光而截断。这里对所有调用统一关闭 reasoning
 * （providerOptions.deepseek.thinking=disabled），换取更快首字、更省 token、更稳的正文，
 * 避免结构化生成被截断。若日后需要更强推理，可按调用点单独打开。
 */

let provider: ReturnType<typeof createDeepSeek> | undefined;

function deepseek(model: string) {
  provider ??= createDeepSeek({
    apiKey: runtimeConfig.deepseekApiKey,
    baseURL: runtimeConfig.deepseekBaseUrl,
  });
  return provider(model);
}

// 关闭 reasoning，避免思维链吃掉输出预算（等价于旧代码里 thinking:disabled 的意图）。
const NO_THINKING = { deepseek: { thinking: { type: "disabled" } } } as const;

/** 4xx 配置类错误（凭证/请求非法）重试无意义，直接抛出交给 errorResponse 映射。 */
function isNonRetryable(status: number | undefined): boolean {
  return status === 400 || status === 401 || status === 403 || status === 404;
}

export async function structuredOutput<T>(
  options: {
    model: string;
    maxTokens: number;
    system: string;
    prompt: string;
    schema: { type: "object"; [key: string]: unknown };
  },
): Promise<T> {
  // DeepSeek 公网端点稳定，但仍给少量重试覆盖偶发的解析失败/网络抖动。
  // 3 次 × 45s，留在 Edge Function 150s 墙钟内。
  const maxAttempts = 3;
  const perAttemptTimeout = 45_000;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), perAttemptTimeout);
    try {
      const { object } = await generateObject({
        model: deepseek(options.model),
        schema: jsonSchema<T>(options.schema),
        system: options.system,
        prompt: options.prompt,
        maxOutputTokens: options.maxTokens,
        maxRetries: 0, // 重试由本函数控制
        abortSignal: controller.signal,
        providerOptions: NO_THINKING,
      });
      return object as T;
    } catch (error) {
      // 真正的 4xx 配置错误（凭证/请求非法）：直接抛出，别浪费重试。
      const status = APICallError.isInstance(error)
        ? error.statusCode
        : undefined;
      if (isNonRetryable(status)) {
        throw new HttpError(
          502,
          "MODEL_UPSTREAM_ERROR",
          "AI 服务配置异常，请稍后重试。",
        );
      }
      // 超时/网络抖动/无法解析出合法对象：记录后重试。
      console.error(
        `structuredOutput attempt ${attempt}/${maxAttempts} failed:`,
        (error as Error).name,
        (error as Error).message,
      );
    } finally {
      clearTimeout(timer);
    }
  }

  throw new HttpError(
    502,
    "MODEL_OUTPUT_INVALID",
    "AI 多次生成均超时或返回了无法解析的结构，请稍后重试。",
  );
}

/**
 * 流式对话：返回 Vercel AI SDK 的 streamText 结果。
 * 调用方用 `result.textStream` 逐块读取正文，`await result.text` 取完整文本；
 * 传入 abortSignal 可在客户端断开时中止上游生成。
 */
export function streamChatText(options: {
  model: string;
  system: string;
  messages: Array<{ role: "user" | "assistant"; content: string }>;
  maxTokens: number;
  abortSignal?: AbortSignal;
}) {
  return streamText({
    model: deepseek(options.model),
    system: options.system,
    messages: options.messages,
    maxOutputTokens: options.maxTokens,
    maxRetries: 2,
    abortSignal: options.abortSignal,
    providerOptions: NO_THINKING,
  });
}
