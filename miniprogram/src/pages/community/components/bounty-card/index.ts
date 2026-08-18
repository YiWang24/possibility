/**
 * 悬赏贴卡片 —— 对应 iOS `Features/Community/CommunityView.swift` 的 `BountyCard`。
 *
 * 金额（`amount`）与征集目标（`rewardGoal`）都由 `model.ts` 过 `bountyDisplayAmount` /
 * `bountyRewardGoal` 算好 —— WXML 里调不了函数，而这两条规则四端必须一致。
 *
 * 标签胶囊没用共享的 `tag-pill`：悬赏这一族比旅人标签更蓝更小（iOS 是另一个
 * `BountyTagPill`），共用一个组件反而要加 variant 分支。
 */
Component<
  Record<string, never>,
  {
    question: { type: StringConstructor; value: string }
    tags: { type: ArrayConstructor; value: string[] }
    /** 旧数据里的「征集 3 个真实故事」；空串则整行不渲染 */
    rewardGoal: { type: StringConstructor; value: string }
    amount: { type: StringConstructor; value: string }
    responses: { type: StringConstructor; value: string }
  },
  { onTap(): void },
  []
>({
  properties: {
    question: { type: String, value: '' },
    tags: { type: Array, value: [] },
    rewardGoal: { type: String, value: '' },
    amount: { type: String, value: '' },
    responses: { type: String, value: '' },
  },

  options: { addGlobalClass: true },

  methods: {
    onTap() {
      this.triggerEvent('tap')
    },
  },
})
