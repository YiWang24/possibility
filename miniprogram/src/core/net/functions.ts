/**
 * Edge Function 名称契约 —— `packages/shared-types/src/api.ts` 的小程序镜像。
 *
 * 小程序不在 pnpm workspace 内（同 flash-app 惯例），没法直接 import 那个包，
 * 所以这里是一份手工镜像。**后端增删函数时这两处必须同步改**。
 *
 * `wechat-auth` 是小程序端独有的新增函数（微信一键登录），其余与三端共用。
 */

export const EDGE_FUNCTIONS = [
  'chat',
  'match',
  'simulate',
  'analyze-diary',
  'analyze-self-discovery',
  'create-diary-entry',
  'finalize-diary-entry',
  'diary-audio-url',
  'delete-diary-entry',
  'delete-diary-audio',
  'export-diary',
  'retry-diary-entry',
  'update-diary-transcript',
  'save-profile',
  'card-game-catalog',
  'card-game-session',
  'card-game-result',
  'get-profile',
  'profile-privacy',
  'list-conversations',
  'list-diary',
  'diary-summary',
  'community',
  'lab-choices',
  'persona',
  'merge-anonymous',
  'delete-account',
  // ── 小程序端新增 ──
  'wechat-auth',
] as const

export type EdgeFunctionName = (typeof EDGE_FUNCTIONS)[number]
