// Edge Function 的「响应之后再跑」原语。
//
// 单独成模块而不是挂在 track.ts 下：埋点（track.ts）和错误上报（sentry.ts）都要用它，
// 但错误上报绝不该因此把 supabase-js 拖进依赖图——Sentry 必须在埋点链路整个坏掉时
// 依然能工作，而且每个 Edge Function 的冷启动都在为多余的依赖买单。

// Supabase Edge Functions 的后台任务 API：响应返回后仍保持 isolate 存活，
// 直到传入的 promise 结束（受 150s 墙钟约束）。类型未随 Deno 内置，故此处声明。
declare const EdgeRuntime:
  | { waitUntil(promise: Promise<unknown>): void }
  | undefined;

/** 把 unknown 错误压成一行可读日志，避免 `[object Object]`。 */
export function errorText(error: unknown): string {
  return error instanceof Error
    ? `${error.name}: ${error.message}`
    : String(error);
}

/**
 * 把非关键任务放到响应之后跑：优先用 EdgeRuntime.waitUntil 保活，
 * 运行时不支持时退化为 fire-and-forget。任务自身的异常一律吞掉——
 * 调用点已经把响应发出去了，这里再抛只会变成 unhandled rejection。
 */
export function runInBackground(task: Promise<unknown>): void {
  const guarded = task.catch((error: unknown) => {
    console.error("background task failed:", errorText(error));
  });
  if (typeof EdgeRuntime !== "undefined" && EdgeRuntime?.waitUntil) {
    EdgeRuntime.waitUntil(guarded);
  } else {
    void guarded;
  }
}
