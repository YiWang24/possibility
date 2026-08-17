/**
 * Supabase `created_at` 统一解析 / 展示 —— 对应 iOS
 * `Core/Utilities/SupabaseTimestamp.swift`。
 *
 * 服务端时间串形如 `2026-07-25T03:21:11.123456+00:00`（偶见空格分隔或无时区变体）。
 * iOS 那边记过：四个 Feature 各写一套解析、且裸切 `prefix(10)` 会把 UTC 日期在东八区
 * 晚间显示成前一天 —— 所以统一收敛到这里，解析成 Date 后一律按本地时区格式化。
 *
 * JS 侧还多两个坑，都在 `parse()` 里解掉：
 *
 * 1. **无时区后缀的串会被当成本地时间。** ES2015 起 `new Date('2026-07-25T03:21:11')`
 *    按本地时区解释，而服务端存的是 UTC —— 东八区会平白早 8 小时。补一个 `Z`。
 * 2. **6 位小数秒不是所有引擎都吃。** iOS 微信与安卓微信的 JSCore 版本不同，
 *    截到 3 位最稳。
 *
 * 展示一律手工拼，不用 `toLocaleString`：小程序两端的 ICU 数据不一致，
 * `zh-CN` 的输出格式在安卓上会跟 iOS 不一样。
 */

/** `created_at` 字符串 → Date；不认识的格式返回 null */
export function parseTimestamp(raw: string | null | undefined): Date | null {
  if (!raw) return null

  let s = raw.replace(' ', 'T')
  // 小数秒截到 3 位（`.123456` → `.123`）
  s = s.replace(/\.(\d{3})\d+/, '.$1')
  // 没有时区后缀（Z / ±HH:MM）就按 UTC 解释，与服务端存储一致
  if (!/(?:Z|[+-]\d{2}:?\d{2})$/.test(s)) s += 'Z'

  const t = Date.parse(s)
  return Number.isNaN(t) ? null : new Date(t)
}

function pad(n: number): string {
  return n < 10 ? `0${n}` : `${n}`
}

/** `yyyy-MM-dd`（本地时区；周历 key / 日记日期 / 悬赏日期通用） */
export function dayString(date: Date): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

/** `created_at` → 本地时区 `yyyy-MM-dd`；解析失败返回 null */
export function dayStringFromRaw(raw: string | null | undefined): string | null {
  const d = parseTimestamp(raw)
  return d ? dayString(d) : null
}

/** `created_at` → `M月d日 HH:mm`（历史会话列表）；解析失败返回 null，调用方不显示 */
export function timeLabel(raw: string | null | undefined): string | null {
  const d = parseTimestamp(raw)
  if (!d) return null
  return `${d.getMonth() + 1}月${d.getDate()}日 ${pad(d.getHours())}:${pad(d.getMinutes())}`
}

const WEEKDAYS = ['周日', '周一', '周二', '周三', '周四', '周五', '周六']

/** `M月d日 · 周x`（日记详情 label） */
export function diaryLabel(date: Date): string {
  return `${date.getMonth() + 1}月${date.getDate()}日 · ${WEEKDAYS[date.getDay()]}`
}
