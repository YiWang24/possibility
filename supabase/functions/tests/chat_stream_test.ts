import { streamWithRetry } from "../_shared/stream-retry.ts";

function assert(
  condition: unknown,
  message = "assertion failed",
): asserts condition {
  if (!condition) throw new Error(message);
}

// runAttempt 立即返回时 AbortSignal.timeout 会留下待触发的定时器，
// 与网络无关，这里关闭 op/resource 检查专注验证重试语义。
const opts = { sanitizeOps: false, sanitizeResources: false };

Deno.test(
  "streamWithRetry retries on empty attempt, no duplicate deltas",
  opts,
  async () => {
    const deltas: string[] = [];
    let attempts = 0;
    const text = await streamWithRetry({
      maxAttempts: 3,
      attemptTimeoutMs: 1_000,
      onDelta: (t) => deltas.push(t),
      runAttempt: (emit) => {
        attempts++;
        // 第一次尝试挂起（不吐 token），第二次才成功。
        if (attempts >= 2) {
          emit("你好");
          emit("，我在");
        }
        return Promise.resolve();
      },
    });
    assert(attempts === 2, `expected 2 attempts, got ${attempts}`);
    assert(text === "你好，我在", `unexpected text: ${text}`);
    // 关键：第一次空尝试没有向客户端发过任何增量，不会重复。
    assert(deltas.join("|") === "你好|，我在", `unexpected deltas: ${deltas}`);
  },
);

Deno.test(
  "streamWithRetry keeps partial text and does not retry once non-empty",
  opts,
  async () => {
    const deltas: string[] = [];
    let attempts = 0;
    const text = await streamWithRetry({
      maxAttempts: 3,
      attemptTimeoutMs: 1_000,
      onDelta: (t) => deltas.push(t),
      runAttempt: (emit) => {
        attempts++;
        emit("X"); // 已吐出内容
        throw new Error("boom mid-stream");
      },
    });
    assert(attempts === 1, `expected no retry, got ${attempts} attempts`);
    assert(text === "X", `unexpected text: ${text}`);
    assert(deltas.join("") === "X");
  },
);

Deno.test(
  "streamWithRetry returns empty after exhausting maxAttempts",
  opts,
  async () => {
    let attempts = 0;
    const text = await streamWithRetry({
      maxAttempts: 3,
      attemptTimeoutMs: 1_000,
      onDelta: () => {},
      runAttempt: () => {
        attempts++;
        return Promise.resolve(); // 始终不吐 token
      },
    });
    assert(attempts === 3, `expected 3 attempts, got ${attempts}`);
    assert(text === "", `expected empty text, got: ${text}`);
  },
);

Deno.test(
  "streamWithRetry skips attempts when cancelSignal already aborted",
  opts,
  async () => {
    let attempts = 0;
    const text = await streamWithRetry({
      maxAttempts: 3,
      attemptTimeoutMs: 1_000,
      cancelSignal: AbortSignal.abort(),
      onDelta: () => {},
      runAttempt: () => {
        attempts++;
        return Promise.resolve();
      },
    });
    assert(attempts === 0, `expected 0 attempts, got ${attempts}`);
    assert(text === "");
  },
);

Deno.test(
  "streamWithRetry aborts each attempt after attemptTimeoutMs",
  opts,
  async () => {
    let sawAbort = false;
    const text = await streamWithRetry({
      maxAttempts: 1,
      attemptTimeoutMs: 30,
      onDelta: () => {},
      runAttempt: (_emit, signal) =>
        new Promise<void>((resolve) => {
          signal.addEventListener("abort", () => {
            sawAbort = true;
            resolve();
          });
        }),
    });
    assert(sawAbort, "expected per-attempt timeout to abort the signal");
    assert(text === "");
  },
);
