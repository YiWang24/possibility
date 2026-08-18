/**
 * 推演结果 —— 对应 iOS `Features/Lab/ResultView.swift`。
 *
 * iOS 用 `fullScreenCover` 把它推成一页；小程序里它是实验室页内的全屏浮层
 * （见 `pages/lab/index.ts` 的说明），所以「返回」不是出栈而是 `bind:close`。
 *
 * 三处需要在 TS 里先算好的东西，WXML 表达式做不到：
 * - 分档配色（顺光 / 大概率 / 背光）要落成 `sim--best|likely|worst` 这样的类名，
 *   WXSS 拼不出变量名；
 * - 底线压力测试的每张卡有「可承受 / 越线」两态，答案存在 map 里，
 *   但 WXML 取不了 `answers[card.id]`，得摊平成每张卡自带的 `verdict` 字段；
 * - 结论块（verdict）要等所有卡都答完才出现，`Object.keys(...).length` 同理。
 */

import type { Traveler } from '../../../../core/models'
import type { CarryCard, SimResultData } from '../../model'

/** 一档结局的静态文案与配色档位（iOS `TabSpec`） */
interface TabSpec {
  key: 'best' | 'likely' | 'worst'
  title: string
  eyebrow: string
}

const TABS: TabSpec[] = [
  { key: 'best', title: '最好的结果', eyebrow: 'BEST · 顺光面' },
  { key: 'likely', title: '一般情况', eyebrow: 'LIKELY · 大概率' },
  { key: 'worst', title: '最坏的结果', eyebrow: 'WORST · 背光面' },
]

/** 默认停在「一般情况」：先看大概率，再看两端（iOS `tab = 1`） */
const DEFAULT_TAB = 1

/** 一张底线卡在压力测试里的答案 */
type Verdict = 'ok' | 'bad' | ''

/** 摊平后的底线卡：答案跟着卡走，WXML 直接读 */
interface FloorRow extends CarryCard {
  verdict: Verdict
}

/** 当前档要渲染的一切（从 result.scenarios 里挑出来后摊平） */
interface PanelData {
  accentKey: TabSpec['key']
  eyebrow: string
  headline: string
  dimensions: { label: string; text: string }[]
  gains: string[]
  costs: string[]
  keyCondition: string
}

interface Data {
  tabs: TabSpec[]
  tab: number
  panel: PanelData | null
  /** 底线压力测试：只在「最坏的结果」那档且带了底线卡时出现 */
  floorRows: FloorRow[]
  floorShow: boolean
  /** 全部答完才给结论 */
  floorDone: boolean
  floorPass: boolean
  floorRejected: string
  floorCount: number
  /** 相似经历的人（横滑）。标签只留前两个：WXML 切不了数组，iOS 也是 prefix(2) */
  people: (Traveler & { tags: string[] })[]
}

/**
 * 结果对象只能声明成裸 `ObjectConstructor`（同 `persona-stage` 的 `model`）：
 * 官方 typings 里 Object 属性的默认值必须是 `IAnyObject`，`null` 通不过。
 * 所以取值走下面的实例字段 `current`，`this.data.result` 只是 WXML 的入口。
 */
interface Instance {
  current?: SimResultData | null
}

Component<
  Data,
  { result: ObjectConstructor },
  {
    syncPanel(): void
    syncFloor(): void
    onTabTap(e: WechatMiniprogram.BaseEvent<Record<string, never>, { index: string }>): void
    onFloorTap(
      e: WechatMiniprogram.BaseEvent<Record<string, never>, { id: string; verdict: 'ok' | 'bad' }>,
    ): void
    onTravelerTap(e: WechatMiniprogram.BaseEvent<Record<string, never>, { id: string }>): void
    onClose(): void
    noop(): void
  },
  [],
  Instance
>({
  properties: {
    /** `LabModel` 的推演结果；实验室页只在非空时挂载本组件 */
    result: Object,
  },

  data: {
    tabs: TABS,
    tab: DEFAULT_TAB,
    panel: null,
    floorRows: [],
    floorShow: false,
    floorDone: false,
    floorPass: true,
    floorRejected: '',
    floorCount: 0,
    people: [],
  },

  options: { addGlobalClass: true },

  observers: {
    /**
     * 结果换了（重新推演）就整块重置：档位回到「一般情况」，
     * 底线测试的答案也不能留 —— 那些答案答的是上一次的最坏结果。
     *
     * 先比引用再重置：实验室页每次 emit 都会把同一份 result 重新 setData 一遍，
     * 不挡住的话用户刚答完的底线测试会被自己的下一次 emit 清空。
     */
    result(value: SimResultData | null) {
      if (this.current === value) return
      this.current = value
      this.setData(
        {
          tab: DEFAULT_TAB,
          people: (value?.people ?? []).map((t) => ({ ...t, tags: t.tags.slice(0, 2) })),
          floorRows: (value?.carry ?? []).map((c) => ({ ...c, verdict: '' as Verdict })),
        },
        () => {
          this.syncPanel()
          this.syncFloor()
        },
      )
    },
  },

  methods: {
    /** 把当前档的结局摊平成 WXML 直接能用的形状 */
    syncPanel() {
      const result = this.current
      if (!result) {
        this.setData({ panel: null })
        return
      }
      const spec = TABS[this.data.tab] ?? TABS[DEFAULT_TAB]!
      const scenario =
        spec.key === 'best'
          ? result.scenarios.optimistic
          : spec.key === 'worst'
            ? result.scenarios.cautionary
            : result.scenarios.general
      this.setData({
        panel: {
          accentKey: spec.key,
          eyebrow: spec.eyebrow,
          headline: scenario.headline,
          dimensions: scenario.dimensions,
          gains: scenario.gains,
          costs: scenario.costs,
          keyCondition: scenario.key_condition.trim(),
        },
      })
    },

    /** 底线测试的露出条件与结论：答案变一次就重算一次 */
    syncFloor() {
      const rows = this.data.floorRows
      const answered = rows.filter((r) => r.verdict !== '')
      const rejected = rows.filter((r) => r.verdict === 'bad')
      this.setData({
        floorShow: this.data.tab === 2 && rows.length > 0,
        floorDone: rows.length > 0 && answered.length === rows.length,
        floorPass: rejected.length === 0,
        floorRejected: rejected.map((r) => r.name).join('、'),
        floorCount: rows.length,
      })
    },

    onTabTap(e) {
      const index = Number(e.currentTarget.dataset.index)
      if (!Number.isFinite(index) || index === this.data.tab) return
      this.setData({ tab: index }, () => {
        this.syncPanel()
        this.syncFloor()
      })
    },

    onFloorTap(e) {
      const { id, verdict } = e.currentTarget.dataset
      const rows = this.data.floorRows.map((r) =>
        // 再点同一个答案就撤回，和选择卡的点选一致
        r.id === id ? { ...r, verdict: (r.verdict === verdict ? '' : verdict) as Verdict } : r,
      )
      this.setData({ floorRows: rows }, () => this.syncFloor())
    },

    onTravelerTap(e) {
      wx.navigateTo({ url: `/subpkg/profile/index/index?id=${e.currentTarget.dataset.id}` })
    },

    onClose() {
      this.triggerEvent('close')
    },

    /** 浮层吞掉滚动，别让底下的实验室页跟着动 */
    noop() {},
  },
})
