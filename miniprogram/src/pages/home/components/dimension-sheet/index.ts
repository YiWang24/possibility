/**
 * 动态画像维度浮层 —— 对应 iOS `Features/Home/DimensionSheet.swift`。
 *
 * 四个软维度通用：关键词批次（换一批）+ 自定义关键词 + 小工具入口，保存回填画像。
 *
 * 与 iOS 的两处平台差异：
 * - 第三方官方测评（VIA 等）iOS 用 `openURL` 直接跳浏览器；小程序打不开外部网页
 *   （要 `web-view` + 已备案的业务域名，而这些是别人家的域名，我们备不了），
 *   所以复制链接 + toast 提示，用户自己去浏览器打开。
 * - 弹层标题走 `<sheet title>` 而不是像 iOS 那样画在内容区第一行：小程序的
 *   弹层没有下拉关闭手势，标题栏的 ✕ 是唯一的关闭入口，不能省。
 */

import { DIMENSIONS, type DimensionConfig, type DimensionKey, type DimensionTool } from '../../../../core/models/dimensions'

/** 最多存 5 个关键词（iOS `Array((selected + custom).prefix(5))`） */
const MAX_KEYWORDS = 5

interface ChipItem {
  word: string
  isCustom: boolean
  on: boolean
}

interface SheetData {
  cfg: DimensionConfig | null
  batch: number
  chips: ChipItem[]
  selected: string[]
  custom: string[]
  showCustomInput: boolean
  customText: string
  canSave: boolean
}

Component<
  SheetData,
  {
    show: BooleanConstructor
    dimKey: StringConstructor
    initialSelected: ArrayConstructor
  },
  {
    reset(): void
    refreshChips(): void
    onClose(): void
    onRotate(): void
    onToggle(e: WechatMiniprogram.BaseEvent<Record<string, never>, { word: string; custom: boolean }>): void
    onToggleCustomInput(): void
    onCustomInput(e: WechatMiniprogram.CustomEvent<{ value: string }>): void
    onAddCustom(): void
    onToolTap(e: WechatMiniprogram.BaseEvent<Record<string, never>, { index: number }>): void
    onSave(): void
  },
  []
>({
  properties: {
    show: Boolean,
    /** skill / like / love / family / social */
    dimKey: String,
    /** 已存在画像里的关键词，打开时预选上 */
    initialSelected: Array,
  },

  options: { addGlobalClass: true },

  data: {
    cfg: null,
    batch: 0,
    chips: [],
    selected: [],
    custom: [],
    showCustomInput: false,
    customText: '',
    canSave: false,
  },

  observers: {
    'show, dimKey': function observeOpen(show: boolean) {
      // 每次打开都从入参重建，而不是保留上次的编辑残留：
      // 换一个维度打开时若沿用旧 selected，会把「我擅长」的词存进「我喜欢」
      if (show) this.reset()
    },
  },

  methods: {
    reset() {
      const key = this.properties.dimKey as DimensionKey
      const cfg = DIMENSIONS[key]
      if (!cfg) return
      this.setData(
        {
          cfg,
          batch: 0,
          selected: (this.properties.initialSelected as string[]) ?? [],
          custom: [],
          showCustomInput: false,
          customText: '',
        },
        () => this.refreshChips(),
      )
    },

    /** 展示序：已选(不在当前批) + 当前批 + 自定义，去重（对照 iOS `chipWords`）。
     *  已选词排在前面，是为了让用户在「换一批」之后仍看得见自己刚选的东西。 */
    refreshChips() {
      const { cfg, batch, selected, custom } = this.data
      if (!cfg) return
      const batchWords = cfg.batches[batch] ?? []
      const seen = new Set<string>()
      const chips: ChipItem[] = []

      for (const w of selected.filter((s) => !batchWords.includes(s)).concat(batchWords)) {
        if (seen.has(w)) continue
        seen.add(w)
        chips.push({ word: w, isCustom: false, on: selected.includes(w) })
      }
      for (const w of custom) {
        if (seen.has(w)) continue
        seen.add(w)
        chips.push({ word: w, isCustom: true, on: true })
      }

      this.setData({ chips, canSave: selected.length > 0 || custom.length > 0 })
    },

    onClose() {
      this.triggerEvent('close')
    },

    onRotate() {
      const { cfg, batch } = this.data
      if (!cfg) return
      this.setData({ batch: (batch + 1) % cfg.batches.length }, () => this.refreshChips())
    },

    onToggle(e: WechatMiniprogram.BaseEvent<Record<string, never>, { word: string; custom: boolean }>) {
      const { word, custom: isCustom } = e.currentTarget.dataset
      if (isCustom) {
        // 自定义词没有「取消选中」态，点一下就是删掉（与 iOS 一致）
        this.setData({ custom: this.data.custom.filter((w) => w !== word) }, () => this.refreshChips())
        return
      }
      const selected = this.data.selected.includes(word)
        ? this.data.selected.filter((w) => w !== word)
        : this.data.selected.concat(word)
      this.setData({ selected }, () => this.refreshChips())
    },

    onToggleCustomInput() {
      this.setData({ showCustomInput: !this.data.showCustomInput })
    },

    onCustomInput(e: WechatMiniprogram.CustomEvent<{ value: string }>) {
      this.setData({ customText: e.detail.value })
    },

    onAddCustom() {
      const w = this.data.customText.trim()
      if (!w || this.data.custom.includes(w) || this.data.selected.includes(w)) {
        this.setData({ customText: '' })
        return
      }
      this.setData({ custom: this.data.custom.concat(w), customText: '' }, () => this.refreshChips())
    },

    onToolTap(e: WechatMiniprogram.BaseEvent<Record<string, never>, { index: number }>) {
      const tool = this.data.cfg?.tools[e.currentTarget.dataset.index] as DimensionTool | undefined
      if (!tool) return

      if (tool.assessment) {
        wx.navigateTo({ url: `/subpkg/studio/assessment/index?kind=${tool.assessment}&dim=${this.properties.dimKey}` })
        return
      }
      if (tool.cardGame) {
        wx.navigateTo({ url: `/subpkg/card-game/play/index?kind=${tool.cardGame}` })
        return
      }
      if (tool.href) {
        // web 侧的引导式探索路由（如 /assessment/want-to-do），小程序对应画像工作室的同一套流程
        wx.navigateTo({ url: `/subpkg/studio/index/index?flow=${encodeURIComponent(tool.href)}` })
        return
      }
      if (tool.externalHref) {
        wx.setClipboardData({
          data: tool.externalHref,
          success: () => wx.showToast({ title: '链接已复制，去浏览器打开', icon: 'none' }),
        })
        return
      }
      wx.showToast({ title: `「${tool.name}」即将上线`, icon: 'none' })
    },

    onSave() {
      const keywords = this.data.selected.concat(this.data.custom).slice(0, MAX_KEYWORDS)
      if (keywords.length === 0) return
      this.triggerEvent('save', { dimension: this.properties.dimKey, keywords })
    },
  },
})
