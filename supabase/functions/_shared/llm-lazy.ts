// LLM 栈的惰性入口。
//
// 为什么需要它：Edge Function 的模块图在 handler 跑之前就被整体求值一遍。llm.ts 顶层
// 拉的是 `ai` + `@langfuse/tracing` + `@opentelemetry/*`，本机实测光求值就要 152~330ms
// （对比 cors.ts 0.2ms、errors.ts 0.8ms），Supabase 那侧的 CPU 只会更慢。
//
// 代价是这笔钱在「根本用不到 LLM 的请求」上照付不误：
//   - CORS 预检（OPTIONS）——handler 第一行就 return，却要等整个 AI SDK 求值完;
//   - 鉴权/参数校验失败的 401 / 400;
//   - community 六个 action 里有五个（list_bounties 等）压根不碰模型。
//
// 换成动态 import 之后，这些路径不再触发求值；真要调模型的请求把这笔开销推迟到
// 第一次调用处，总量不变、绝不更差。eszip 里模块本来就打包好了，动态 import 不产生
// 额外网络往返，推迟的只是 parse + execute。
//
// 只有真正需要 `ai` 运行时符号的模块（chat-stream.ts 用 APICallError）才直接 import
// llm.ts；其余一律走这里。

import type { StructuredOutputOptions } from "./llm.ts";
import type { StreamChatReplyOptions } from "./chat-stream.ts";

export type { StreamChatReplyOptions, StructuredOutputOptions };

/** 结构化输出。签名与 llm.ts 的同名导出一致，只是把模块求值推迟到首次调用。 */
export async function structuredOutput<T>(
  options: StructuredOutputOptions,
): Promise<T> {
  const { structuredOutput: impl } = await import("./llm.ts");
  return await impl<T>(options);
}

/**
 * 流式对话回复。签名与 chat-stream.ts 的同名导出一致。
 * chat-stream.ts 顶层就 import 了 `ai`，所以 chat 只惰性化 structuredOutput 没有意义——
 * 两条都得走这里，模块图才真的不在启动时求值。
 */
export async function streamChatReply(
  options: StreamChatReplyOptions,
): Promise<string> {
  const { streamChatReply: impl } = await import("./chat-stream.ts");
  return await impl(options);
}
