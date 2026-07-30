import { streamText } from "ai";
import { propagateAttributes } from "@langfuse/tracing";
import { deepseekProvider } from "./deepseek.ts";
import { streamWithRetry } from "./stream-retry.ts";
import { type LlmTrace, telemetryEnabled } from "./telemetry.ts";

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
  trace?: LlmTrace;
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
      runAttempt: async (emit, signal) => {
        const result = streamText({
          model: deepseekProvider()(options.model),
          system: options.system,
          messages: options.messages,
          maxOutputTokens: options.maxOutputTokens,
          abortSignal: signal,
          onError: ({ error }) => console.error("streamText error:", error),
          telemetry: options.trace
            ? { functionId: options.trace.callName ?? options.trace.name }
            : undefined,
        });
        for await (const delta of result.textStream) {
          if (signal.aborted) break;
          emit(delta);
        }
      },
    });
  if (!telemetryEnabled || !options.trace) return run();
  const { name, userId, sessionId, metadata } = options.trace;
  return propagateAttributes(
    { traceName: name, userId, sessionId, metadata },
    run,
  );
}
