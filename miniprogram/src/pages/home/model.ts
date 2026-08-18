/**
 * 首页「认识你自己」状态 —— 对应 iOS `Features/Home/HomeModel.swift`。
 *
 * 只搬首页真正用得上的那部分：探索发问、动态画像（6 维 + 完成度）、
 * 云端数字形象、今日日记概览与探索天数。
 *
 * 录音 / 转写 / analyze-diary 那一整块**不在这里**：开发方案 §7 把
 * 「录音（mp3）+ 隐私授权 + 波形」整体划给波次 2 · F（`subpkg/diary/`）。
 * 首页日记卡只呈现由 `list-diary` 得到的真实状态，「记录今日」跳进日记模块，
 * 不在这里重复实现一遍录音。
 *
 * 与页面的分工同 `ChatModel`：这个文件只管状态，不碰视图；页面通过 `onChange`
 * 拿快照去 setData。
 */

import { getProfile, listDiaryPage, personaGenerate, saveDimension } from '../../core/net/api'
import { dayString, parseTimestamp, weekdayNarrow } from '../../core/timestamp'
import { emotionEmoji } from '../../core/models/emotions'
import { DIMENSION_KEYS, DIMENSIONS, type DimensionKey } from '../../core/models/dimensions'
import { buildPersona, type PersonaForm, type PersonaModel } from './persona'

/** 首页画像卡展示的 6 个维度：人格底色 + 四软维度（+ social）。
 *  完成度只统计这几个，云端 dims 里的其他业务字段不计入。 */
const PORTRAIT_KEYS: string[] = ['personality', ...DIMENSION_KEYS]

/** 本地持久化前缀（对应 iOS UserDefaults `kaleido_dim_`、原型 localStorage） */
const STORE_PREFIX = 'kaleido_dim_'
/** 人生底牌（卡牌游戏结算写入，首页只读） */
const LIFE_SIGNATURE_KEY = 'kaleido_life_signature_v1'

/** 关键词在一个维度里的拼接分隔符 —— 存取两侧必须一致，改这里等于改存量数据 */
const JOINER = ' · '
/** 一个维度最多存 5 个关键词 */
const MAX_KEYWORDS = 5
/** 云端形象生成的防抖窗口：连填多个维度时合并成一次 LLM 调用 */
const PERSONA_DEBOUNCE_MS = 2000
/** 形象生成超时：超时静默保持本地兜底，不让首页干等 */
const PERSONA_TIMEOUT_MS = 15000
/** 人格底色的图标底色（iOS 里写死在 portraitDims 第一行） */
const PERSONALITY_TINT = '#5968D9'

/** 画像卡的一行 */
export interface PortraitDim {
  id: string
  icon: string
  iconTint: string
  /** 图标底板色：iconTint 的 15% —— wxss 拿不到「hex + alpha」，在这里算好走 inline style */
  iconBg: string
  label: string
  /** 空串表示尚未填写（todo 虚线态） */
  value: string
  isTodo: boolean
  /** 点开的维度浮层；空串表示人格底色，直接进大五人格测评 */
  dimensionKey: string
}

/** 人生底牌（卡牌游戏结算写入的 3 张公开底牌） */
export interface LifeSignatureCard {
  glyph: string
  name: string
}

/** 周历里的一格 */
export interface DayCell {
  /** 单字星期（一 / 二 / … / 日）；今天固定显示「今天」 */
  label: string
  emoji: string
  filled: boolean
  isToday: boolean
  /** yyyy-MM-dd，点开日记详情用 */
  date: string
}

export interface HomeSnapshot {
  question: string
  topic: string | null
  canSend: boolean
  portraitDims: PortraitDim[]
  completed: number
  total: number
  percent: number
  lifeSignatureCards: LifeSignatureCard[]
  persona: PersonaModel
  personaSummary: string
  week: DayCell[]
  hasRecordedToday: boolean
  exploredDays: number
}

/** 把 `#RRGGBB` 转成带透明度的 rgba()，用于图标底板这类「同色淡底」。 */
function tintWithAlpha(hex: string, alpha: number): string {
  const clean = hex.replace('#', '')
  const n = parseInt(clean, 16)
  if (clean.length !== 6 || Number.isNaN(n)) return `rgba(94, 150, 255, ${alpha})`
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${alpha})`
}

/** 后端 shape（中文形态名或英文 key）→ 本地绘制形态；未知形态回退本地计算 */
function personaFormNamed(shape: string): PersonaForm | null {
  const lower = shape.toLowerCase()
  if (lower.includes('crystal') || shape.includes('晶')) return 'crystal'
  if (lower.includes('bloom') || shape.includes('花')) return 'bloom'
  if (lower.includes('wing') || shape.includes('翼')) return 'wing'
  if (lower.includes('orbit') || shape.includes('星') || shape.includes('轨')) return 'orbit'
  return null
}

/** 当天 0 点 */
function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate())
}

/** iOS 那边这一周除今天外是 6 个写死的 demo 情绪（`DiaryCard.mockWeek`）。
 *  照搬是为了让空账号也能看见「一周的形状」，而不是六个空圈；今天那格永远用真实数据。 */
const MOCK_WEEK_EMOJI = ['🙂', '😮‍💨', '😊', '😐', '🙂', '😌']

export class HomeModel {
  /** 探索发问 */
  question = ''
  topic: string | null = null

  /** 已填维度：dimKey → 关键词拼接文本（含 personality） */
  private filledDims: Record<string, string> = {}
  private lifeSignatureCards: LifeSignatureCard[] = []

  /** 最近一次云端生成的形象参数；null = 未生成 / 失败（走本地兜底） */
  private remotePersona: { shape: string; hue: number; lobes: number; seed: number; summary: string } | null = null
  /** 上次成功触发生成时的画像快照 —— 画像没变就不重复打 LLM */
  private lastPersonaSnapshot: string | null = null
  private personaDebounceTimer: number | null = null
  /** 自增序号做「只认最后一次」：小程序没有 Task.cancel，用世代号丢弃过期回包 */
  private personaGeneration = 0

  /** 天 → 当天最新一条日记的情绪列表 */
  private emotionsByDay: Record<string, string[]> = {}
  private hasRemoteDiaryToday = false
  /** 已探索天数：最早一条日记距今 +1；未加载 / 失败保持 demo 值（对齐 iOS 的 47） */
  private exploredDays = 47

  /** demo 人物 */
  readonly userName = '老己'

  constructor(private readonly onChange: (snapshot: HomeSnapshot) => void) {}

  // ── 探索发问 ──

  get trimmedQuestion(): string {
    return this.question.trim()
  }

  get canSend(): boolean {
    return this.trimmedQuestion.length > 0
  }

  setQuestion(text: string): void {
    this.question = text
    this.emit()
  }

  /** 选中话题且输入为空时才填样例；再点一次取消（对齐 iOS `topic.didSet`） */
  selectTopic(topic: string | null, sampleQuestion: string): void {
    this.topic = this.topic === topic ? null : topic
    if (this.topic !== null && this.trimmedQuestion.length === 0) {
      this.question = sampleQuestion
    }
    this.emit()
  }

  clearQuestion(): void {
    this.question = ''
    this.emit()
  }

  // ── 动态画像 ──

  /** 冷启动：先读本地（立即可见），再用云端画像补齐本地没有的维度（换机 / 重装漫游） */
  loadPortrait(): void {
    const loaded: Record<string, string> = {}
    PORTRAIT_KEYS.forEach((key) => {
      const v = wx.getStorageSync<string>(STORE_PREFIX + key)
      if (typeof v === 'string' && v.length > 0) loaded[key] = v
    })
    this.filledDims = loaded
    this.loadLifeSignature()
    this.emit()

    this.refreshPersona()

    getProfile()
      .then((remote) => {
        // 从权威原子事实聚合；本地已有的以本地为准（刚编辑过，更新）
        const grouped: Record<string, string[]> = {}
        remote.facts.forEach((fact) => {
          if (!fact.value) return
          ;(grouped[fact.dimension] ??= []).push(fact.value)
        })
        let changed = false
        Object.keys(grouped).forEach((key) => {
          const value = (grouped[key] ?? []).join(JOINER)
          if (!value || this.filledDims[key]) return
          this.filledDims[key] = value
          wx.setStorageSync(STORE_PREFIX + key, value)
          changed = true
        })
        if (changed) this.emit()
      })
      .catch(() => {
        /* 云端画像取不到就用本地的，首页不因此报错 */
      })
  }

  /** 冷启动 / 卡牌结算后重新读取人生底牌 */
  loadLifeSignature(): void {
    const raw = wx.getStorageSync<LifeSignatureCard[]>(LIFE_SIGNATURE_KEY)
    this.lifeSignatureCards = Array.isArray(raw) ? raw.slice(0, 3) : []
  }

  /** 已保存关键词拆回数组（重开浮层时回显已选） */
  selectedKeywords(key: string): string[] {
    const text = this.filledDims[key]
    if (!text) return []
    return text.split(JOINER).filter((w) => w.length > 0)
  }

  /** 保存某维度的关键词 → 回填 + 本地持久化 + 云端落库（失败静默，本地已存） */
  saveDimensionKeywords(key: string, keywords: string[]): void {
    const picked = keywords.slice(0, MAX_KEYWORDS)
    const text = picked.join(JOINER)
    if (!text) return
    this.filledDims[key] = text
    wx.setStorageSync(STORE_PREFIX + key, text)
    this.emit()

    // 先落库再重新生成云端形象（/persona 读的是服务端画像，得等新维度可见）
    saveDimension({ dimension: key, tags: picked, source: 'manual' })
      .then(() => this.scheduleRefreshPersona())
      .catch(() => {
        /* 落库失败不回滚本地：用户的选择不该因为一次网络抖动消失 */
      })
  }

  get portraitDims(): PortraitDim[] {
    const personality = this.filledDims.personality ?? ''
    const rows: PortraitDim[] = [
      {
        id: 'personality',
        icon: '◎',
        iconTint: PERSONALITY_TINT,
        iconBg: tintWithAlpha(PERSONALITY_TINT, 0.15),
        label: '人格底色',
        value: personality,
        isTodo: personality.length === 0,
        dimensionKey: '',
      },
    ]
    DIMENSION_KEYS.forEach((key: DimensionKey) => {
      const cfg = DIMENSIONS[key]
      const value = this.filledDims[key] ?? ''
      rows.push({
        id: key,
        icon: cfg.icon,
        iconTint: cfg.tint,
        iconBg: tintWithAlpha(cfg.tint, 0.15),
        label: cfg.title,
        value,
        isTodo: value.length === 0,
        dimensionKey: key,
      })
    })
    return rows
  }

  private get completion(): { completed: number; total: number; percent: number } {
    const completed = PORTRAIT_KEYS.reduce((count, key) => {
      const v = this.filledDims[key]
      return v && v.trim().length > 0 ? count + 1 : count
    }, 0)
    return {
      completed,
      total: PORTRAIT_KEYS.length,
      percent: Math.round((completed / PORTRAIT_KEYS.length) * 100),
    }
  }

  // ── 云端数字形象 ──

  /** 抽象数字形象：优先云端 persona（shape/hue/lobes/seed），未生成 / 失败时本地重建 */
  get personaModel(): PersonaModel {
    const values = PORTRAIT_KEYS.map((k) => this.filledDims[k]).filter((v): v is string => !!v)
    const signature = this.lifeSignatureCards.map((c) => c.name)
    const local = buildPersona(values, signature)
    const remote = this.remotePersona
    if (!remote) return local
    return {
      seed: Math.max(0, remote.seed) >>> 0,
      filled: values.length,
      signature,
      form: personaFormNamed(remote.shape) ?? local.form,
      hue: remote.hue,
      lobes: Math.min(Math.max(remote.lobes, 3), 9),
      shapeName: remote.shape,
    }
  }

  /**
   * 画像变化后重新生成云端形象；失败或超时静默保持本地兜底。
   * 画像快照未变且已有云端形象时跳过 —— 否则每次 onShow 都会打一次 LLM。
   */
  refreshPersona(): void {
    const snapshot = `${PORTRAIT_KEYS.map((k) => this.filledDims[k])
      .filter((v): v is string => !!v)
      .join('|')}#${this.lifeSignatureCards.map((c) => c.name).join('|')}`
    if (snapshot === this.lastPersonaSnapshot && this.remotePersona) return
    this.lastPersonaSnapshot = snapshot

    const generation = ++this.personaGeneration
    let settled = false
    const timeout = setTimeout(() => {
      settled = true
    }, PERSONA_TIMEOUT_MS)

    personaGenerate()
      .then((job) => {
        clearTimeout(timeout)
        if (settled || generation !== this.personaGeneration) return
        if (job.status === 'failed' || !job.persona) return
        this.remotePersona = job.persona
        this.emit()
      })
      .catch(() => {
        clearTimeout(timeout)
        /* 生成失败保持本地兜底形象，用户看不出差别，不打扰 */
      })
  }

  /** 连续保存多个维度时合并：停手 ~2s 后才真正触发一次生成 */
  private scheduleRefreshPersona(): void {
    if (this.personaDebounceTimer !== null) clearTimeout(this.personaDebounceTimer)
    this.personaDebounceTimer = setTimeout(() => {
      this.personaDebounceTimer = null
      this.refreshPersona()
    }, PERSONA_DEBOUNCE_MS) as unknown as number
  }

  // ── 今日语音日记 / 探索天数 ──

  /**
   * 拉云端日记 → 今天的真实状态 + 推算探索天数（冷启动调用，失败静默）。
   * 服务端把 limit 钳到 50，所以总数超窗时另取最早一条修正天数，
   * 否则记满 50 篇之后探索天数会被窗口截断、越记越少。
   */
  async loadDiaryOverview(): Promise<void> {
    let page: { entries: Awaited<ReturnType<typeof listDiaryPage>>['entries']; total: number }
    try {
      page = await listDiaryPage(50, 0)
    } catch {
      return
    }
    const rows = page.entries

    // list-diary 按时间倒序，首见即当天最新一条
    const byDay: Record<string, string[]> = {}
    let earliest: Date | null = null
    rows.forEach((row) => {
      const created = parseTimestamp(row.created_at)
      if (!created) return
      if (!earliest || created.getTime() < earliest.getTime()) earliest = created
      const key = dayString(created)
      if (!byDay[key]) byDay[key] = row.emotions ?? []
    })

    // 总数超出本窗：按倒序末位取真正最早的一条，避免探索天数被 50 条窗口低估
    if (page.total > rows.length) {
      try {
        const oldest = (await listDiaryPage(1, page.total - 1)).entries[0]
        const created = oldest ? parseTimestamp(oldest.created_at) : null
        if (created) earliest = created
      } catch {
        /* 取不到就沿用窗口内最早值 */
      }
    }

    const today = startOfDay(new Date())
    const first: Date | null = earliest
    if (first) {
      const days = Math.floor((today.getTime() - startOfDay(first).getTime()) / 86400000)
      this.exploredDays = Math.max(1, days + 1)
    } else {
      this.exploredDays = 1
    }

    this.emotionsByDay = byDay
    this.hasRemoteDiaryToday = byDay[dayString(today)] !== undefined
    this.emit()
  }

  /**
   * 最近 7 天（含今天）。
   *
   * 前 6 天沿用 iOS 的 demo 心情（`DiaryCard.mockWeek` 固定 6 个 emoji、固定已填）：
   * 空账号看见的是「一周的形状」而不是六个空圈。云端当天有真实日记时以真实的为准。
   * 今天那格永远只用真实数据 —— 那是用户唯一会去核对的一格，不能骗他。
   */
  private get week(): DayCell[] {
    const today = startOfDay(new Date())
    const cells: DayCell[] = []
    for (let offset = -6; offset <= 0; offset += 1) {
      const date = new Date(today.getTime() + offset * 86400000)
      const key = dayString(date)
      const emotions = this.emotionsByDay[key]
      const isToday = offset === 0
      if (isToday) {
        cells.push({
          label: '今天',
          emoji: emotions ? emotionEmoji(emotions[0]) : '',
          filled: this.hasRemoteDiaryToday,
          isToday: true,
          date: key,
        })
        continue
      }
      cells.push({
        label: weekdayNarrow(date),
        emoji: emotions ? emotionEmoji(emotions[0]) : MOCK_WEEK_EMOJI[offset + 6] ?? '',
        filled: true,
        isToday: false,
        date: key,
      })
    }
    return cells
  }

  // ── 快照 ──

  snapshot(): HomeSnapshot {
    const { completed, total, percent } = this.completion
    return {
      question: this.question,
      topic: this.topic,
      canSend: this.canSend,
      portraitDims: this.portraitDims,
      completed,
      total,
      percent,
      lifeSignatureCards: this.lifeSignatureCards,
      persona: this.personaModel,
      personaSummary: this.remotePersona?.summary ?? '',
      week: this.week,
      hasRecordedToday: this.hasRemoteDiaryToday,
      exploredDays: this.exploredDays,
    }
  }

  emit(): void {
    this.onChange(this.snapshot())
  }
}
