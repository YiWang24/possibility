/**
 * 旅人主页状态 —— 对应 iOS `Features/Profile/ProfileModel.swift`。
 *
 * 与 iOS 的两点结构差异：
 * - iOS 的 `unlocked` 与 `LockedBlock` 在基准里是**死代码**：`unlocked` 只被写从不被读，
 *   `LockedBlock` 定义了却从未实例化，付费字段（full_text / advice）实际一直是展开的。
 *   这里如实照搬「都可见」的实际行为，不搬那两个没有出口的状态 —— 搬过来同样没人读，
 *   只会让后来人以为小程序漏做了遮挡。付费墙的 unlock 分支是活代码（写 `unlocks` +
 *   `experiences_unlocked` 埋点），照搬。
 * - iOS 的 `checkout` 是 sheet 的 item 绑定；小程序把结账做成分包页面（见 paywall/），
 *   所以这里没有 checkout 状态，由页面 `wx.navigateTo` 带参过去。
 *
 * WXML 里不能调函数，所有派生文案（价格串、服务品类名、按钮文案、事实卡数字）
 * 都在这里算好，页面只负责 setData 和跳转。
 */

import { track } from '../../../core/analytics'
import { loadTravelerDetail, loadTravelerServices, loadTravelers } from '../../../core/net/api'
import {
  ADVICE_KINDS,
  adviceTips,
  DEMO_TRAVELER_DETAILS,
  DEMO_TRAVELERS,
  demoServices,
  type AdviceKind,
  type Traveler,
  type TravelerDetail,
  type TravelerServiceItem,
} from '../../../core/models'

/** 四个页签（iOS `ProfileModel.Tab`） */
export type ProfileTab = 'story' | 'timeline' | 'advice' | 'service'

export const PROFILE_TABS: { key: ProfileTab; label: string }[] = [
  { key: 'story', label: '她的故事' },
  { key: 'timeline', label: '时间线' },
  { key: 'advice', label: '经验与建议' },
  { key: 'service', label: '可提供服务' },
]

/** 建议标题（iOS `ProfileModel.adviceTitles`，源自原型 ADVICE_TITLES 首选） */
const ADVICE_TITLES: Record<AdviceKind, string> = {
  decision: '转型前，先做一次低成本验证',
  ability: '把旧能力翻译成新岗位的优势',
  interview: '让面试官看见真实的行动证据',
}

/** 服务流程三步（iOS `ServicePanel.steps`） */
export const SERVICE_STEPS: { title: string; note: string }[] = [
  { title: '确认目标与边界', note: '先说明你的处境，双方确认服务适合再开始' },
  { title: '正式沟通 / 交付', note: '按约定形式进行咨询、交付资料或开始陪跑' },
  { title: '追问与复盘', note: '结束后保留一次追问，沉淀可执行的下一步' },
]

/** 咨询兜底价 —— 服务列表还没到时 PayBar 也得有价可显示（iOS `AppConfig.Price.consult`） */
const PRICE_CONSULT_FALLBACK = 29

/** 时间线的一个节点（展开态由页面控制，不进快照） */
export interface TimelineNode {
  age: string
  title: string
  detail: string
  isLast: boolean
}

/** 事实卡：三个数字 + 说明 */
export interface StoryFact {
  value: string
  label: string
}

/** 服务卡（派生出品类名 / 按钮文案 / 配色档，WXML 直接用） */
export interface ServiceCard {
  id: string
  kind: string
  /** 眉标：1 对 1 咨询 / 资料工具包 / 阶段陪跑 */
  kindLabel: string
  title: string
  priceText: string
  unit: string
  description: string
  tags: string[]
  ctaLabel: string
}

export interface ProfileSnapshot {
  loading: boolean
  /** 顶栏与 hero */
  name: string
  initial: string
  hue: number
  tags: string[]
  /** 「32 岁 · 上海」；两项都缺时为空串，不渲染 */
  ageCity: string
  fromRole: string
  toRole: string
  /** 「3 年 · 已入职」 */
  yearsResult: string
  /** 她的故事 */
  quote: string
  intro: string
  facts: StoryFact[]
  fullText: string
  /** 时间线 */
  nodes: TimelineNode[]
  /** 经验与建议 */
  adviceTitle: string
  tips: string[]
  /** 可提供服务 */
  services: ServiceCard[]
  /** 底部付费栏 */
  consultPriceText: string
}

/** 金额展示：整数不带小数点（29 而不是 29.0），小数保留原样（9.9）。
 *  iOS 用 `NSDecimalNumber.stringValue`，JS 的 Number → String 默认就是这个行为。 */
export function priceText(price: number): string {
  return String(price)
}

/** 服务品类 → 眉标（iOS `ServiceCard.kindLabel`） */
function kindLabel(kind: string): string {
  if (kind === 'materials') return '资料工具包'
  if (kind === 'companion') return '阶段陪跑'
  return '1 对 1 咨询'
}

/** 服务品类 → 主按钮文案（iOS `ServiceCard.ctaLabel`） */
function ctaLabel(kind: string): string {
  if (kind === 'materials') return '购买资料包'
  if (kind === 'companion') return '申请陪跑'
  return '向 TA 咨询'
}

function toServiceCard(s: TravelerServiceItem): ServiceCard {
  return {
    id: s.id,
    kind: s.kind,
    kindLabel: kindLabel(s.kind),
    title: s.title,
    priceText: priceText(s.price),
    unit: s.unit,
    description: s.description,
    tags: s.tags ?? [],
    ctaLabel: ctaLabel(s.kind),
  }
}

export class ProfileModel {
  traveler: Traveler | null = null
  detail: TravelerDetail | null = null
  services: TravelerServiceItem[] = []
  adviceKind: AdviceKind = 'decision'
  private loading = true

  constructor(
    readonly travelerId: number,
    private readonly onChange: (snapshot: ProfileSnapshot) => void,
  ) {}

  /**
   * 先用兜底数据立即渲染（页面秒开），网络回来再静默刷新 —— 与 iOS `load()` 同策略。
   * 任一路失败都保持已渲染的内容，不让主页白屏。
   */
  async load(): Promise<void> {
    this.traveler = DEMO_TRAVELERS.find((t) => t.id === this.travelerId) ?? null
    this.detail = DEMO_TRAVELER_DETAILS[this.travelerId] ?? null
    this.services = demoServices(this.travelerId)
    this.loading = false
    this.emit()

    // travelers 表只有内容运营维护的少量行（iOS 那边同样是整表当池子用），
    // 单独为一行加个 API 不值得，直接复用列表接口挑出这一位。
    const [travelers, detail, services] = await Promise.all([
      loadTravelers().catch(() => [] as Traveler[]),
      loadTravelerDetail(this.travelerId).catch(() => null),
      loadTravelerServices(this.travelerId).catch(() => [] as TravelerServiceItem[]),
    ])

    const fresh = travelers.find((t) => t.id === this.travelerId)
    if (fresh) this.traveler = fresh
    if (detail) this.detail = detail
    if (services.length > 0) this.services = services
    this.emit()
  }

  setAdviceKind(kind: AdviceKind): void {
    if (this.adviceKind === kind) return
    this.adviceKind = kind
    this.emit()
  }

  /** 时间线展开某个节点 —— 只在「展开」时上报，收起不算一次查看（对齐 iOS） */
  trackExpand(rank: number): void {
    track('experience_expanded', { traveler_id: this.travelerId, rank })
  }

  /** 咨询服务（PayBar 主按钮的目标）；没有就返回 null，由页面提示「咨询服务加载中」 */
  consultService(): TravelerServiceItem | null {
    return this.services.find((s) => s.kind === 'consult') ?? null
  }

  serviceById(id: string): TravelerServiceItem | null {
    return this.services.find((s) => s.id === id) ?? null
  }

  /** 解锁后可见的经验条数（三类建议合计）—— 只报条数，正文绝不进属性 */
  unlockedExperienceCount(): number {
    const advice = this.detail?.advice
    if (!advice) return 0
    return ADVICE_KINDS.reduce((sum, k) => sum + adviceTips(advice, k.kind).length, 0)
  }

  private get facts(): StoryFact[] {
    const d = this.detail
    const nodeCount = this.traveler?.trajectory?.length ?? 0
    // iOS: `d.years?.filter(\.isNumber)` —— 从「3 年」里抠出数字再补回「年」；
    // years 缺失时退回轨迹节点数（那时两个事实卡会同数，基准就是这样）
    const digits = (d?.years ?? '').replace(/\D/g, '')
    return [
      { value: `${digits || String(nodeCount)} 年`, label: '真实实践' },
      { value: String(nodeCount), label: '关键节点' },
      { value: String(d?.consulted ?? 0), label: '已帮助人数' },
    ]
  }

  private get nodes(): TimelineNode[] {
    const list = this.traveler?.trajectory ?? []
    return list.map((n, i) => ({
      age: n.age,
      title: n.t,
      detail: n.d,
      isLast: i === list.length - 1,
    }))
  }

  snapshot(): ProfileSnapshot {
    const t = this.traveler
    const d = this.detail
    const age = d?.age != null ? `${d.age} 岁 · ` : ''
    const consult = this.consultService()
    return {
      loading: this.loading,
      name: t?.name ?? '旅人主页',
      initial: t?.initial ?? '',
      hue: t?.hue ?? 0,
      tags: t?.tags ?? [],
      ageCity: d ? `${age}${d.city ?? ''}` : '',
      fromRole: d?.from_role ?? '',
      toRole: d?.to_role ?? '',
      yearsResult: d ? `${d.years ?? ''} · ${d.result ?? ''}` : '',
      quote: t?.quote ?? '',
      intro: d?.intro ?? '',
      facts: this.facts,
      fullText: d?.full_text ?? '',
      nodes: this.nodes,
      adviceTitle: ADVICE_TITLES[this.adviceKind],
      tips: d?.advice ? adviceTips(d.advice, this.adviceKind) : [],
      services: this.services.map(toServiceCard),
      consultPriceText: priceText(consult?.price ?? PRICE_CONSULT_FALLBACK),
    }
  }

  emit(): void {
    this.onChange(this.snapshot())
  }
}
