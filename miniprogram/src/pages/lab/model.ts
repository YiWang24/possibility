/**
 * 人生实验室状态 —— 对应 iOS `Features/Lab/LabModel.swift`。
 *
 * 只管状态，不碰视图：页面通过 `onChange` 拿快照去 setData（同 `HomeModel` / `ChatModel`）。
 *
 * 与 iOS 的两处结构性差异，都是接口造成的，不是取舍：
 * - `simulate` 出参没有 `recommended_travelers`（服务端现成的旅人对象），
 *   所以这里只有「按 id 去素材池里找」这一条路，没有 iOS 的双路径。
 * - `lab_choices_requested` / `simulation_requested` 由 Edge Function 自己写
 *   （见 `core/analytics/events.ts`），端上只报 `lab_result_viewed`。
 */

import { labChoices, loadTravelers, simulate } from '../../core/net/api'
import { track } from '../../core/analytics'
import {
  DEMO_TRAVELERS,
  EXPLORE_TOPICS,
  SIMULATION_HORIZONS,
  matchCardIconByCard,
  resolveCardIcon,
  type CardIconKey,
  type Scenario,
  type SimulationHorizon,
  type Traveler,
} from '../../core/models'

/** 自定义选择卡的本地持久化键 —— 与 iOS UserDefaults 同名，换端不换语义 */
const CUSTOM_CHOICES_KEY = 'kaleido_custom_choices_v1'

/** 名称 / 描述字数上限（与 iOS `addCustomChoice` 一致） */
const NAME_MAX = 18
const DESC_MAX = 42

/** 最多带走几张底线卡 */
const CARRY_MAX = 3

/**
 * lab-choices 超时。网关那边一次生成大约 8~12s，真机更高，
 * 15s 太紧会把正常回包当失败丢掉。
 */
const CHOICES_TIMEOUT_MS = 30_000

/** 推演加载动画每步停留时长 */
const LOAD_STEP_MS = 750

/** 加载文案 —— 三步走完刚好盖住一次推演请求的常见耗时 */
export const LOAD_STEPS = [
  '读取你的动态画像……',
  '匹配 1,842 位相似旅人的经历……',
  '折出三种可能的未来……',
]

/** 一张选择卡 */
export interface LabChoice {
  id: string
  icon: CardIconKey
  name: string
  desc: string
  isCustom: boolean
  /** 模型给的 CSS 颜色，只当色相提示；端上吸附到 --accent-0..4 */
  color?: string
}

/** 一张底线卡：推演时「一起带走」的东西 */
export interface CarryCard {
  id: string
  icon: CardIconKey
  name: string
  /** 这条底线是从哪儿来的（对话线索 / 日记线索 / …） */
  source: string
  /** 最坏情况下它会怎样被击穿 */
  risk: string
}

/** 6 张固定底线卡 —— 文案与 iOS `CarryCard.all` 逐字一致 */
export const CARRY_CARDS: CarryCard[] = [
  {
    id: 'income',
    icon: 'money',
    name: '稳定收入',
    source: '对话线索',
    risk: '转型不顺时，收入可能在一段时间内下降，生活安全感受到直接冲击。',
  },
  {
    id: 'health',
    icon: 'health',
    name: '身体不透支',
    source: '日记线索',
    risk: '反复尝试与加倍学习可能挤压睡眠和恢复时间，身体先替选择支付代价。',
  },
  {
    id: 'relation',
    icon: 'connect',
    name: '重要关系',
    source: '关系画像',
    risk: '压力与时间投入可能让你减少陪伴，也可能加剧家人对这次改变的不理解。',
  },
  {
    id: 'craft',
    icon: 'deepen',
    name: '专业积累',
    source: '职业画像',
    risk: '最差情况下，新岗位没有站稳，原有专业身份也因中断而需要重新证明。',
  },
  {
    id: 'creation',
    icon: 'create',
    name: '创造实感',
    source: '动态画像',
    risk: '你可能进入一个更偏协调和推进的岗位，却发现真正动手创造的时刻反而更少。',
  },
  {
    id: 'exit',
    icon: 'retreat',
    name: '保留退路',
    source: '风险预案',
    risk: '如果投入过深、现金流下降或履历断裂，回到原路径的成本会明显升高。',
  },
]

/** 推演结果 —— 页面渲染要的一切都在这里，不再回头查 model */
export interface SimResultData {
  question: string
  choice: string
  horizon: SimulationHorizon
  scenarios: { optimistic: Scenario; general: Scenario; cautionary: Scenario }
  /** 服务端没给 bottom_line_analysis 时为 null，底线分析面板整块不出现 */
  bottomLine: {
    isAcceptable: boolean
    risks: string[]
    protectiveConditions: string[]
  } | null
  /** 本次带走的底线卡（快照，之后改选不影响已出的结果） */
  carry: CarryCard[]
  /** 推荐的相似经历旅人 */
  people: Traveler[]
}

/** 页面快照 */
export interface LabSnapshot {
  question: string
  choices: LabChoice[]
  choicesLoading: boolean
  pick: string | null
  horizon: SimulationHorizon
  carryIds: string[]
  carryCount: number
  loading: boolean
  loadStep: string
  canSim: boolean
  result: SimResultData | null
  errorMessage: string | null
}

export class LabModel {
  question = EXPLORE_TOPICS[0]?.sampleQuestion ?? ''

  /** 选中的选择卡名称（不是 id：自定义卡按名称去重，名称就是身份） */
  pick: string | null = null
  horizon: SimulationHorizon = SIMULATION_HORIZONS.find((h) => h.key === 'year5') ?? SIMULATION_HORIZONS[0]!

  private carryIds: string[] = []

  loading = false
  loadStep = ''
  result: SimResultData | null = null
  errorMessage: string | null = null

  /** 服务端现生成的选择卡 */
  private remoteChoices: LabChoice[] = []
  /** 用户自己写的卡（本地持久化） */
  private customChoices: LabChoice[] = []
  choicesLoading = false
  /** 自增序号做「只认最后一次」：小程序没有 Task.cancel，用世代号丢弃过期回包 */
  private choicesGeneration = 0

  private travelerPool: Traveler[] = []

  constructor(private readonly onChange: (snapshot: LabSnapshot) => void) {}

  /** 服务端卡在前、自己写的卡在后 —— 与 iOS `choices` 同序 */
  get choices(): LabChoice[] {
    return [...this.remoteChoices, ...this.customChoices]
  }

  get canSim(): boolean {
    return this.pick !== null && !this.loading
  }

  /**
   * 上报用的话题：拿问题正文去对四条预置问题，对不上就是 `custom`。
   * 实验室本身没有话题概念，而问题正文是用户内容不能上报。
   */
  private get analyticsTopic(): string {
    const clean = this.question.trim()
    return EXPLORE_TOPICS.find((t) => t.sampleQuestion === clean)?.topic ?? 'custom'
  }

  // ── 问题与档位 ──

  setQuestion(text: string): void {
    this.question = text
    this.emit()
  }

  setHorizon(key: string): void {
    const found = SIMULATION_HORIZONS.find((h) => h.key === key)
    if (!found || found.key === this.horizon.key) return
    this.horizon = found
    this.emit()
  }

  /** 转盘拖动落在第 index 个刻度上（0..13），越界按端点收拢 */
  setHorizonIndex(index: number): void {
    const clamped = Math.max(0, Math.min(SIMULATION_HORIZONS.length - 1, Math.round(index)))
    const found = SIMULATION_HORIZONS[clamped]
    if (!found || found.key === this.horizon.key) return
    this.horizon = found
    this.emit()
  }

  get horizonIndex(): number {
    const i = SIMULATION_HORIZONS.findIndex((h) => h.key === this.horizon.key)
    return i < 0 ? 0 : i
  }

  // ── 选择卡 ──

  /** 选中 / 取消选中一张卡；返回给页面弹的 toast 文案 */
  togglePick(name: string): string | null {
    if (this.pick === name) {
      this.pick = null
      this.emit()
      return null
    }
    this.pick = name
    this.emit()
    return `已选中「${name}」`
  }

  /** 清空已选（点「自定义选择」时用：那张卡还没写完，不该留着旧选择） */
  clearPick(): void {
    if (this.pick === null) return
    this.pick = null
    this.emit()
  }

  /** 拖进转盘：只选中，不取消（拖过去的意思一定是「要它」） */
  dropOnDial(name: string): string {
    this.pick = name
    this.emit()
    return `「${name}」已放入实验室`
  }

  /** 长按删除自定义卡；服务端卡删不掉（下次生成还会回来，删了只会让人困惑） */
  removeCustomChoice(name: string): boolean {
    const before = this.customChoices.length
    this.customChoices = this.customChoices.filter((c) => c.name !== name)
    if (this.customChoices.length === before) return false
    if (this.pick === name) this.pick = null
    this.persistCustomChoices()
    this.emit()
    return true
  }

  /** 写一张自己的卡；返回 toast 文案，`ok` 为 false 时是校验失败 */
  addCustomChoice(name: string, desc: string): { ok: boolean; message: string } {
    const cleanName = name.trim().slice(0, NAME_MAX)
    const cleanDesc = desc.trim().slice(0, DESC_MAX)
    const duplicated = this.choices.some((c) => c.name === cleanName)
    if (!cleanName || !cleanDesc || duplicated) {
      return { ok: false, message: '名称和描述都要填，且不能重名' }
    }
    this.customChoices.push({
      id: `custom_${cleanName}`,
      icon: matchCardIconByCard(cleanName, cleanDesc) ?? 'custom',
      name: cleanName,
      desc: cleanDesc,
      isCustom: true,
    })
    this.pick = cleanName
    this.persistCustomChoices()
    this.emit()
    return { ok: true, message: `已选中「${cleanName}」` }
  }

  // ── 底线卡 ──

  /** 勾选 / 取消一张底线卡；超过上限时返回提示文案 */
  toggleCarry(id: string): string | null {
    if (this.carryIds.includes(id)) {
      this.carryIds = this.carryIds.filter((x) => x !== id)
      this.emit()
      return null
    }
    if (this.carryIds.length >= CARRY_MAX) return `最多带走 ${CARRY_MAX} 张底线卡`
    this.carryIds = [...this.carryIds, id]
    this.emit()
    return null
  }

  private get carryCards(): CarryCard[] {
    return CARRY_CARDS.filter((c) => this.carryIds.includes(c.id))
  }

  // ── 生成选择卡 ──

  /** 冷启动 / 换问题：拉一批现生成的选择卡。失败只报错，绝不拿假数据顶上 */
  async loadChoices(): Promise<void> {
    const q = this.question.trim()
    if (!q) return

    const generation = ++this.choicesGeneration
    this.choicesLoading = true
    this.errorMessage = null
    this.emit()

    try {
      const response = await withTimeout(
        labChoices({
          question: q,
          topic: this.analyticsTopic === 'custom' ? undefined : this.analyticsTopic,
          previous_choices: this.customChoices.map((c) => c.name),
        }),
        CHOICES_TIMEOUT_MS,
      )
      // 过期回包整份丢掉：问题已经换了，这批卡答的是上一个问题
      if (generation !== this.choicesGeneration) return
      if (q !== this.question.trim() || response.cards.length === 0) {
        this.remoteChoices = []
        this.errorMessage = '选择卡生成失败，请检查网络后重试'
        return
      }

      // 与自定义卡按名称去重：同名两张卡在牌堆里分不出谁是谁
      const seen = new Set(this.customChoices.map((c) => c.name))
      const cards: LabChoice[] = []
      for (const card of response.cards) {
        const name = card.title.trim()
        const desc = card.description.trim()
        if (!name || seen.has(name)) continue
        seen.add(name)
        cards.push({
          id: card.id,
          icon: resolveCardIcon(card.glyph, name, desc),
          name,
          desc,
          isCustom: false,
          color: card.color,
        })
      }

      if (cards.length === 0) {
        this.remoteChoices = []
        this.errorMessage = '选择卡生成结果无效，请重试'
        return
      }
      this.remoteChoices = cards
      if (this.pick !== null && !this.choices.some((c) => c.name === this.pick)) this.pick = null
    } catch {
      if (generation !== this.choicesGeneration) return
      this.remoteChoices = []
      this.errorMessage = '选择卡生成失败，请检查网络后重试'
    } finally {
      if (generation === this.choicesGeneration) {
        this.choicesLoading = false
        this.emit()
      }
    }
  }

  // ── 推演 ──

  /** 开始推演。守卫在埋点之前：重复点击被拦下的那些不算一次推演请求 */
  async runSim(): Promise<void> {
    const choiceName = this.pick
    if (choiceName === null || this.loading) return

    this.loading = true
    this.loadStep = LOAD_STEPS[0] ?? ''
    this.errorMessage = null
    this.result = null
    this.emit()

    const carry = this.carryCards
    const horizon = this.horizon
    const question = this.question.trim()

    // 加载文案与请求并行跑：请求再快也让三步走完，避免闪一下就没了
    const steps = this.playLoadSteps()
    try {
      const [response] = await Promise.all([
        simulate({
          question,
          choice: choiceName,
          years: horizon.apiYears,
          time_horizon: horizon.label,
          carry_cards: carry.length > 0 ? carry.map((c) => c.name) : undefined,
        }),
        steps,
      ])

      const people = await this.resolveTravelers(response.recommended_traveler_ids)
      this.result = {
        question,
        choice: choiceName,
        horizon,
        scenarios: {
          optimistic: response.scenarios.optimistic,
          general: response.scenarios.general,
          cautionary: response.scenarios.cautionary,
        },
        bottomLine: response.bottom_line_analysis
          ? {
              isAcceptable: response.bottom_line_analysis.is_acceptable,
              risks: response.bottom_line_analysis.risks,
              protectiveConditions: response.bottom_line_analysis.protective_conditions,
            }
          : null,
        carry,
        people,
      }
    } catch {
      await steps
      this.result = null
      this.errorMessage = '推演 API 调用失败，请检查网络后重试'
    } finally {
      this.loading = false
      this.loadStep = ''
      this.emit()
    }
  }

  /** 结果页真正露出时上报：card_count 取展示的相似经历卡片数
   *  （三种结局是固定 3 个面板，没有区分度），问题与选择原文不上报 */
  trackResultViewed(): void {
    if (!this.result) return
    track('lab_result_viewed', { card_count: this.result.people.length })
  }

  closeResult(): void {
    this.result = null
    this.emit()
  }

  private async playLoadSteps(): Promise<void> {
    for (const step of LOAD_STEPS) {
      this.loadStep = step
      this.emit()
      await sleep(LOAD_STEP_MS)
    }
  }

  /** 按 id 去素材池里找人；池子取不到就用 demo 素材，不让结果页缺一整块 */
  private async resolveTravelers(ids: number[]): Promise<Traveler[]> {
    if (ids.length === 0) return []
    if (this.travelerPool.length === 0) {
      try {
        this.travelerPool = await loadTravelers()
      } catch {
        this.travelerPool = []
      }
    }
    const pool = this.travelerPool.length > 0 ? this.travelerPool : DEMO_TRAVELERS
    const people: Traveler[] = []
    for (const id of ids) {
      const t = pool.find((x) => x.id === id)
      if (t && !people.some((x) => x.id === t.id)) people.push(t)
    }
    return people
  }

  // ── 本地持久化 ──

  /**
   * 读本地自定义卡。旧卡可能缺 `icon` 字段（早先存的是模型给的 emoji），
   * 缺就按文案重新匹配 —— 升级后老卡不能整批解码失败而消失。
   */
  loadCustomChoices(): void {
    const raw = wx.getStorageSync<unknown>(CUSTOM_CHOICES_KEY)
    if (!Array.isArray(raw)) return
    const cards: LabChoice[] = []
    for (const item of raw) {
      if (typeof item !== 'object' || item === null) continue
      const row = item as Partial<LabChoice>
      const name = typeof row.name === 'string' ? row.name.trim() : ''
      const desc = typeof row.desc === 'string' ? row.desc.trim() : ''
      if (!name || cards.some((c) => c.name === name)) continue
      cards.push({
        id: `custom_${name}`,
        icon: resolveCardIcon(typeof row.icon === 'string' ? row.icon : undefined, name, desc),
        name,
        desc,
        isCustom: true,
      })
    }
    this.customChoices = cards
    this.emit()
  }

  private persistCustomChoices(): void {
    wx.setStorageSync(CUSTOM_CHOICES_KEY, this.customChoices)
  }

  // ── 快照 ──

  snapshot(): LabSnapshot {
    return {
      question: this.question,
      choices: this.choices,
      choicesLoading: this.choicesLoading,
      pick: this.pick,
      horizon: this.horizon,
      carryIds: this.carryIds,
      carryCount: this.carryIds.length,
      loading: this.loading,
      loadStep: this.loadStep,
      canSim: this.canSim,
      result: this.result,
      errorMessage: this.errorMessage,
    }
  }

  emit(): void {
    this.onChange(this.snapshot())
  }
}

/* ── 纯函数辅助 ── */

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/** 超时只是「不再等」，请求本身没有取消概念（小程序 RequestTask 这里拿不到） */
function withTimeout<T>(task: Promise<T>, ms: number): Promise<T> {
  return Promise.race([
    task,
    new Promise<T>((_, reject) => setTimeout(() => reject(new Error('timeout')), ms)),
  ])
}
