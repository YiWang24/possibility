/**
 * 首屏取数抢跑 —— 把首页那两个 Edge Function 请求从「水合之后」提到「HTML 解析期间」。
 *
 * 背景：首页是静态预渲染的壳，数据全靠 HomeView 挂载后的 useEffect 去拉。所以真实
 * 顺序是 HTML → 下载 ~270KB JS → React 水合 → 才发出第一个请求，几百毫秒的网络
 * 往返被完整压在最后。而 Edge Function 冷启动本身就要 1.2~2.1s（见 _shared/cors.ts
 * 里的实测记录），这段等待期间浏览器其实完全空闲。
 *
 * 做法：layout 在 <body> 首节点内联一段脚本，从 localStorage 直接读会话并 fetch，
 * 结果挂到 window 上；等 JS 真正跑起来时请求往往已经在途甚至已完成。实测产物确认
 * 这个内联 script 是解析阻塞执行的（HTML 里没有 __next_s 队列），所以它确实早于
 * 那 16 个 async chunk 的下载。
 *
 * 严格附加：抢跑失败（过期、401、断网）一律回落到原来的 invokeFunction 路径，
 * 不改变任何业务语义。
 */
import type { EdgeFunctionName } from "@possibility/shared-types";

/**
 * 首页的 list-diary 请求参数。
 *
 * 首页原本会发两次 list-diary：store.ts 要 50 条算「探索天数」，DiaryCard 另外要
 * 100 条渲染卡片 —— 50 条是 100 条的真子集，等于白白多花一整个 Edge Function 往返
 * （冷启动时 1.2~2.1s）。现在两处统一走这份参数，配合 lib/supabase.ts 的并发合流
 * 合成一次请求；抢跑名单也用它，三处同源不会漂移。
 *
 * 顺带修正了一处旧行为：探索天数原先只在最近 50 条里找最早日期，日记超过 50 篇时
 * 会算少。扫 100 条更接近真实值。
 */
export const DIARY_LIST_BODY = { limit: 100, offset: 0 } as const;

/** 会话过期前多久就不抢跑：拿快过期的 token 只会换来 401，不如让 SDK 先刷新。 */
const EXPIRY_MARGIN_MS = 30_000;

interface PrefetchSpec {
  name: EdgeFunctionName;
  /** null 表示不带 body —— 与 supabase-js 的 invoke(name) 行为一致（不发 Content-Type）。 */
  body: Record<string, unknown> | null;
}

/**
 * 抢跑名单。只放「首页挂载必定发生、且与用户操作无关」的读请求。
 *
 * persona 不在此列：它串在 get-profile 之后，且带防抖与快照去重（避免重复打 LLM），
 * 抢跑会绕开那层保护。
 */
const SPECS: PrefetchSpec[] = [
  { name: "get-profile", body: null },
  { name: "list-diary", body: { ...DIARY_LIST_BODY } },
];

/**
 * 请求身份 = 函数名 + body。抢跑缓存与并发合流（lib/supabase.ts）共用这一个格式。
 *
 * 必须带 body：list-diary 不止一个调用点，参数不同拿到的数据也不同。只按名字匹配
 * 会让日记页消费掉首页的结果，静默少拿数据。
 *
 * 键格式只此一处实现 —— 内联脚本里的键是构建时用这个函数算好后直接嵌进去的，不在
 * 浏览器里重算。两边各写一遍必然漂移，而且漂移是静默的（永远命不中，只是没提速）。
 *
 * 依赖 JSON.stringify 的属性顺序 = 字面量书写顺序，所以调用方的 body 必须与 SPECS
 * 里的写法一致；这也是首页两处都改用 DIARY_LIST_BODY 的原因。
 */
export function requestKey(name: string, body: unknown): string {
  return `${name} ${JSON.stringify(body ?? null)}`;
}

/** 抢跑结果：成功才带 data，其余一律当未命中处理。 */
interface BootHit<T> {
  ok: boolean;
  data?: T;
}

declare global {
  interface Window {
    __bootPrefetch?: Record<string, Promise<BootHit<unknown>> | undefined>;
  }
}

/**
 * 取走一条抢跑结果（一次性）。
 *
 * 先删后 await：否则同一键的并发调用会一起挂在同一个 promise 上，而其中只有一个
 * 该拿到它。删掉之后，后来者走正常请求路径。
 *
 * 返回 null 的所有情形（无此键 / 请求失败 / 非浏览器环境）调用方都应回落到原路径。
 */
export async function takeBootPrefetch<T>(
  name: string,
  body?: Record<string, unknown>,
): Promise<{ data: T } | null> {
  if (typeof window === "undefined") return null;
  const store = window.__bootPrefetch;
  if (!store) return null;

  const key = requestKey(name, body);
  const pending = store[key];
  if (!pending) return null;
  delete store[key];

  try {
    const hit = await pending;
    if (!hit?.ok) return null;
    return { data: hit.data as T };
  } catch {
    return null;
  }
}

/** 内联进 HTML 的字面量：转义 `<` 防止字符串里出现 `</script>` 提前闭合脚本。 */
function inlineJSON(value: unknown): string {
  return JSON.stringify(value).replace(/</g, "\\u003c");
}

/** 构建时算好每条抢跑的缓存键，连同请求参数一起嵌进内联脚本。 */
const SCRIPT_SPECS = SPECS.map((spec) => ({
  k: requestKey(spec.name, spec.body),
  n: spec.name,
  b: spec.body,
}));

/**
 * 生成 <body> 首节点的内联引导脚本，承担两件事：
 *
 * 1. 首屏分支提示（原 authHintScript）—— 给 <html> 打 data-auth，决定先画登录墙还是
 *    应用外壳。这段语义一字未改：读不到 / 抛异常都落 "out"。
 * 2. 首屏取数抢跑 —— 见文件头。
 *
 * 两件事分在各自的 try 里：抢跑属于纯优化，任何失败都不允许影响首绘分支。
 */
export function bootScript(supabaseUrl: string, anonKey: string): string {
  return (
    `(function(){var D=document.documentElement,R=null;` +
    // ---- 1. 首屏分支提示（key 格式对齐 supabase-js 默认 storageKey: sb-<ref>-auth-token）
    `try{var f=new URL(${inlineJSON(supabaseUrl)}).hostname.split(".")[0];` +
    `R=localStorage.getItem("sb-"+f+"-auth-token");D.dataset.auth=R?"in":"out"}` +
    `catch(e){D.dataset.auth="out";return}` +
    // ---- 2. 首屏取数抢跑（纯附加：任何失败都只是回落到原请求路径）
    `try{if(!R)return;var s=JSON.parse(R),t=s&&s.access_token,x=s&&s.expires_at;` +
    `if(!t)return;if(x&&x*1000<=Date.now()+${EXPIRY_MARGIN_MS})return;` +
    `var U=${inlineJSON(supabaseUrl)},K=${inlineJSON(anonKey)},S=${inlineJSON(SCRIPT_SPECS)},O={};` +
    `for(var i=0;i<S.length;i++)(function(p){` +
    `var h={apikey:K,Authorization:"Bearer "+t},b;` +
    `if(p.b!=null){h["Content-Type"]="application/json";b=JSON.stringify(p.b)}` +
    `O[p.k]=fetch(U+"/functions/v1/"+p.n,{method:"POST",headers:h,body:b})` +
    `.then(function(r){return r.ok?r.json().then(function(j){return{ok:true,data:j}}):{ok:false}})` +
    `.catch(function(){return{ok:false}})` +
    `})(S[i]);` +
    `window.__bootPrefetch=O}catch(e){}})();`
  );
}
