// 通用“空则重试”的流式驱动器，与具体 LLM SDK 解耦，便于在 deno test 沙箱里单测
//（不引入 ai / @ai-sdk/anthropic，避免其 @vercel/oidc 在导入期调用 os.hostname()
// 需要 --allow-sys）。具体的 Anthropic/Vercel 流式实现见 chat-stream.ts。

import { errorText } from "./background.ts";

export interface StreamWithRetryOptions {
  maxAttempts: number;
  attemptTimeoutMs: number;
  /** 每次尝试执行一次流式生成，把增量文本喂给 emit；signal 触发即应尽快中止。 */
  runAttempt: (
    emit: (text: string) => void,
    signal: AbortSignal,
  ) => Promise<void>;
  /** 已确认收到的每个增量（通常直接转发到客户端 SSE）。 */
  onDelta: (text: string) => void;
  /** 客户端断开等外部取消信号；取消后不再重试。 */
  cancelSignal?: AbortSignal;
}

/**
 * 只有当一次尝试没有产出任何文本时才重试——网关挂起的失败模式就是“一个 token 都不吐”，
 * 因此已转发给客户端的增量绝不会因重试而重复。返回累计文本（可能为空，由调用方判失败）。
 */
export async function streamWithRetry(
  options: StreamWithRetryOptions,
): Promise<string> {
  let accumulated = "";
  for (let attempt = 1; attempt <= options.maxAttempts; attempt++) {
    if (options.cancelSignal?.aborted) break;

    const timeout = AbortSignal.timeout(options.attemptTimeoutMs);
    const signal = options.cancelSignal
      ? AbortSignal.any([timeout, options.cancelSignal])
      : timeout;

    const emit = (text: string) => {
      accumulated += text;
      options.onDelta(text);
    };

    try {
      await options.runAttempt(emit, signal);
    } catch (error) {
      console.error(JSON.stringify({
        level: "error",
        event: "chat_stream_attempt_failed",
        attempt,
        error_type: errorText(error),
      }));
    }

    // 拿到内容即结束；只有空尝试才会进入下一轮重试。
    if (accumulated.trim()) break;
    if (options.cancelSignal?.aborted) break;
    if (attempt < options.maxAttempts) {
      console.warn(
        `chat stream attempt ${attempt} produced no text, retrying…`,
      );
    }
  }
  return accumulated;
}
