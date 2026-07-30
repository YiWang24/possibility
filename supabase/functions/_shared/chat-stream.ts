import { streamText } from "ai";
import { propagateAttributes } from "@langfuse/tracing";
import { deepseekProvider } from "./deepseek.ts";
import { llmErrorCode } from "./llm.ts";
import { streamWithRetry } from "./stream-retry.ts";
import { type LlmTrace, telemetryEnabled } from "./telemetry.ts";
import { type LLMTrackContext, trackLLMRequest } from "./track.ts";

// 用 Vercel AI SDK 承接“认识自己”探索对话的流式回复，后端为 DeepSeek v4。
//
// 短超时 + 空则重试（见 streamWithRetry）：每次尝试给一个较短墙钟超时（默认 45s，
// 实测正常回复 <35s 完成），超时/报错且“尚未吐出任何 token”时换一条新连接重试，
// 避免偶发的上游挂起把整个请求卡满导致前端看不到任何回复。
//
// 关键：DeepSeek v4 默认开启 reasoning，会占用 max_tokens 预算并延后首字（reasoning 期间
// textStream 无正文），关不掉会整段超时挂起。关闭由 deepseek.ts 的 provider 在 HTTP 层
// 强制注入 thinking:disabled（@ai-sdk/deepseek@3.0.13 的 providerOptions 不生效，见 deepseek.ts）。

export interface StreamChatReplyOptions {
  model: string;
  system: string;
  messages: Array<{ role: "user" | "assistant"; content: string }>;
  maxOutputTokens: number;
  onDelta: (text: string) => void;
  cancelSignal?: AbortSignal;
  maxAttempts?: number;
  attemptTimeoutMs?: number;
  /// 传入即上报 llm_request（每次尝试一条，重试同样烧钱）。不传则静默跳过。
  track?: LLMTrackContext;
  /// 传入且已配置 Langfuse 环境变量时上报调用链路 trace。不传则静默跳过。
  trace?: LlmTrace;
}

/**
 * 单次流式尝试：把增量喂给 emit，并在结束/失败时上报一条 llm_request。
 *
 * 上报路径三选一，用 reported 去重：onFinish（正常结束，唯一能拿到 usage 的地方）、
 * onError/catch（上游报错）、循环后的 aborted 判定（超时或客户端断开）。
 */
async function runStreamAttempt(
  options: StreamChatReplyOptions,
  emit: (text: string) => void,
  signal: AbortSignal,
): Promise<void> {
  const startedAt = Date.now();
  let reported = false;
  const report = (ok: boolean, usage?: unknown, errorCode?: string): void => {
    if (reported) return;
    reported = true;
    trackLLMRequest(options.track, {
      model: options.model,
      usage,
      latencyMs: Date.now() - startedAt,
      ok,
      errorCode,
    });
  };

  try {
    const result = streamText({
      model: deepseekProvider()(options.model),
      system: options.system,
      messages: options.messages,
      maxOutputTokens: options.maxOutputTokens,
      abortSignal: signal,
      telemetry: options.trace
        ? { functionId: options.trace.callName ?? options.trace.name }
        : undefined,
      onFinish: ({ usage }) => report(true, usage),
      onError: ({ error }) => {
        console.error(JSON.stringify({
          level: "error",
          event: "llm_stream_error",
          error_code: llmErrorCode(error),
        }));
        report(false, undefined, llmErrorCode(error));
      },
    });
    for await (const delta of result.textStream) {
      if (signal.aborted) break;
      emit(delta);
    }
    // 正常结束由 onFinish 上报（带 usage）；这里只兜住被超时/取消打断的尝试。
    if (signal.aborted) report(false, undefined, "ABORTED");
  } catch (error) {
    report(false, undefined, llmErrorCode(error));
    throw error;
  }
}

/**
 * 通过 Vercel AI SDK（@ai-sdk/deepseek）流式生成对话回复，内建短超时 + 空则重试。
 * 返回完整回复文本（若始终为空由调用方判定失败）。
 */
export function streamChatReply(
  options: StreamChatReplyOptions,
): Promise<string> {
  const run = () =>
    streamWithRetry({
      maxAttempts: options.maxAttempts ?? 3,
      attemptTimeoutMs: options.attemptTimeoutMs ?? 45_000,
      cancelSignal: options.cancelSignal,
      onDelta: options.onDelta,
      runAttempt: (emit, signal) => runStreamAttempt(options, emit, signal),
    });
  if (!telemetryEnabled || !options.trace) return run();
  const { name, userId, sessionId, metadata } = options.trace;
  return propagateAttributes(
    { traceName: name, userId, sessionId, metadata },
    run,
  );
}
