/**
 * 对话 → 总结页的数据交接。
 *
 * iOS 的总结是盖在对话上的 `.sheet`，直接读同一个 `ChatModel` 实例。小程序里
 * `subpkg/chat/summary` 是一个独立页面（app.json 已声明），拿不到对话页的模型实例，
 * 所以在这里放一份快照。
 *
 * 为什么不走 URL query：总结页要用的 `answers`、`shareText`、旅人卡是长文本和对象数组，
 * 塞进 `wx.navigateTo` 的 url 既有长度上限，又要来回 encode/parse，很容易在中文和换行
 * 上出问题。
 *
 * 为什么不用 `EventChannel`：它只在 navigateTo 打开的那一瞬间投递一次，总结页从旅人主页
 * 返回后 `onShow` 重新渲染时数据已经没了。这里存着不清，由对话页 `onUnload` 负责清理。
 */

import type { Traveler } from '../../core/models'

export interface ChatSummaryPayload {
  displayTopic: string | null
  displayQuestion: string
  answers: string[]
  shareText: string
  recommendedNextStep: 'match' | 'lab' | null
  matchedTravelers: Traveler[]
  matchReasons: Record<number, string>
}

let staged: ChatSummaryPayload | undefined

export function stageSummary(payload: ChatSummaryPayload): void {
  staged = payload
}

export function readSummary(): ChatSummaryPayload | undefined {
  return staged
}

export function clearSummary(): void {
  staged = undefined
}
