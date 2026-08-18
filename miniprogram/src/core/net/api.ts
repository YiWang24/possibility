/**
 * Edge Function 调用封装 —— 对应 iOS `Core/Network/SupabaseService.swift` 的接口部分。
 *
 * 入参形状全部对齐 `supabase/functions/_shared/validate.ts` 的 validator（不是猜的）；
 * 出参类型对齐 `_shared/schemas.ts`。按 README 的域分组排列。
 *
 * 这里只负责「发请求 + 给类型」，不做缓存也不做兜底 —— 缓存留给各 Feature 的 Model 层，
 * 回退 DemoData 的决定也在那里做（哪些接口失败该降级、降级成什么，是业务判断）。
 *
 * 流式对话不在此列，见 `chat-stream.ts`：它必须直连函数 URL 读流。
 */

import { invokeFunction, restSelect } from './request'
import type {
  Bounty,
  BountyDetailResponse,
  DiaryAnalysis,
  DiarySummaryResponse,
  LabChoiceResponse,
  MatchQuery,
  MatchResponse,
  PersonaJob,
  RemoteChatMessage,
  RemoteConversation,
  RemoteDiaryEntry,
  RemoteProfile,
  SimulationResult,
  Traveler,
  TravelerDetail,
  TravelerServiceItem,
} from '../models'

/* ============ 对话与推演 ============ */

/** POST /match —— 岔路口成形后取 3 位结局不同的旅人 + 可解释理由 */
export function match(userState: MatchQuery): Promise<MatchResponse> {
  return invokeFunction<MatchResponse>('match', { ...userState })
}

/**
 * POST /simulate —— 三种未来推演 + 底线分析。
 *
 * `years` 后端校验 1..10；`time_horizon` 省略时后端按 `${years}年` 填充，
 * 短期档位（7天/30天/3个月/6个月）必须显式传，否则会被推成整年。
 */
export function simulate(input: {
  question: string
  choice: string
  years: number
  time_horizon?: string
  /** 一起带走的底线卡 id，最多 6 张 */
  carry_cards?: string[]
}): Promise<SimulationResult> {
  return invokeFunction<SimulationResult>('simulate', { ...input })
}

/** POST /lab-choices —— 动态生成实验室选择卡 */
export function labChoices(input: {
  question: string
  topic?: string
  constraints?: string[]
  previous_choices?: string[]
}): Promise<LabChoiceResponse> {
  return invokeFunction<LabChoiceResponse>('lab-choices', { ...input })
}

/** POST /list-conversations —— 历史会话（limit 上限 50，超出后端会夹到 50） */
export function listConversations(
  limit = 20,
  offset = 0,
): Promise<{ conversations: RemoteConversation[]; total: number }> {
  return invokeFunction('list-conversations', { limit, offset })
}

/**
 * 读取一段历史会话的全部消息 —— 对应 iOS `SupabaseService.loadMessages`。
 *
 * 没有对应的 Edge Function：iOS 也是 supabase-swift 直读 `messages` 表，归属由 RLS
 * 兜住。按 `id` 升序取，保证恢复出来的对话顺序与当时一致。
 */
export function loadMessages(conversationId: string): Promise<RemoteChatMessage[]> {
  return restSelect<RemoteChatMessage>(
    'messages',
    `conversation_id=eq.${encodeURIComponent(conversationId)}&select=id,role,content&order=id.asc`,
  )
}

/* ============ 画像与主页 ============ */

/** POST /persona action=generate —— 动态数字形象；异步任务，返回后轮询 status */
export function personaGenerate(promptOverride?: string): Promise<PersonaJob> {
  return invokeFunction<PersonaJob>('persona', {
    action: 'generate',
    ...(promptOverride ? { prompt_override: promptOverride } : {}),
  })
}

/** POST /persona action=status —— 轮询数字形象生成结果 */
export function personaStatus(jobId: string): Promise<PersonaJob> {
  return invokeFunction<PersonaJob>('persona', { action: 'status', job_id: jobId })
}

/** POST /get-profile —— 云端画像全量（事实 / 卡牌结果 / 公开主页） */
export function getProfile(): Promise<RemoteProfile> {
  return invokeFunction<RemoteProfile>('get-profile')
}

/**
 * POST /save-profile —— 写入一个维度的关键词。
 *
 * `action` 不能省：save-profile 是三合一入口（save_dimension / save_card_game /
 * save_public_profile），switch 落到 default 会直接 400 INVALID_ACTION。
 *
 * `source: 'assessment'` 时后端还会读 `assessment_kind` / `assessment_answers` /
 * `assessment_scores`（save-profile/index.ts 里从原始 body 取，不经 validator），
 * 三者缺一就存不成一次测评记录 —— 所以做成必选组合而不是三个独立可选字段。
 */
export function saveDimension(input: {
  dimension: string
  tags: string[]
  source: 'manual' | 'assessment'
  assessment?: {
    kind: string
    answers: number[]
    scores: Record<string, number>
  }
}): Promise<{ profile_revision: number }> {
  const { assessment, ...rest } = input
  return invokeFunction('save-profile', {
    action: 'save_dimension',
    ...rest,
    ...(assessment
      ? {
          assessment_kind: assessment.kind,
          assessment_answers: assessment.answers,
          assessment_scores: assessment.scores,
        }
      : {}),
  })
}

/** POST /profile-privacy —— 画像可见性与用途授权 */
export function profilePrivacy(
  body: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  return invokeFunction('profile-privacy', body)
}

/* ============ 语音日记 ============ */

/**
 * POST /create-diary-entry —— 建条目 + 拿上传票据。
 *
 * `mime_type` 必须是后端 `_shared/diary.ts` 支持的：audio/webm · audio/mp4 ·
 * audio/mpeg · audio/wav · audio/x-m4a。小程序 `RecorderManager` 录 mp3 即 audio/mpeg。
 */
export function createDiaryEntry(input: {
  mime_type: string
  duration_ms?: number
}): Promise<{
  entry_uuid: string
  status: string
  upload_url?: string
  audio_path?: string
  mime_type?: string
  token?: string
}> {
  return invokeFunction('create-diary-entry', { ...input })
}

/** POST /finalize-diary-entry —— 音频上传完成后入队转写 */
export function finalizeDiaryEntry(entryUuid: string): Promise<{ status: string }> {
  return invokeFunction('finalize-diary-entry', { entry_uuid: entryUuid })
}

/** POST /list-diary —— 日记列表 */
export function listDiary(limit = 50): Promise<{ entries: RemoteDiaryEntry[] }> {
  return invokeFunction('list-diary', { limit })
}

/**
 * POST /list-diary 带 offset 的分页版 —— 对应 iOS `SupabaseService.listDiaryPage`
 * （HomeModel.swift 末尾的 extension）。
 *
 * 首页的「已探索第 N 天」要拿到最早一条日记，而服务端把 limit 钳到 50：
 * 日记多于 50 条时窗口内的最早一条并不是真正的最早一条，天数会被低估。
 * 所以需要 `total` 和按 `offset = total - 1` 取末位的能力。
 */
export function listDiaryPage(
  limit: number,
  offset: number,
): Promise<{ entries: RemoteDiaryEntry[]; total: number }> {
  return invokeFunction('list-diary', { limit, offset })
}

/**
 * POST /diary-summary —— 月/年洞察。入队即返回，ready 前需轮询。
 * `period` 为 day/month/year；`ref` 对应 `2026-07-30` / `2026-07` / `2026`。
 */
export function diarySummary(
  period: 'day' | 'month' | 'year',
  ref: string,
): Promise<DiarySummaryResponse> {
  return invokeFunction<DiarySummaryResponse>('diary-summary', { period, ref })
}

/** POST /analyze-diary —— 直接文本分析（同步入口，不走队列） */
export function analyzeDiary(
  transcript: string,
  inputMethod: 'voice' | 'text',
): Promise<DiaryAnalysis> {
  return invokeFunction<DiaryAnalysis>('analyze-diary', {
    transcript,
    input_method: inputMethod,
  })
}

/** POST /diary-audio-url —— 取音频的临时播放地址 */
export function diaryAudioUrl(entryUuid: string): Promise<{ url: string }> {
  return invokeFunction('diary-audio-url', { entry_uuid: entryUuid })
}

/** POST /update-diary-transcript —— 用户手工订正转写文本 */
export function updateDiaryTranscript(
  entryUuid: string,
  transcript: string,
): Promise<{ status: string }> {
  return invokeFunction('update-diary-transcript', {
    entry_uuid: entryUuid,
    transcript,
  })
}

/** POST /retry-diary-entry —— 转写/分析失败后重试 */
export function retryDiaryEntry(entryUuid: string): Promise<{ status: string }> {
  return invokeFunction('retry-diary-entry', { entry_uuid: entryUuid })
}

/** POST /delete-diary-entry —— 删条目 */
export function deleteDiaryEntry(entryUuid: string): Promise<{ ok: boolean }> {
  return invokeFunction('delete-diary-entry', { entry_uuid: entryUuid })
}

/** POST /delete-diary-audio —— 只删音频，保留转写与分析 */
export function deleteDiaryAudio(entryUuid: string): Promise<{ ok: boolean }> {
  return invokeFunction('delete-diary-audio', { entry_uuid: entryUuid })
}

/** POST /export-diary —— 导出全部日记 */
export function exportDiary(): Promise<Record<string, unknown>> {
  return invokeFunction('export-diary')
}

/* ============ 社区 ============ */

/** POST /community action=list_travelers */
export function listTravelers(
  limit = 20,
  offset = 0,
): Promise<{ travelers: Traveler[]; total: number }> {
  return invokeFunction('community', { action: 'list_travelers', limit, offset })
}

/** POST /community action=list_bounties */
export function listBounties(
  limit = 20,
  offset = 0,
): Promise<{ bounties: Bounty[]; total: number }> {
  return invokeFunction('community', { action: 'list_bounties', limit, offset })
}

/** POST /community action=get_bounty —— 悬赏详情 + 回应列表 */
export function getBounty(bountyId: number): Promise<BountyDetailResponse> {
  return invokeFunction<BountyDetailResponse>('community', {
    action: 'get_bounty',
    bounty_id: bountyId,
  })
}

/** POST /community action=create_bounty */
export function createBounty(input: {
  question: string
  tags: string[]
  detail: string
  reward: string
}): Promise<{ bounty_id: number }> {
  return invokeFunction('community', { action: 'create_bounty', ...input })
}

/** POST /community action=respond_bounty */
export function respondBounty(
  bountyId: number,
  message: string,
): Promise<{ ok: boolean }> {
  return invokeFunction('community', {
    action: 'respond_bounty',
    bounty_id: bountyId,
    message,
  })
}

/**
 * POST /community action=kaleidoscope_draw —— 万花筒抽人。
 * `recently_viewed_ids` 传最近看过的旅人，避免连抽重复。
 */
export function kaleidoscopeDraw(
  mode: 'similar' | 'different',
  recentlyViewedIds: number[] = [],
): Promise<{ traveler_id: number; reason: string }> {
  return invokeFunction('community', {
    action: 'kaleidoscope_draw',
    mode,
    recently_viewed_ids: recentlyViewedIds,
  })
}

/* ============ 卡牌游戏 ============ */

/** POST /card-game-catalog —— 公开卡牌目录（无需登录，但走同一封装无妨） */
export function cardGameCatalog(
  body: Record<string, unknown> = {},
): Promise<Record<string, unknown>> {
  return invokeFunction('card-game-catalog', body)
}

/** POST /card-game-session —— 开局 / 同步 / 完成，由 `operation` 分派 */
export function cardGameSession(
  body: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  return invokeFunction('card-game-session', body)
}

/** POST /card-game-result —— AI 叙事生成与结果读写 */
export function cardGameResult(
  body: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  return invokeFunction('card-game-result', body)
}

/* ============ 账号 ============ */

/** POST /delete-account —— 注销并清除数据 */
export function deleteAccount(): Promise<{ ok: boolean }> {
  return invokeFunction('delete-account')
}

/* ============ 旅人内容（PostgREST 直读公开只读表） ============ */

/**
 * 旅人详情 —— 直读 `traveler_details`，与 iOS `loadTravelerDetail` 同源。
 *
 * `full_text` / `advice` 是付费字段，但**表级仍然可读**：iOS 的付费墙也是前端遮挡
 * （`unlocks` 表记录解锁状态）。这不是小程序引入的新问题，是既有的产品形态 ——
 * 真要做服务端裁剪得改 RLS 或走函数层，属于四端一起动的改动，不在本波次范围。
 */
export async function loadTravelerDetail(
  travelerId: number,
): Promise<TravelerDetail | null> {
  const rows = await restSelect<TravelerDetail>(
    'traveler_details',
    `traveler_id=eq.${travelerId}&select=*`,
  )
  return rows[0] ?? null
}

/** 增值服务 —— 直读 `traveler_services`，与 iOS `loadServices` 同源 */
export function loadTravelerServices(
  travelerId: number,
): Promise<TravelerServiceItem[]> {
  return restSelect<TravelerServiceItem>(
    'traveler_services',
    `traveler_id=eq.${travelerId}&select=*`,
  )
}

/** 旅人列表 —— 直读 `travelers`（community 的 list_travelers 带分页，按需二选一） */
export function loadTravelers(): Promise<Traveler[]> {
  return restSelect<Traveler>('travelers', 'select=*&order=id.asc')
}
