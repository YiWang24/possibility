/**
 * 探索对话流式客户端（SSE）—— 对齐 iOS `ChatStreamClient.swift` 与 Web `web/lib/chat-stream.ts`
 * 的同一套事件契约：token `{t}` / done / error。
 *
 * 小程序没有 `EventSource`，也没有 `fetch` 的 ReadableStream，只能用
 * `wx.request({ enableChunked: true })` + `requestTask.onChunkReceived`。两个坑：
 *
 * 1. 回调给的是 ArrayBuffer，而小程序运行时**没有 TextDecoder** —— 见 `utf8.ts`，
 *    必须用带状态的增量解码器，否则汉字被切在 chunk 边界就是一串乱码。
 * 2. 行解析不能依赖空行分隔。iOS 在 `ChatStreamClient.swift:100-103` 记过同一个坑：
 *    连续换行会被合并/不稳定吐出，靠空行触发派发会把所有 token 攒住一条都发不出。
 *    本后端每个事件是单行 JSON，所以见到一个 `data:` 行即视为一次完整事件。
 */

import { SUPABASE_ANON_KEY, functionURL } from '../config'
import { accessToken } from './auth'
import { newRequestId } from './request'
import { StreamingUtf8Decoder } from './utf8'

/* ── 契约类型：与 web/lib/chat-stream.ts 逐字段对齐 ── */

export type ChatConclusion = {
  ready: boolean
  next_step: 'match' | 'lab'
  reason: string
}

export type Crossroads = {
  ready: boolean
  summary?: string
  match_query?: Record<string, unknown>
}

export type AIContextDisclosure = {
  dimensions?: string[]
  [key: string]: unknown
}

export type ChatStreamDone = {
  conversation_id?: string
  crossroads?: Crossroads
  profile_signals?: Record<string, string>
  conclusion?: ChatConclusion
  is_enough?: boolean
  next_actions?: { type: string; label: string }[]
  high_risk?: boolean
  ai_context?: AIContextDisclosure
}

export type ChatTurn = { role: string; content: string }

export type ChatRequest = {
  conversation_id?: string
  topic: string
  message: string
  history: ChatTurn[]
}

export class ChatStreamError extends Error {
  code: string
  requestId?: string

  constructor(code: string, message: string, requestId?: string) {
    super(message)
    this.name = 'ChatStreamError'
    this.code = code
    this.requestId = requestId
  }
}

export interface ChatStreamHandlers {
  onToken: (t: string) => void
  onDone: (done: ChatStreamDone) => void
  onError: (err: ChatStreamError) => void
}

/** 取消句柄：页面卸载 / 用户中断时调用 */
export type CancelStream = () => void

/* ── SSE 行解析器 ── */

class SseParser {
  private buffer = ''
  private event = 'message'

  constructor(
    private readonly handlers: ChatStreamHandlers,
    private readonly requestId: string,
  ) {}

  /** 喂一段文本，逐行派发。返回 false 表示流内已出错、调用方应停止。 */
  feed(text: string): boolean {
    this.buffer += text
    const lines = this.buffer.split('\n')
    // 最后一段可能是半行，留到下次
    this.buffer = lines.pop() ?? ''

    for (const raw of lines) {
      const line = raw.replace(/\r$/, '')
      if (line.indexOf('event:') === 0) {
        this.event = line.slice(6).trim()
      } else if (line.indexOf('data:') === 0) {
        const ok = this.dispatch(line.slice(5).trim())
        this.event = 'message'
        if (!ok) return false
      }
      // 空行与以 `:` 开头的注释行忽略
    }
    return true
  }

  /** 流结束：把残留的半行也走一遍（正常收尾时为空） */
  finish(): void {
    if (this.buffer) {
      const line = this.buffer.replace(/\r$/, '')
      this.buffer = ''
      if (line.indexOf('data:') === 0) this.dispatch(line.slice(5).trim())
    }
  }

  private dispatch(data: string): boolean {
    if (!data) return true

    if (this.event === 'done') {
      let done: ChatStreamDone = {}
      try {
        done = JSON.parse(data) as ChatStreamDone
      } catch {
        /* 与 iOS/Web 一致：done 解码失败按空载荷收尾 */
      }
      this.handlers.onDone(done)
      return true
    }

    if (this.event === 'error') {
      // 服务端流内失败（LLM 中断等）。抛给调用方走统一错误路径，
      // 而不是静默吞掉让调用方误判为正常截断。
      let code = 'STREAM_ERROR'
      let message = '回复中断，请稍后重试。'
      let rid: string | undefined
      try {
        const err = JSON.parse(data) as {
          error?: { code?: string; message?: string }
          request_id?: string
        }
        code = err.error?.code ?? code
        message = err.error?.message ?? message
        rid = err.request_id
      } catch {
        /* 保留默认文案 */
      }
      this.handlers.onError(new ChatStreamError(code, message, rid ?? this.requestId))
      return false
    }

    try {
      const chunk = JSON.parse(data) as { t?: string }
      if (chunk.t) this.handlers.onToken(chunk.t)
    } catch {
      /* 非 JSON 行忽略 */
    }
    return true
  }
}

/**
 * 发起一次流式对话。返回取消句柄。
 *
 * 兜底：基础库低于 2.20.2 或 `onChunkReceived` 不可用时，chunk 回调不会触发，
 * 整段响应会在 `success` 里一次性到达 —— 那时把整段 SSE 文本喂给同一个解析器即可。
 * 打字机效果没了，但对话本身不会挂。
 */
export function streamChat(
  request: ChatRequest,
  handlers: ChatStreamHandlers,
): CancelStream {
  const requestId = newRequestId()
  const decoder = new StreamingUtf8Decoder()
  const parser = new SseParser(handlers, requestId)

  let task: WechatMiniprogram.RequestTask | null = null
  let cancelled = false
  let sawChunk = false
  let failed = false

  const fail = (code: string, message: string) => {
    if (failed || cancelled) return
    failed = true
    handlers.onError(new ChatStreamError(code, message, requestId))
  }

  accessToken()
    .then((token) => {
      if (cancelled) return

      task = wx.request({
        url: functionURL('chat'),
        method: 'POST',
        header: {
          'Content-Type': 'application/json',
          Accept: 'text/event-stream',
          apikey: SUPABASE_ANON_KEY,
          Authorization: `Bearer ${token}`,
          'X-Request-ID': requestId,
        },
        data: request,
        enableChunked: true,
        timeout: 120_000,
        success(res) {
          if (cancelled || failed) return

          if (res.statusCode < 200 || res.statusCode >= 300) {
            fail(`HTTP_${res.statusCode}`, `请求失败（${res.statusCode}）`)
            return
          }

          // 走到这里而一个 chunk 都没收到 = 降级路径：整段响应在 res.data 里
          if (!sawChunk && typeof res.data === 'string') {
            parser.feed(res.data)
          }
          parser.feed(decoder.flush())
          parser.finish()
        },
        fail(err) {
          if (cancelled) return
          fail('NETWORK_ERROR', err.errMsg || '网络异常')
        },
      })

      // 部分基础库版本下 onChunkReceived 不存在，用可选调用兜底
      task.onChunkReceived?.((res) => {
        if (cancelled || failed) return
        sawChunk = true
        const text = decoder.push(res.data as ArrayBuffer)
        if (text && !parser.feed(text)) {
          // 流内错误已上报，主动断开省掉后续无用字节
          cancelled = true
          task?.abort()
        }
      })
    })
    .catch((err: Error) => {
      if (!cancelled) fail('AUTH_ERROR', err.message || '未登录')
    })

  return () => {
    cancelled = true
    task?.abort()
  }
}
