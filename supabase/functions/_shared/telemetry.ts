import { context, trace } from "@opentelemetry/api";
import { BasicTracerProvider } from "@opentelemetry/sdk-trace-base";
import type { Span } from "@opentelemetry/sdk-trace-base";
import { AsyncLocalStorageContextManager } from "@opentelemetry/context-async-hooks";
import { LangfuseSpanProcessor } from "@langfuse/otel";
import { registerTelemetry } from "ai";
import { LangfuseVercelAiSdkIntegration } from "@langfuse/vercel-ai-sdk";

// Langfuse 可观测层：AI SDK 7 回调式 telemetry + OTel span 导出。
// 未配置 LANGFUSE_* 时整体禁用（本地/测试零开销），业务代码无需感知。
// Deno Edge 无 NodeSDK：手动装 BasicTracerProvider + AsyncLocalStorage 上下文，
// 保证流式响应体内创建的 generation span 仍归属请求级 trace。

declare const EdgeRuntime: { waitUntil(p: Promise<unknown>): void } | undefined;

/** LLM 调用的 trace 归属信息，由各 Edge Function 传入共享层。 */
export interface LlmTrace {
  /** trace 名称，用 Edge Function 名（如 "chat"、"analyze-diary"），便于筛选。 */
  name: string;
  /** 观测点名称：同一 trace 内有多次 LLM 调用时用它区分（如 "chat-reply"/"chat-signal"），缺省用 name。 */
  callName?: string;
  userId?: string;
  /** 会话分组：chat 用 conversation.id，其余无会话概念可省略。 */
  sessionId?: string;
  metadata?: Record<string, string>;
}

export const telemetryEnabled = Boolean(
  Deno.env.get("LANGFUSE_PUBLIC_KEY") && Deno.env.get("LANGFUSE_SECRET_KEY"),
);

let processor: LangfuseSpanProcessor | undefined;

// AI SDK 按 gen_ai 语义约定命名 span（"invoke_agent <model>"、"chat <model>"），
// 名称含模型会让 Langfuse 的筛选/评估器在换模型时失效（见 best-practices）。
// 这里统一改写：agent span 用 telemetry.functionId（gen_ai.agent.name），
// 其余 span 去掉模型后缀，模型信息仍在 gen_ai.request.model 属性上。
const renameProcessor = {
  onStart(span: Span): void {
    const agentName = span.attributes["gen_ai.agent.name"];
    if (
      typeof agentName === "string" && agentName &&
      span.name.startsWith("invoke_agent")
    ) {
      span.updateName(agentName);
      return;
    }
    const model = span.attributes["gen_ai.request.model"];
    if (typeof model === "string" && span.name.endsWith(` ${model}`)) {
      span.updateName(span.name.slice(0, -(model.length + 1)));
    }
  },
  onEnd(): void {},
  forceFlush: () => Promise.resolve(),
  shutdown: () => Promise.resolve(),
};

if (telemetryEnabled) {
  processor = new LangfuseSpanProcessor();
  trace.setGlobalTracerProvider(
    new BasicTracerProvider({ spanProcessors: [renameProcessor, processor] }),
  );
  context.setGlobalContextManager(
    new AsyncLocalStorageContextManager().enable(),
  );
  registerTelemetry(new LangfuseVercelAiSdkIntegration());
}

/**
 * 请求收尾时导出 trace。Edge Function 响应后实例可能立即冻结，
 * 必须用 waitUntil 保活到导出完成；本地 serve 无 EdgeRuntime 时直接 await。
 */
export async function flushTraces(): Promise<void> {
  if (!processor) return;
  const exportDone = processor.forceFlush().catch((error) => {
    console.warn("langfuse flush failed:", error);
  });
  if (typeof EdgeRuntime !== "undefined" && EdgeRuntime) {
    EdgeRuntime.waitUntil(exportDone);
  } else {
    await exportDone;
  }
}
