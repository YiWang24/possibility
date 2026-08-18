/**
 * 发布悬赏 —— 对应 iOS `Features/Community/CommunityView.swift` 的 `BountyComposeView`。
 *
 * iOS 用 `.sheet` 弹出，小程序里用共享的 `sheet` 组件承同样的呈现方式
 * （见 `core/design/components/sheet/`：整页级的走分包，页内浮层走这个）。
 *
 * 表单只做「拦不住就别拦」的校验：超字数不截断输入，而是给提示并让提交键失效 ——
 * 与 iOS 一致。真正的截断在 `model.publish()` 提交前做（iOS 的 `prefix()` 同位）。
 *
 * 提交由页面执行：网络、埋点、刷新列表都在 `model.ts` 里，组件只管收字和回传。
 * 因此 `submitting` / `error` 是从页面传进来的属性，不是组件自己的状态。
 */

import { COMPOSE_LIMITS, parseTags } from '../../model'

type Data = {
  question: string
  detail: string
  tagText: string
  reward: string
  questionCount: number
  tagCount: number
  /** 超限提示：iOS 是两条橙色小字，超了才出现 */
  overQuestion: boolean
  overTags: boolean
  /** 问题非空且不超限 */
  questionValid: boolean
  limitQuestion: number
  limitTags: number
}

const EMPTY: Data = {
  question: '',
  detail: '',
  tagText: '',
  reward: '',
  questionCount: 0,
  tagCount: 0,
  overQuestion: false,
  overTags: false,
  questionValid: false,
  limitQuestion: COMPOSE_LIMITS.question,
  limitTags: COMPOSE_LIMITS.tagCount,
}

Component<
  Data,
  {
    show: { type: BooleanConstructor; value: boolean }
    submitting: { type: BooleanConstructor; value: boolean }
    error: { type: StringConstructor; value: string }
  },
  {
    sync(): void
    onQuestionInput(e: WechatMiniprogram.CustomEvent<{ value: string }>): void
    onDetailInput(e: WechatMiniprogram.CustomEvent<{ value: string }>): void
    onTagInput(e: WechatMiniprogram.CustomEvent<{ value: string }>): void
    onRewardInput(e: WechatMiniprogram.CustomEvent<{ value: string }>): void
    onClose(): void
    onSubmit(): void
  },
  []
>({
  properties: {
    show: { type: Boolean, value: false },
    submitting: { type: Boolean, value: false },
    error: { type: String, value: '' },
  },

  data: { ...EMPTY },

  options: { addGlobalClass: true },

  observers: {
    /**
     * 每次打开都是一张空表。iOS 那边 sheet 关掉视图就销毁了，小程序的组件会一直在，
     * 不清的话上一条发过的悬赏会留在输入框里。
     */
    show(value: boolean) {
      if (value) this.setData({ ...EMPTY })
    },
  },

  methods: {
    /** 字数与标签数只在输入时重算一次，WXML 里数不了 */
    sync() {
      const question = this.data.question.trim()
      const tagCount = parseTags(this.data.tagText).length
      this.setData({
        questionCount: question.length,
        tagCount,
        overQuestion: question.length > COMPOSE_LIMITS.question,
        overTags: tagCount > COMPOSE_LIMITS.tagCount,
        questionValid: question.length > 0 && question.length <= COMPOSE_LIMITS.question,
      })
    },

    onQuestionInput(e) {
      this.setData({ question: e.detail.value }, () => this.sync())
    },

    onDetailInput(e) {
      this.setData({ detail: e.detail.value })
    },

    onTagInput(e) {
      this.setData({ tagText: e.detail.value }, () => this.sync())
    },

    onRewardInput(e) {
      this.setData({ reward: e.detail.value })
    },

    onClose() {
      this.triggerEvent('close')
    },

    onSubmit() {
      if (this.properties.submitting) return
      if (!this.data.questionValid || this.data.overTags) return
      this.triggerEvent('submit', {
        question: this.data.question,
        detail: this.data.detail,
        tagText: this.data.tagText,
        reward: this.data.reward,
      })
    },
  },
})
