import { APICallError, generateObject, jsonSchema } from "ai";
import { deepseekProvider } from "./deepseek.ts";
import { HttpError } from "./errors.ts";

/**
 * 结构化输出适配层：走 Vercel AI SDK（`ai` + `@ai-sdk/deepseek`），后端为 DeepSeek v4。
 * 用 `generateObject`（原生结构化 + 客户端 schema 校验）。对话流式见 chat-stream.ts。
 *
 * 关键：DeepSeek v4 默认开启 reasoning（思维链），会占用 max_tokens 预算并延后正文。
 * 关闭 reasoning 由 deepseek.ts 的 provider 在 HTTP 层强制注入 thinking:disabled
 * （@ai-sdk/deepseek@3.0.13 的 providerOptions.deepseek.thinking 不生效，见 deepseek.ts）。
 */

function deepseek(model: string) {
  return deepseekProvider()(model);
}

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
