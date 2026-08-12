/**
 * 埋点 —— 对应 iOS `Core/Analytics/`，但只保留 Layer 1（Supabase `app_events`）。
 *
 * 为什么小程序端没有 PostHog / Sentry：小程序的「request 合法域名」白名单只接受
 * 已 ICP 备案的域名，posthog.com / sentry.io 不在我们名下，备不了案。
 * 详见 `docs/engineering/埋点方案.md` §0.1。
 *
 * **这带来一个 iOS 没有的约束**：在 iOS 上 `app_events` 是兜底事实表，漏报还有
 * PostHog 兜着；在小程序上它是**唯一**事实来源，漏报即永久丢数。所以这里的队列
 * 必须落本地存储、冷启动重放，而不能像 iOS 那样只用内存缓冲。
 *
 * 写入走 PostgREST `POST /rest/v1/app_events`：
 * - 表只 grant insert 不 grant select，所以**绝不能**要求回传行（`Prefer: return=representation`
 *   会直接 403，整条上报链路静默失效）
 * - RLS 由 `can_insert_app_event(user_id, source, event)` 把关：source 锁死、事件名白名单、
 *   user_id 必须是当前 JWT（或其 alias）
 */

import { SUPABASE_ANON_KEY, restURL } from '../config'
import { accessToken, currentSession } from '../net/auth'
import { newRequestId } from '../net/request'
import type { ClientEvent, EventProps } from './events'

export * from './events'

const QUEUE_KEY = 'possibility_analytics_queue_v1'
/** 队列上限：超过就丢最旧的。存储有配额，不能无限堆。 */
const MAX_QUEUE = 500
/** 单次上报批量 */
const BATCH_SIZE = 20
/** 单条最多重试次数，超过即丢弃 */
const MAX_ATTEMPTS = 5
/** 定时 flush 间隔 */
const FLUSH_INTERVAL_MS = 10_000

interface QueuedEvent {
  event_id: string
  event: string
  props: EventProps
  source: 'miniprogram'
  session_id: string
  app_version: string
  created_at: string
  /** 仅本地使用，上报前剔除 */
  _attempts?: number
  /** 仅本地使用：入队时还没 identify 的话为空，flush 时补当前 user_id */
  user_id?: string | null
}

/** 本次冷启动的会话标识（对应 app_events.session_id） */
const SESSION_ID = newRequestId()

function appVersion(): string {
  try {
    const info = wx.getAccountInfoSync()
    return info.miniProgram.version || info.miniProgram.envVersion || 'dev'
  } catch {
    return 'unknown'
  }
}

const APP_VERSION = appVersion()

let queue: QueuedEvent[] = []
let userId: string | null = null
let timer: number | null = null
let flushing = false
let loaded = false

function loadQueue(): void {
  if (loaded) return
  loaded = true
  try {
    const stored = wx.getStorageSync(QUEUE_KEY) as QueuedEvent[] | ''
    if (Array.isArray(stored)) queue = stored
  } catch {
    queue = []
  }
}

function persistQueue(): void {
  try {
    wx.setStorageSync(QUEUE_KEY, queue)
  } catch {
    // 存储写失败（配额满等）不阻断本次会话，内存队列仍然有效
  }
}

function ensureTimer(): void {
  if (timer !== null) return
  timer = setInterval(() => {
    void flush()
  }, FLUSH_INTERVAL_MS) as unknown as number
}

/**
 * 记录一个事件。
 *
 * 入队即返回，不阻塞调用方。未登录时也照常入队 —— `user_id` 留空，等 identify
 * 之后 flush 时统一补上（RLS 要求 user_id 必须是当前 JWT，没登录发出去必然被拒）。
 */
export function track(event: ClientEvent, props: EventProps = {}): void {
  loadQueue()

  queue.push({
    event_id: newRequestId(),
    event,
    props,
    source: 'miniprogram',
    session_id: SESSION_ID,
    app_version: APP_VERSION,
    created_at: new Date().toISOString(),
    user_id: userId,
    _attempts: 0,
  })

  if (queue.length > MAX_QUEUE) {
    const overflow = queue.length - MAX_QUEUE
    queue.splice(0, overflow)
    console.warn(`[analytics] 队列已满，丢弃最旧 ${overflow} 条`)
  }

  persistQueue()
  ensureTimer()
  if (queue.length >= BATCH_SIZE) void flush()
}

/** 会话确立后调用（冷启动恢复会话 / 登录成功）。会把队列里没有 user_id 的事件补齐。 */
export function identify(id: string): void {
  loadQueue()
  userId = id
  let patched = 0
  for (const item of queue) {
    if (!item.user_id) {
      item.user_id = id
      patched++
    }
  }
  if (patched > 0) persistQueue()
  void flush()
}

/** 登出。清身份但**保留队列** —— 已入队的事件属于上一个账号，仍应送达。 */
export function reset(): void {
  userId = null
}

/** 把队列里的事件送出去。并发调用会合流。 */
export async function flush(): Promise<void> {
  loadQueue()
  if (flushing) return
  if (queue.length === 0) return

  // 没有会话就按兵不动：RLS 是 user_id = auth.uid()，现在发出去只会被拒然后白白耗掉重试次数
  if (!currentSession()) return
  if (!userId) return

  flushing = true
  try {
    const batch = queue.slice(0, BATCH_SIZE)
    const rows = batch.map((item) => ({
      event_id: item.event_id,
      user_id: item.user_id ?? userId,
      event: item.event,
      props: item.props,
      source: item.source,
      session_id: item.session_id,
      app_version: item.app_version,
      created_at: item.created_at,
    }))

    await postEvents(rows)
    queue = queue.slice(batch.length)
    persistQueue()
  } catch (err) {
    // 整批失败：累加重试次数，超限的丢弃。绝不静默吞掉——控制台要留下痕迹。
    const batch = queue.slice(0, BATCH_SIZE)
    let discarded = 0
    for (const item of batch) {
      item._attempts = (item._attempts ?? 0) + 1
      if (item._attempts >= MAX_ATTEMPTS) discarded++
    }
    queue = queue.filter((item) => (item._attempts ?? 0) < MAX_ATTEMPTS)
    persistQueue()
    const reason = err instanceof Error ? err.message : String(err)
    console.warn(`[analytics] 上报失败（丢弃 ${discarded} 条）：${reason}`)
  } finally {
    flushing = false
  }
}

function postEvents(rows: Record<string, unknown>[]): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    accessToken()
      .then((token) => {
        wx.request({
          url: restURL('app_events'),
          method: 'POST',
          header: {
            'Content-Type': 'application/json',
            apikey: SUPABASE_ANON_KEY,
            Authorization: `Bearer ${token}`,
            // 必须 minimal：表只 grant insert 不 grant select，
            // 要求回传行会 403，整条链路静默失效（0017 迁移里记了这一点）
            Prefer: 'return=minimal',
          },
          data: rows,
          timeout: 20_000,
          success(res) {
            if (res.statusCode >= 200 && res.statusCode < 300) resolve()
            else reject(new Error(`HTTP ${res.statusCode}`))
          },
          fail(err) {
            reject(new Error(err.errMsg || '网络异常'))
          },
        })
      })
      .catch(reject)
  })
}

/**
 * 挂上小程序生命周期。在 `app.ts` 的 `onLaunch` 里调一次。
 *
 * 切后台时立刻 flush：小程序被杀掉不会有任何通知，靠定时器会丢掉最后一批。
 */
export function bindAppLifecycle(): void {
  loadQueue()
  wx.onAppHide(() => {
    void flush()
  })
  wx.onAppShow(() => {
    void flush()
  })
}
