"use client";
import {
  createPossibilityClient,
  invokeFunction,
  type PossibilityClient,
} from "@possibility/api-client";
import type { EdgeFunctionName } from "@possibility/shared-types";
import { requestKey, takeBootPrefetch } from "./boot-prefetch";
import { SUPABASE_URL, SUPABASE_ANON_KEY } from "./config";

let client: PossibilityClient | null = null;

export function supabase(): PossibilityClient {
  if (!client) {
    client = createPossibilityClient({
      supabaseUrl: SUPABASE_URL,
      supabaseAnonKey: SUPABASE_ANON_KEY,
    });
  }
  return client;
}

/**
 * 当前 JWT。匿名登录已停用，没有会话就是真的没登录 —— 直接抛，
 * 让调用方（AuthWall / AuthGate）把用户带回登录页，而不是静默发无效请求。
 */
export async function jwt(): Promise<string> {
  const { data } = await supabase().auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new Error("未登录");
  return token;
}

/**
 * 可合流的幂等读。
 *
 * 只列「同参数并发调用必然返回同一份数据」的读接口 —— 写接口绝不能进来：两次相同的
 * save-profile 是两次真实写入，合并掉就是丢数据。名单保持最小，需要时再逐个加。
 */
const COALESCABLE: ReadonlySet<string> = new Set(["get-profile", "list-diary"]);

/** 同参数在途请求。键与抢跑同源（requestKey），保证两套机制指的是同一个请求。 */
const inFlight = new Map<string, Promise<unknown>>();

/**
 * 丢弃所有在途/抢跑结果。换账号时必须调用。
 *
 * 合流键只有函数名 + body，不含会话身份。登录/登出瞬间若正好有一个 get-profile 在途，
 * 后面的强制刷新会被合流到**上一个账号**的响应上，还会被 loadProfile 的 60s TTL 缓存住。
 * 窗口很窄但真实存在，而且是静默串号，所以在 auth 变更处直接把两个池子清掉。
 */
export function dropCachedCalls() {
  inFlight.clear();
  if (typeof window !== "undefined") delete window.__bootPrefetch;
}

/** 抢跑命中就用抢跑结果，否则走真实请求。合流层之下的单次执行体。 */
async function runCall<T>(
  name: EdgeFunctionName,
  body?: Record<string, unknown>,
): Promise<T> {
  const early = await takeBootPrefetch<T>(name, body);
  if (early) return early.data;
  return invokeFunction<T>(supabase(), name, body);
}

/**
 * Edge Function 调用（invokeFunction 自带会话 JWT；无会话时由后端 401）
 *
 * 两层优化，对调用方完全透明：
 *
 * 1. 抢跑命中 —— 引导脚本在 HTML 解析阶段就把首屏那几个请求发出去了
 *    （见 lib/boot-prefetch.ts），这里直接取结果，省掉一整个往返。一次性消费，
 *    之后的同名调用（含 force 刷新）照常走真实请求。
 * 2. 并发合流 —— 首页 store 和 DiaryCard 会同时要同一份 list-diary，
 *    合流后只出一次网络请求。仅对 COALESCABLE 里的幂等读生效。
 *
 * 任何一层未命中或失败都回落到原来的 invokeFunction 路径，语义不变。
 */
export async function callFunction<T>(
  name: EdgeFunctionName,
  body?: Record<string, unknown>,
): Promise<T> {
  if (!COALESCABLE.has(name)) return runCall<T>(name, body);

  const key = requestKey(name, body);
  const running = inFlight.get(key) as Promise<T> | undefined;
  if (running) return running;

  const pending = runCall<T>(name, body);
  inFlight.set(key, pending);
  // 只在自己还占着位时清理，避免误删后来者。catch 挂在派生链上：
  // pending 本身由调用方处理异常，这里只是防未处理拒绝告警。
  void pending
    .finally(() => {
      if (inFlight.get(key) === pending) inFlight.delete(key);
    })
    .catch(() => {});
  return pending;
}
