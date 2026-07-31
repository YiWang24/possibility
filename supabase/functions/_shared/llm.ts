import { APICallError, generateObject, jsonSchema } from "ai";
import { propagateAttributes } from "@langfuse/tracing";
import { deepseekProvider } from "./deepseek.ts";
import { HttpError } from "./errors.ts";
import { flushTraces, type LlmTrace, telemetryEnabled } from "./telemetry.ts";
import { type LLMTrackContext, trackLLMRequest } from "./track.ts";

/**
 * 结构化输出适配层：走 Vercel AI SDK（`ai` + `@ai-sdk/deepseek`），后端为 DeepSeek v4。
 * 用 `generateObject`（原生结构化 + 客户端 schema 校验）。对话流式见 chat-stream.ts。
 *
 * 关键：DeepSeek v4 默认开启 reasoning（思维链），会占用 max_tokens 预算并延后正文。
 * 关闭 reasoning 由 deepseek.ts 的 provider 在 HTTP 层强制注入 thinking:disabled
 * （@ai-sdk/deepseek@3.0.13 的 providerOptions.deepseek.thinking 不生效，见 deepseek.ts）。
 */

// DeepSeek 公网端点稳定，但仍给少量重试覆盖偶发的解析失败/网络抖动。
// 3 次 × 45s，留在 Edge Function 150s 墙钟内。
const MAX_ATTEMPTS = 3;
const PER_ATTEMPT_TIMEOUT_MS = 45_000;

export type StructuredOutputOptions = {
  model: string;
  maxTokens: number;
  system: string;
  prompt: string;
  schema: { type: "object"; [key: string]: unknown };
  /// 传入即上报 llm_request（token 用量/延迟/成败）。不传则静默跳过。
  track?: LLMTrackContext;
  /// 传入且已配置 Langfuse 环境变量时上报调用链路 trace。不传则静默跳过。
  trace?: LlmTrace;
  /** Per-feature bounds; defaults preserve the established 3 x 45s policy. */
  maxAttempts?: number;
  perAttemptTimeoutMs?: number;
};

function deepseek(model: string) {
  return deepseekProvider()(model);
}

/** 4xx 配置类错误（凭证/请求非法）重试无意义，直接抛出交给 errorResponse 映射。 */
function isNonRetryable(status: number | undefined): boolean {
  return status === 400 || status === 401 || status === 403 || status === 404;
}

/**
 * 埋点用的错误码：优先取上游 HTTP 状态（能区分限流/鉴权/网关故障），
 * 否则退回错误类名（AbortError / TypeError…）。绝不放错误消息进去——
 * 消息里可能回显 prompt 片段，那就等于把对话正文写进埋点（§1 禁止）。
 */
export function llmErrorCode(error: unknown): string {
  const status = APICallError.isInstance(error) ? error.statusCode : undefined;
  if (status !== undefined) return `HTTP_${status}`;
  return error instanceof Error ? error.name : "UNKNOWN";
}

type Attempt<T> =
  | { ok: true; object: T }
  | { ok: false; fatal: boolean; detail: string };

async function runStructuredAttempt<T>(
  options: StructuredOutputOptions,
): Promise<Attempt<T>> {
  const controller = new AbortController();
  const timeoutMs = Math.max(
    1_000,
    Math.min(options.perAttemptTimeoutMs ?? PER_ATTEMPT_TIMEOUT_MS, 45_000),
  );
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  const startedAt = Date.now();
  try {
    const result = await generateObject({
      model: deepseek(options.model),
      schema: jsonSchema<T>(options.schema),
      system: options.system,
      prompt: options.prompt,
      maxOutputTokens: options.maxTokens,
      maxRetries: 0, // 重试由 structuredOutput 控制
      abortSignal: controller.signal,
      telemetry: options.trace
        ? { functionId: options.trace.callName ?? options.trace.name }
        : undefined,
    });
    trackLLMRequest(options.track, {
      model: options.model,
      usage: result.usage,
      latencyMs: Date.now() - startedAt,
      ok: true,
    });
    return { ok: true, object: result.object as T };
  } catch (error) {
    trackLLMRequest(options.track, {
      model: options.model,
      latencyMs: Date.now() - startedAt,
      ok: false,
      errorCode: llmErrorCode(error),
    });
    const status = APICallError.isInstance(error)
      ? error.statusCode
      : undefined;
    return {
      ok: false,
      fatal: isNonRetryable(status),
      detail: llmErrorCode(error),
    };
  } finally {
    clearTimeout(timer);
  }
}

async function generateWithRetry<T>(
  options: StructuredOutputOptions,
): Promise<T> {
  const maxAttempts = Math.max(
    1,
    Math.min(options.maxAttempts ?? MAX_ATTEMPTS, MAX_ATTEMPTS),
  );
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const result = await runStructuredAttempt<T>(options);
    if (result.ok) return result.object;
    // 真正的 4xx 配置错误（凭证/请求非法）：直接抛出，别浪费重试。
    if (result.fatal) {
      throw new HttpError(
        502,
        "MODEL_UPSTREAM_ERROR",
        "AI 服务配置异常，请稍后重试。",
      );
    }
    // 超时/网络抖动/无法解析出合法对象：记录后重试。
    console.error(
      `structuredOutput attempt ${attempt}/${maxAttempts} failed:`,
      result.detail,
    );
  }

  throw new HttpError(
    502,
    "MODEL_OUTPUT_INVALID",
    "AI 多次生成均超时或返回了无法解析的结构，请稍后重试。",
  );
}

export async function structuredOutput<T>(
  options: StructuredOutputOptions,
): Promise<T> {
  if (!telemetryEnabled || !options.trace) return generateWithRetry(options);
  const { name, userId, sessionId, metadata } = options.trace;
  try {
    return await propagateAttributes(
      { traceName: name, userId, sessionId, metadata },
      () => generateWithRetry<T>(options),
    ) as T;
  } finally {
    await flushTraces();
  }
}
