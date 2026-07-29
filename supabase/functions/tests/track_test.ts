// 埋点落库单测（_shared/track.ts）。
//
// 这里守两条底线，它们比「事件有没有记上」重要得多：
// 1. 埋点失败绝不能影响主流程——任何 sink 故障都必须被吞掉，调用点照常往下走。
// 2. PII / 正文绝不能进属性（docs/埋点方案.md §1）。
// 其余（usage 归一化、llm_request 属性形状）是成本报表正确性的前提，一并覆盖。

import type { SupabaseClient } from "npm:@supabase/supabase-js@2.110.0";
import { ServerEvent } from "../_shared/events.ts";
import { runInBackground } from "../_shared/background.ts";
import {
  normalizeTopic,
  normalizeUsage,
  sanitizeProps,
  TOPIC_OTHER,
  trackEvent,
  trackLLMRequest,
} from "../_shared/track.ts";

function assert(
  condition: unknown,
  message = "assertion failed",
): asserts condition {
  if (!condition) throw new Error(message);
}

type EventRow = {
  user_id: string | null;
  event: string;
  props: Record<string, unknown>;
  source: string;
};

/** 记录写入内容的假客户端；insertResult 决定 sink 的成败形态。 */
function stubClient(
  rows: EventRow[],
  insertResult: () => unknown,
): SupabaseClient {
  return {
    from: (_table: string) => ({
      insert: (row: EventRow) => {
        rows.push(row);
        return insertResult();
      },
    }),
  } as unknown as SupabaseClient;
}

/** 让 fire-and-forget 的微任务跑完，好观察它有没有把异常漏出来。 */
async function flush(): Promise<void> {
  for (let i = 0; i < 5; i++) await Promise.resolve();
}

// ==================== 底线 1：埋点失败不影响主流程 ====================

Deno.test("trackEvent swallows a rejecting sink and keeps the caller running", async () => {
  const rows: EventRow[] = [];
  let mainFlowReached = false;

  trackEvent(
    "u-1",
    ServerEvent.MATCH_REQUESTED,
    {},
    stubClient(rows, () => Promise.reject(new Error("network down"))),
  );
  // 关键：trackEvent 是同步返回的，下一行必须照常执行。
  mainFlowReached = true;

  await flush();
  assert(mainFlowReached, "caller must continue after a failing sink");
  assert(rows.length === 1, "insert should still have been attempted");
});

Deno.test("trackEvent swallows supabase-style { error } results", async () => {
  const rows: EventRow[] = [];
  trackEvent(
    "u-1",
    ServerEvent.DIARY_CREATED,
    { content_chars: 12 },
    // supabase-js 不 reject，错误藏在返回值里——不检查就等于静默丢数。
    stubClient(rows, () => Promise.resolve({ error: { message: "RLS deny" } })),
  );
  await flush();
  assert(rows.length === 1);
});

Deno.test("trackEvent swallows a sink that throws synchronously", async () => {
  let mainFlowReached = false;
  const exploding = {
    from: () => {
      throw new Error("client exploded");
    },
  } as unknown as SupabaseClient;

  trackEvent("u-1", ServerEvent.SIMULATION_REQUESTED, { years: 5 }, exploding);
  mainFlowReached = true;

  await flush();
  assert(mainFlowReached, "a throwing client must not escape trackEvent");
});

Deno.test("trackEvent swallows a missing service-role config", async () => {
  // 不传 client 时会去建 service_role 客户端；测试沙箱没有环境变量（也没有
  // --allow-env），必然失败——这正是生产里「密钥没配」的形态，同样不能抛。
  let mainFlowReached = false;
  trackEvent("u-1", ServerEvent.MATCH_CONDITIONS_READY, { candidate_count: 3 });
  mainFlowReached = true;
  await flush();
  assert(mainFlowReached, "missing config must not escape trackEvent");
});

Deno.test("runInBackground swallows rejected tasks", async () => {
  let reached = false;
  runInBackground(Promise.reject(new Error("boom")));
  reached = true;
  await flush();
  assert(reached, "background failures must never surface to the caller");
});

// ==================== 底线 2：PII / 正文属性被拒绝 ====================

Deno.test("sanitizeProps rejects PII-prone keys", () => {
  const clean = sanitizeProps({
    // 全部命中键名黑名单：正文与身份信息（§1）
    message: "我在纠结要不要辞职",
    transcript: "今天想清楚了一件事",
    content: "对话正文",
    question: "要不要转行",
    phone: "13812345678",
    name: "王一",
    email: "a@b.com",
    access_token: "eyJhbGciOi",
    // 合法的派生值必须留下
    content_chars: 128,
  });
  for (
    const denied of [
      "message",
      "transcript",
      "content",
      "question",
      "phone",
      "name",
      "email",
      "access_token",
    ]
  ) {
    assert(!(denied in clean), `"${denied}" must be dropped`);
  }
  assert(clean.content_chars === 128, "derived scalar must survive");
});

Deno.test("sanitizeProps rejects free text smuggled under an innocent key", () => {
  // 键名没进黑名单，但值是整段对话正文——用长度兜住这一层。
  const body = "用户：我三十岁了还要不要转行？".repeat(40);
  const clean = sanitizeProps({ note: body, topic: "职业" });
  assert(!("note" in clean), "oversized string must be dropped");
  assert(clean.topic === "职业", "short label must survive");
});

Deno.test("sanitizeProps rejects non-scalar values", () => {
  const clean = sanitizeProps({
    // 对象/数组几乎一定是「把整个结构体倒进埋点」，其中往往就藏着正文。
    crossroads: { summary: "稳定与热爱的冲突" } as unknown as string,
    matches: [1, 2, 3] as unknown as string,
    // NaN / Infinity 会被 JSON 写成 null，在指标里看不出是坏数据。
    ratio: Number.NaN,
    latency_ms: Number.POSITIVE_INFINITY,
    ok: true,
  });
  assert(!("crossroads" in clean) && !("matches" in clean));
  assert(!("ratio" in clean) && !("latency_ms" in clean));
  assert(clean.ok === true, "booleans must survive");
});

Deno.test("sanitizeProps caps prop count and keeps null", () => {
  const many: Record<string, number> = {};
  for (let i = 0; i < 30; i++) many[`k${i}`] = i;
  const clean = sanitizeProps(many);
  assert(
    Object.keys(clean).length === 16,
    `expected 16, got ${Object.keys(clean).length}`,
  );
  assert(sanitizeProps({ error_code: null }).error_code === null);
});

Deno.test("trackEvent sanitizes before writing", async () => {
  const rows: EventRow[] = [];
  trackEvent(
    "u-1",
    ServerEvent.CHAT_TURN_COMPLETED,
    {
      turn_index: 2,
      message: "不能落库的对话正文",
    },
    stubClient(rows, () => Promise.resolve({ error: null })),
  );
  await flush();
  assert(rows.length === 1);
  assert(rows[0].props.turn_index === 2);
  assert(!("message" in rows[0].props), "PII must not reach the table");
  assert(rows[0].source === "server", "server writes must be tagged as such");
  assert(rows[0].user_id === "u-1");
});

// ==================== 值域收敛：合法键名也可能装用户内容 ====================

Deno.test("normalizeTopic keeps the four ExploreTopic values", () => {
  // 必须与 iOS 的 ExploreTopic rawValue 完全一致，否则同一事件两侧取值对不上账。
  for (const topic of ["职业", "家庭", "升学", "情感"]) {
    assert(normalizeTopic(topic) === topic, `"${topic}" must pass through`);
  }
  assert(
    normalizeTopic(" 职业 ") === "职业",
    "前后空白应被容忍而不是打成 custom",
  );
});

Deno.test("normalizeTopic collapses free text into custom", () => {
  // 这正是修复的那条 PII 通道：validate.ts 只保证「字符串且 ≤40 字」，
  // 用户完全可以把处境原话填进 topic。
  const userText = "我三十岁了要不要辞掉稳定工作去创业";
  assert(normalizeTopic(userText) === "custom", "自由文本必须收敛掉");
  assert(normalizeTopic(undefined) === "custom", "缺省也算未知话题");
  assert(normalizeTopic(null) === "custom");
  assert(normalizeTopic("") === "custom");
  assert(normalizeTopic("career") === "custom", "英文 key 不是合法取值");
});

Deno.test("normalizeTopic output is a closed set", () => {
  // 结构性保证：无论喂什么，输出都只可能是这五个值之一，PII 无处可藏。
  const allowed = new Set(["职业", "家庭", "升学", "情感", TOPIC_OTHER]);
  const inputs = [
    "职业",
    "13812345678",
    "我叫王一，在纠结要不要转行",
    "x".repeat(40),
    undefined,
    null,
    "  ",
  ];
  for (const input of inputs) {
    assert(
      allowed.has(normalizeTopic(input)),
      `unexpected topic for ${JSON.stringify(input)}`,
    );
  }
});

// ==================== usage 归一化（成本报表的前提） ====================

Deno.test("normalizeUsage reads ai@7 and legacy field names", () => {
  const modern = normalizeUsage({ inputTokens: 1200, outputTokens: 340 });
  assert(modern.prompt_tokens === 1200 && modern.completion_tokens === 340);

  const legacy = normalizeUsage({ promptTokens: 10, completionTokens: 20 });
  assert(legacy.prompt_tokens === 10 && legacy.completion_tokens === 20);
});

Deno.test("normalizeUsage degrades to zero instead of writing garbage", () => {
  for (const bad of [undefined, null, {}, { inputTokens: Number.NaN }, "x"]) {
    const usage = normalizeUsage(bad);
    assert(usage.prompt_tokens === 0 && usage.completion_tokens === 0);
  }
  // 小数/负数会让 SUM 出来的成本不可解释，统一取整并钳到非负。
  const odd = normalizeUsage({ inputTokens: 12.7, outputTokens: -5 });
  assert(odd.prompt_tokens === 12 && odd.completion_tokens === 0);
});

// ==================== llm_request 属性形状（§3.4） ====================

Deno.test("trackLLMRequest emits the §3.4 property shape", async () => {
  const rows: EventRow[] = [];
  const sink = stubClient(rows, () => Promise.resolve({ error: null }));
  trackLLMRequest({ userId: "u-1", feature: "match" }, {
    model: "deepseek-v4-pro",
    usage: { inputTokens: 900, outputTokens: 210 },
    latencyMs: 1234.9,
    ok: true,
  }, sink);
  await flush();

  assert(rows.length === 1);
  assert(rows[0].event === ServerEvent.LLM_REQUEST);
  const props = rows[0].props;
  assert(props.function === "match", "成本要能按功能归集");
  assert(props.model === "deepseek-v4-pro");
  assert(props.prompt_tokens === 900 && props.completion_tokens === 210);
  // 毫秒取整：小数会让延迟分位数在 SQL 里变成不可读的长小数。
  assert(props.latency_ms === 1234, `expected 1234, got ${props.latency_ms}`);
  assert(props.ok === true);
  assert(props.error_code === null, "成功时也要显式写 null，便于 SQL 过滤");
});

Deno.test("trackLLMRequest without context is a no-op", async () => {
  const rows: EventRow[] = [];
  const sink = stubClient(rows, () => Promise.resolve({ error: null }));
  // 无 ctx 时必须完全静默——可选埋点的调用点靠这个免去判断。
  trackLLMRequest(undefined, {
    model: "deepseek-v4-pro",
    latencyMs: 1,
    ok: false,
  }, sink);
  await flush();
  assert(rows.length === 0, "missing context must not write anything");
});

Deno.test("trackLLMRequest records failed attempts with an error code", async () => {
  const rows: EventRow[] = [];
  const sink = stubClient(rows, () => Promise.resolve({ error: null }));
  // 失败的尝试同样打到了 DeepSeek，也同样烧钱，必须记账。
  trackLLMRequest({ userId: null, feature: "chat" }, {
    model: "deepseek-v4-flash",
    latencyMs: 45_000,
    ok: false,
    errorCode: "HTTP_429",
  }, sink);
  await flush();
  assert(rows.length === 1);
  assert(rows[0].props.ok === false);
  assert(rows[0].props.error_code === "HTTP_429");
  assert(rows[0].props.prompt_tokens === 0, "失败时无 usage，记 0 而不是 null");
  assert(rows[0].user_id === null, "匿名/未知用户也要落库");
});
