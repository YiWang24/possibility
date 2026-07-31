import { context, trace } from "@opentelemetry/api";
import { BasicTracerProvider } from "@opentelemetry/sdk-trace-base";
import type { Span } from "@opentelemetry/sdk-trace-base";
import { AsyncLocalStorageContextManager } from "@opentelemetry/context-async-hooks";
import { LangfuseSpanProcessor } from "@langfuse/otel";
import { registerTelemetry } from "ai";
import { LangfuseVercelAiSdkIntegration } from "@langfuse/vercel-ai-sdk";
import { telemetryEnabled } from "./telemetry-config.ts";

// Langfuse 可观测层：AI SDK 7 回调式 telemetry + OTel span 导出。
// 未配置 LANGFUSE_* 时整体禁用（本地/测试零开销），业务代码无需感知。
// Deno Edge 无 NodeSDK：手动装 BasicTracerProvider + AsyncLocalStorage 上下文，
// 保证流式响应体内创建的 generation span 仍归属请求级 trace。

interface EdgeRuntimeLike {
  waitUntil(p: Promise<unknown>): void;
}

// 只想问「遥测开着吗」的调用方请直接 import telemetry-config.ts —— 从这里拿同样拿得到，
// 但会连带把下面整条 OTel 装配链求值一遍。此处转出口只为兼容既有 import。
export { type LlmTrace, telemetryEnabled } from "./telemetry-config.ts";

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
  const edgeRuntime = Reflect.get(globalThis, "EdgeRuntime") as
    | EdgeRuntimeLike
    | undefined;
  if (edgeRuntime !== undefined) {
    edgeRuntime.waitUntil(exportDone);
  } else {
    await exportDone;
  }
}
