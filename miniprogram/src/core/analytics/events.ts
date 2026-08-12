/**
 * 事件目录 —— `docs/engineering/埋点方案.md` 的小程序侧镜像。
 *
 * 该文档是唯一事实来源，四侧镜像（Swift `AnalyticsEvent+Catalog.swift`、
 * TS `_shared/events.ts`、本文件）事件名与属性必须一致。改动先改文档。
 *
 * 这里只列**客户端可写**的事件。服务端事实（chat_turn_completed 的服务端口径、
 * crossroad_formed、match_requested、simulation_requested 等）由 Edge Function 自己写
 * `source='server'`，客户端伪造不了 —— `can_insert_app_event()` 把 source 锁死在
 * ('ios','miniprogram')。
 */

export const CLIENT_EVENTS = [
  // 3.1 核心付费漏斗
  'app_opened',
  'chat_started',
  'chat_turn_completed',
  'paywall_viewed',
  'paywall_dismissed',
  'purchase_started',
  'purchase_completed',
  'purchase_failed',
  'experiences_unlocked',
  'experience_expanded',
  'action_selected',
  'action_feedback_submitted',
  // 3.2 认证漏斗（小程序走 auth_wechat_started，没有 Apple / 短信）
  'auth_prompted',
  'auth_sms_requested',
  'auth_sms_verified',
  'auth_apple_started',
  'auth_wechat_started',
  'auth_completed',
  'auth_abandoned',
  // 3.3 免费层功能
  'lab_result_viewed',
  'diary_summary_viewed',
  'assessment_started',
  'assessment_completed',
  'card_game_started',
  'card_game_completed',
  'kaleidoscope_drawn',
  'community_bounty_posted',
  'community_bounty_responded',
] as const

export type ClientEvent = (typeof CLIENT_EVENTS)[number]

/**
 * 属性值类型。文档 §1 只允许 string / int / double / bool。
 *
 * **禁止写入个人身份信息**：手机号、姓名、日记正文、对话正文一律不进埋点。
 * 需要长度/特征时上报派生值（`content_chars: 128` 而不是正文）。
 */
export type EventProps = Record<string, string | number | boolean>
