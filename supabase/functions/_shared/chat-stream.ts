import { createAnthropic } from "@ai-sdk/anthropic";
import { streamText } from "ai";
import { runtimeConfig } from "./config.ts";
import { streamWithRetry } from "./stream-retry.ts";

// 用 Vercel AI SDK 承接“认识自己”探索对话的流式回复。
//
// 背景（见 memory: project-llm-gateway-limits）：ModelBest 网关是不完整的
// Anthropic 兼容层，纯文本生成本身可靠，但仍有 ~25% 请求进入 ~135s+ 的持续挂起
// 窗口——挂起时一个 token 都不吐。旧实现用单次 messages.stream + 150s 超时，撞上
// 挂起窗口就整整卡满 150s，最终前端超时报错、用户看不到任何回复。
//
// 修复策略：每次尝试给一个较短的墙钟超时（默认 45s，实测正常回复 <35s 完成），
// 超时/报错且“尚未吐出任何 token”时换一条新连接重试（见 streamWithRetry）。

let provider: ReturnType<typeof createAnthropic> | undefined;

function chatProvider(): ReturnType<typeof createAnthropic> {
  // Anthropic 官方 SDK 的 baseURL 不含 /v1（内部补 /v1/messages）；
  // Vercel @ai-sdk/anthropic 约定 baseURL 已含 /v1，只补 /messages。
  // 复用同一个 ANTHROPIC_BASE_URL 环境变量，这里补上 /v1 差异。
  provider ??= createAnthropic({
    apiKey: runtimeConfig.anthropicApiKey,
    baseURL: `${runtimeConfig.anthropicBaseUrl.replace(/\/+$/, "")}/v1`,
  });
  return provider;
}

export interface StreamChatReplyOptions {
  model: string;
  system: string;
  messages: Array<{ role: "user" | "assistant"; content: string }>;
  maxOutputTokens: number;
  onDelta: (text: string) => void;
  cancelSignal?: AbortSignal;
  maxAttempts?: number;
  attemptTimeoutMs?: number;
}

/**
 * 通过 Vercel AI SDK（@ai-sdk/anthropic 指向 ModelBest 网关）流式生成对话回复，
 * 内建短超时 + 空则重试。返回完整回复文本（若始终为空由调用方判定失败）。
 */
export function streamChatReply(
  options: StreamChatReplyOptions,
): Promise<string> {
  return streamWithRetry({
    maxAttempts: options.maxAttempts ?? 3,
    attemptTimeoutMs: options.attemptTimeoutMs ?? 45_000,
    cancelSignal: options.cancelSignal,
    onDelta: options.onDelta,
    runAttempt: async (emit, signal) => {
      const result = streamText({
        model: chatProvider()(options.model),
        system: options.system,
        messages: options.messages,
        maxOutputTokens: options.maxOutputTokens,
        abortSignal: signal,
        onError: ({ error }) => console.error("streamText error:", error),
      });
      for await (const delta of result.textStream) {
        if (signal.aborted) break;
        emit(delta);
      }
    },
  });
}
