/**
 * 模型层出口。
 *
 * 分工：
 * - `content.ts`  内容侧（公开只读）：旅人 / 详情 / 服务 / 悬赏
 * - `user.ts`     用户侧（RLS 锁 auth.uid()）+ LLM 出参契约
 * - `dimensions.ts` / `emotions.ts` / `demo-data.ts`  逐字镜像自 `web/lib/`，同步时 diff
 *
 * 契约的上游是 `supabase/functions/_shared/schemas.ts`（10 套 JSON Schema）与各表结构，
 * 四端共用同一份 wire 形状（snake_case），不做 camelCase 转换层。
 */

export * from './content'
export * from './user'
export * from './dimensions'
export * from './emotions'
export * from './demo-data'
