/**
 * 悬赏详情状态层 —— 对应 iOS `Features/Community/BountyDetailView.swift` 顶部
 * 那组 computed property（displayTags / displayDetail / statusText / …）。
 *
 * 与 iOS 的三处平台差异：
 * - iOS 把整个 `Bounty` 推进详情视图，帖子主体一进页面就是全的；小程序的页面
 *   参数只有字符串，所以列表页在 `wx.navigateTo` 的 success 里用 eventChannel
 *   把同一条 `Bounty` 递过来（`bounty` 事件）。URL 上的 `id` / `demo` 是拿不到
 *   opener（分享、重启、开发者工具直接进）时的兜底：那种情况下帖子主体由
 *   `get_bounty` 补齐，补不到才露出重试，不留白屏。
 * - iOS 的「我的名片」直接读 `MyProfileStore().profile`。小程序的「我的」页在
 *   波次 2 · H，还没有这个 store；这里按同一个存储键读缓存（iOS
 *   `MyProfileStore.storeKey`），读不到再拉一次 `/get-profile` 的
 *   `public_profile`，两者都没有就用匿名兜底 —— H 落地后这页不用改。
 * - iOS 在画像还没填时会把空名空简介拼成「我是：」发出去（默认 profile 的
 *   name/bio 都是空串）。这里改成：补充说明与名片都为空时不发，提示先写一句话
 *   —— 发出去的是给发帖人看的内容，一条「我是：」对双方都没有意义。
 */

import { track } from '../../../core/analytics'
import {
  bountyDisplayAmount,
  demoBountyDetail,
  DEMO_BOUNTIES,
  type Bounty,
  type BountyDetailResponse,
  type RemotePublicProfile,
} from '../../../core/models'
import { getBounty, getProfile, respondBounty } from '../../../core/net/api'
import { dayStringFromRaw } from '../../../core/timestamp'

/** 已发过名片的悬赏 id（iOS `BountyDetailView.sentKey`，键名与形状一致） */
const SENT_KEY = 'kaleido_bounty_sent_v1'

/** 我的公开名片缓存（iOS `MyProfileStore.storeKey`）。写入方是波次 2 · H 的「我的」页 */
const MY_PROFILE_KEY = 'kaleido_my_profile_v2'

/** respond_bounty 的正文上限（iOS `payload.prefix(500)`） */
const MESSAGE_LIMIT = 500

/** 一条亲历者回应：远端与演示数据摊平成同一形状 */
export interface ReplyRow {
  name: string
  initial: string
  /** 远端是发布日期，演示数据是「亲历者身份」那一行 */
  role: string
  text: string
  hue: number
}

/** 回应区四态：有内容 / 确认为空 / 还在加载 / 加载失败 */
export type RepliesState = 'rows' | 'empty' | 'loading' | 'failed'

/** 名片弹层里展示的「我」 */
export interface MyCard {
  name: string
  initial: string
  hue: number
  bio: string
  tags: string[]
}

/** 还没建公开画像时的兜底名片 */
export const ANON_CARD: MyCard = {
  name: '匿名旅人',
  initial: '旅',
  hue: 4,
  bio: '还没有填写公开画像',
  tags: [],
}

export interface BountySnapshot {
  /** 帖子主体还没到位（没有 opener 数据，get_bounty 还在路上） */
  loading: boolean
  /** 帖子主体拿不到了：露出重试，别让人对着空页面等 */
  failed: boolean

  statusText: string
  responseCountText: string

  tags: string[]
  question: string
  detail: string

  publisherName: string
  publisherInitial: string
  publisherMeta: string
  publisherHue: number

  prizeText: string
  /** 演示数据展示纯金额，字号比远端的整段悬赏文案大一档（iOS 24 / 17） */
  prizeBig: boolean

  replies: ReplyRow[]
  repliesState: RepliesState

  sent: boolean
}

/** 匿名展示：user_id 截短成「旅人 #XXXX」（iOS anonymousName） */
function anonymousName(userId: string): string {
  return `旅人 #${userId.slice(0, 4).toUpperCase()}`
}

function readSentIds(): number[] {
  const raw = wx.getStorageSync(SENT_KEY) as unknown
  return Array.isArray(raw) ? raw.filter((v): v is number => typeof v === 'number') : []
}

function addSentId(id: number): void {
  const ids = readSentIds()
  if (ids.includes(id)) return
  ids.push(id)
  wx.setStorageSync(SENT_KEY, ids)
}

/** 名字取首字做头像字（iOS `String(name.prefix(1))`） */
function toCard(name: string, hue: number, bio: string, tags: string[]): MyCard | null {
  const trimmed = name.trim()
  if (!trimmed) return null
  return {
    name: trimmed,
    initial: trimmed.slice(0, 1),
    // hue 越界或缺省都落回 4（iOS 默认档）
    hue: Number.isInteger(hue) && hue >= 0 && hue <= 4 ? hue : 4,
    bio: bio.trim(),
    tags,
  }
}

/** 波次 2 · H 写的本地画像缓存；字段缺一律当没有 */
function readCachedCard(): MyCard | null {
  const raw = wx.getStorageSync(MY_PROFILE_KEY) as
    | { name?: string; hue?: number; bio?: string; tags?: string[] }
    | undefined
  if (!raw || typeof raw !== 'object') return null
  return toCard(raw.name ?? '', raw.hue ?? 4, raw.bio ?? '', raw.tags ?? [])
}

function fromPublicProfile(profile: RemotePublicProfile | null | undefined): MyCard | null {
  if (!profile) return null
  return toCard(profile.name ?? '', profile.hue ?? 4, profile.bio ?? '', profile.tags ?? [])
}

export class BountyModel {
  /** 列表页递过来的那一条；拿不到 opener 时为 null，等 get_bounty 补 */
  private bounty: Bounty | null = null
  private remote: BountyDetailResponse | null = null
  private didFinishRemoteLoad = false
  private sent = false

  /** 我的公开名片：null = 还没建画像（拼不出「我是…」那句） */
  private myCard: MyCard | null = null
  private cardLoaded = false

  constructor(
    private readonly id: number,
    /** 列表来自本地演示数据：详情也用配套演示内容，不按同一个 id 混入另一套远端内容 */
    private readonly demo: boolean,
    private readonly onChange: (snapshot: BountySnapshot) => void,
  ) {
    if (demo) this.bounty = DEMO_BOUNTIES.find((b) => b.id === id) ?? null
  }

  /** 列表页通过 eventChannel 递来的帖子主体（等价 iOS 的 `let bounty: Bounty`） */
  setBounty(bounty: Bounty): void {
    if (bounty.id !== this.id) return
    this.bounty = bounty
    this.emit()
  }

  async load(): Promise<void> {
    this.sent = readSentIds().includes(this.id)
    this.emit()
    await this.refreshRemote()
  }

  /** 重试：先翻回「加载中」再打一次，否则按钮点下去没有任何反馈 */
  async retry(): Promise<void> {
    this.didFinishRemoteLoad = false
    this.emit()
    await this.refreshRemote()
  }

  /** 远端列表补拉回应；演示列表保持使用同一套演示详情（iOS loadRemote 同款判断） */
  private async refreshRemote(): Promise<void> {
    if (this.demo) return
    const res = await getBounty(this.id).catch(() => null)
    this.didFinishRemoteLoad = true
    if (res) this.remote = res
    this.emit()
  }

  /** 名片弹层要展示的「我」：本地缓存 → /get-profile 的 public_profile → 匿名 */
  async loadCard(): Promise<MyCard> {
    if (this.cardLoaded) return this.myCard ?? ANON_CARD
    const cached = readCachedCard()
    if (cached) {
      this.myCard = cached
    } else {
      const remote = await getProfile().catch(() => null)
      this.myCard = fromPublicProfile(remote?.public_profile)
    }
    this.cardLoaded = true
    return this.myCard ?? ANON_CARD
  }

  /**
   * 要发出去的正文：补充说明优先，为空则用名片拼一句（iOS `我是{name}：{bio}`）。
   * 两者都为空返回 null —— 见文件头第三条差异。
   */
  payloadFor(message: string): string | null {
    const trimmed = message.trim()
    if (trimmed) return trimmed.slice(0, MESSAGE_LIMIT)
    const card = this.myCard
    if (!card || !card.bio) return null
    return `我是${card.name}：${card.bio}`.slice(0, MESSAGE_LIMIT)
  }

  /** 同一用户同一悬赏是 upsert，重复发送即更新（后端 respond_bounty 语义） */
  async send(payload: string): Promise<{ ok: boolean; message: string }> {
    try {
      await respondBounty(this.id, payload)
    } catch {
      return { ok: false, message: '发送失败，请稍后重试' }
    }
    // 名片真的发出去了才算回应；只带 bounty_id，名片正文不上报
    track('community_bounty_responded', { bounty_id: this.id })
    this.sent = true
    addSentId(this.id)
    this.emit()
    // 自己那条回应也要出现在列表里
    await this.refreshRemote()
    return { ok: true, message: '名片已发送给发帖人' }
  }

  snapshot(): BountySnapshot {
    const demoDetail = demoBountyDetail(this.id)
    const bounty = this.remote?.bounty ?? this.bounty

    const remoteTags = this.remote?.bounty.tags
    const localTags = this.bounty?.tags
    const tags = remoteTags?.length
      ? remoteTags
      : localTags?.length
        ? localTags
        : this.demo
          ? demoDetail.tags
          : []

    const detail =
      (this.remote?.bounty.detail ?? '') ||
      (this.bounty?.detail ?? '') ||
      (this.demo ? demoDetail.detail : '详情暂未填写。')

    const status = this.remote?.bounty.status ?? this.bounty?.status ?? null
    const statusText = status
      ? status === 'closed'
        ? '已结束'
        : '征集中'
      : this.demo
        ? demoDetail.goal
        : '征集中'

    const responseCountText = this.demo
      ? `${demoDetail.replies.length} 人回应`
      : this.remote
        ? `${this.remote.responses.length} 人回应`
        : this.didFinishRemoteLoad
          ? '回应加载失败'
          : '回应加载中'

    const publisherName = this.demo ? demoDetail.asker : '匿名旅人'
    const day = dayStringFromRaw(this.remote?.bounty.created_at ?? this.bounty?.created_at)
    const publisherMeta = this.demo
      ? `${demoDetail.city} · ${demoDetail.time}发布`
      : day
        ? `${day} 发布`
        : '已发布'

    // 远端展示整段悬赏文案（可能是「悬赏 3 个真实故事」这类非金额目标），
    // 文案为空才退回从 reward 里抽出来的金额
    const reward = (bounty?.reward ?? '').trim()
    const prizeText = this.demo
      ? `¥${demoDetail.amount}`
      : reward || (bounty ? bountyDisplayAmount(bounty) : '')

    let replies: ReplyRow[] = []
    let repliesState: RepliesState = 'loading'
    if (this.remote) {
      replies = this.remote.responses.map((reply, i) => ({
        name: anonymousName(reply.user_id),
        initial: '旅',
        role: dayStringFromRaw(reply.created_at) ?? '亲历者',
        text: reply.message,
        hue: (this.id + i + 2) % 5,
      }))
      repliesState = replies.length ? 'rows' : 'empty'
    } else if (this.demo) {
      replies = demoDetail.replies.map((reply, i) => ({
        name: reply.name,
        initial: reply.name.slice(0, 1),
        role: reply.role,
        text: reply.text,
        hue: (this.id + i + 2) % 5,
      }))
      repliesState = replies.length ? 'rows' : 'empty'
    } else {
      repliesState = this.didFinishRemoteLoad ? 'failed' : 'loading'
    }

    return {
      loading: !bounty && !this.demo && !this.didFinishRemoteLoad,
      failed: !bounty && (this.demo || this.didFinishRemoteLoad),
      statusText,
      responseCountText,
      tags,
      question: bounty?.question ?? '',
      detail,
      publisherName,
      publisherInitial: publisherName.slice(0, 1),
      publisherMeta,
      publisherHue: this.id % 5,
      prizeText,
      prizeBig: this.demo,
      replies,
      repliesState,
      sent: this.sent,
    }
  }

  emit(): void {
    this.onChange(this.snapshot())
  }
}
