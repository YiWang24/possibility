# flash-app 画像六入口完善设计

日期：2026-08-06
范围：`flash-app/` 首页「我的动态画像」六个维度按钮 + 画像工作室对应卡片

## 背景

首页「我的动态画像」下方有六个维度按钮：人格底色 / 我擅长 / 我喜欢 / 我在恋爱关系中在意 /
我在家庭关系中在意 / 我在人际交往中在意。画像工作室（`profileStudio` push）里是同一组六项：
「人格底色」大卡 + 「生活画像」五张卡。

目前这六个入口基本是死的：

| 入口 | 首页点击 | 工作室点击 |
|---|---|---|
| 人格底色 | 只跳工作室 | toast「大五人格为简化 Demo」 |
| 我擅长 | 只跳工作室 | toast「关键词面板在认识自己页」 |
| 我喜欢 | 只跳工作室 | 霍兰德 30 题（结果不写回维度） |
| 我在恋爱关系中在意 | 只跳工作室 | toast |
| 我在家庭关系中在意 | 只跳工作室 | toast |
| 我在人际交往中在意 | 只跳工作室 | toast |

iOS 原型（`ios/Possibility/`）里这六项是完整的：

- 人格底色 → `AssessmentFlowView(.bigfive)`，120 题，intro → 逐题 → 结果页（五维条 + 30 个细分面向前六）→ 写入画像
- 其余五项 → `DimensionSheet(key)`，三批关键词「换一批」+ 自定义词 + 工具区（测评 / 卡牌）→ 保存
- 六项的值统一进 `HomeModel.filledDims`，驱动首页维度文案与完成度百分比

## 资产盘点

题库、关键词与样式在 flash-app 已经全部就位，缺的只有组件层。

已有：

- `src/data/demoAssessments.ts` — 大五 120 题 / 优势证据探索 15 题 / 关系安全感 18 题 / 家庭关系 20 题
- `src/data/bigFive.ts` + `bigFiveA.ts` + `bigFiveB.ts` — 30 个 facet，每 facet 4 题
- `src/data/holland.ts` — 霍兰德 30 题 + RIASEC 六型元数据
- `src/screens/me/hollandScoring.ts` — 霍兰德计分与并列组展开
- `src/data/dimensions.ts` — 五个软维度 × 3 批 × 5 关键词 + 工具列表
- `src/data/cardgames.ts` + `CardGameHubPush` + `DeckView` — 婚姻 / 家庭 / 人际三副卡牌
- `src/styles/prototype.css` — `.sheet` `.batch-btn` `.custom-tag-panel` `.tests` `.likert-list`
  `.spectrum-likert` `.assessment-foot` `.result-hero` `.riasec-bars` `.result-insight`
  `.facet-summary` `.facet-list` `.result-tags` `.result-save` `.assessment-card .resume` 全部已移植
- `src/store/appStore.ts` — `assessmentPage` / `assessmentResultPage` / `cardGameHub` 三个 push id 已声明

缺失：通用测评引擎、维度浮层、四个测评的答题壳、结果页、画像状态、续答持久化。

## 设计

### 1. 入口路由

首页六个按钮与工作室六张卡走同一套路由（对齐 iOS `HomeView.handleDimTap`）：

- `personality`（人格底色）→ 打开大五答题页
- `skill` / `like` / `love` / `family` / `social` → 打开维度浮层（底部 `.sheet`）

维度浮层由 `appStore` 持有开关状态，`App.tsx` 单点挂载，首页与工作室都能触发。

### 2. 六种测评统一为一个 config 形状

```
AssessmentKind = 'bigfive' | 'bigfiveLite' | 'strength' | 'love' | 'family' | 'holland'
```

`assessmentConfig.ts` 把 `DEMO_ASSESSMENTS`（四种）与 `holland.ts`（一种）归一成同一个
`AssessmentConfig`，并派生第六种 `bigfiveLite`。霍兰德的题目从 `HollandItem` 元组转成
`{ d, t }`，维度元数据从 `HOLLAND_META` 转成 `AssessmentDimMeta`。

### 3. 大五 30 题短版

落点是**大五 intro 页上的版本切换**，而不是新增卡片或按钮。理由：首页与工作室两个入口
自动都能用，不需要改两处 UI；用户正在读须知时切换最自然。

- 短版取每个 facet 的第 1 题（`facet.items[0]`）→ 30 题，每维 6 题
- 短版**只输出五维分数，不输出 30 facet 网格**。1 题/facet 的分辨率只有 0/25/50/75/100，
  渲染 facet 是假精度。结果页注明「快速版给五维概览，完整版可看 30 个细分面向」
- 两版进度独立存储，互不覆盖
- 工作室卡片状态优先展示完整版；只完成短版时展示短版结果并保留完整版入口

### 4. 计分引擎

`assessmentEngine.ts` 全部是纯函数，照搬 iOS `AssessmentModel` 的结算逻辑：

- `computeDemoResult(config, answers)` — 反向题按 `4 - v` 折算，维度分 = 维度总分 / (题数 × 4)
  取百分比四舍五入；facet 分同法；`ordered` 按分数降序、同分按 config 维度顺序稳定排序
- `computeHollandResult` — 复用现有 `hollandScoring.ts`（总分 0–20，按分数层级展开并列组直到 ≥3）
- `resultTags(kind, result)` — 大五按 58 分阈值取高/低端标签；恋爱按 anxiety / avoidance
  两维分支；霍兰德取 selected 的 label；其余取 top3 label
- `resultNarrative(kind, result)` — 霍兰德双字母叙事表 + 六类接近的兜底；恋爱四象限分支；
  其余用 top2 的 label 与 desc 组句

大五低分端标签表（`务实聚焦 / 灵活随性 / 安静蓄能 / 独立判断 / 情绪稳定`）需要新增，
iOS 在 `AssessmentData.bigfiveLowLabels`，flash-app 的 `demoAssessments.ts` 尚未移植。

### 5. 状态与持久化

`assessmentStore.ts`（zustand）持有每种测评的 `{ phase, index, answers, result }`，
选择即写 localStorage，可退出续答。对外暴露 `snapshot(kind)` 供卡片回显，避免为了显示
一行文案而实例化整个引擎。

`portraitStore.ts` 持有六维文本值 `filledDims`，对齐 iOS `HomeModel.filledDims`，
暴露 `completionPct`。首页维度文案、完成度进度条、工作室卡片状态都订阅它。

存储键与 iOS 对齐，便于将来对数据：

| 键 | 内容 |
|---|---|
| `kaleido_demo_assessment_bigfive_v2` | 大五完整版 |
| `kaleido_demo_assessment_bigfive_lite_v1` | 大五短版（新增） |
| `kaleido_demo_assessment_strength_v1` | 优势证据探索 |
| `kaleido_demo_assessment_love_v1` | 关系安全感 |
| `kaleido_demo_assessment_family_v1` | 家庭关系 |
| `kaleido_assessment_holland_v1` | 霍兰德 |
| `kaleido_portrait_dims_v1` | 六维文本值（新增） |

所有读取走 `safeStoreGet` + schema 归一化：`answers` 长度与题数不符则整条丢弃重来，
数组用 `Array.isArray` 兜底，数值用 `typeof === 'number'` 兜底。单条脏数据不能让页面崩。

### 6. 通用答题页

`AssessmentPush.tsx` 把现在写死霍兰德的 `HollandQuiz` 泛化：

- 顶栏：返回（退出前 persist，答题中提示「进度已保留，下次可以继续」）+ 标题 + 副标题 + 进度条
- intro：kicker / 标题 / 说明 / 须知列表；大五额外渲染版本切换
- questions：题面 + 5 点 likert（`.likert-list`）+ 「选择后自动保存」/「✓ 已保存在当前设备」
- foot：intro 是「以后再说 / 开始测评（或继续 n/total）」；答题是「上一题 / 下一题（末题为生成结果）」
- 末题校验：有未答题则跳到该题并 toast「还有一道题没有回答」

霍兰德改为调用它，`HollandQuiz.tsx` 删除，`hollandScoring.ts` 保留供引擎复用。

### 7. 结果页

`AssessmentResultPush.tsx`：

- 通用：`.result-hero`（overline + 标题 + 叙事）+ 维度条（霍兰德用 `x/20`，其余用百分比）
  + `.result-insight`（tags 与 desc）+ `.result-tags` + `.method-note` + 「保存到画像」
- 大五完整版额外渲染 `.facet-summary`，取 30 个 facet 里分数最高的 6 个
- 大五短版渲染同样结构但省略 facet 区，并加一句短版说明
- 保存动作：大五写入 `personality`（`大五：{top3 tags}`，有 MBTI 时追加 `· MBTI：{type}`）；
  其余写入 `targetDimension` 对应的维度

### 8. 维度浮层

`DimensionSheet.tsx`，五个软维度通用：

- 标题 + `01 {question}` + 「换一批 ↻」
- 关键词 chips：展示序为「已选但不在当前批」+ 当前批 + 自定义，去重；自定义词走绿色 `.custom` 态
- 来源图例（系统推荐 / 我添加的）
- `＋ 自己输入一个关键词` 展开输入框，重复词直接忽略
- `02 或者，用小工具继续探索` + 工具卡（`.tests`）：测评类打开答题页，卡牌类打开卡牌 hub
- 「保存到我的画像」取前 5 个词，空选时禁用

### 9. 卡片三态回显

对齐 iOS `ProfileStudioView.gridState`：

| 状态 | 文案 | 按钮 |
|---|---|---|
| 已填画像 | `已形成画像 · {值}` | 编辑 |
| 有进度无结果 | `已完成 n/total · 进度自动保存` + 进度条 | 继续 |
| 有结果未写入 | `测评已完成 · 可写入画像` | 进入 |
| 霍兰德有结果 | `已完成 · {displayCode} 兴趣组合` | 查看画像 |
| 空 | 原 fallback 文案 | 进入 |

大五主卡的状态按「完整版优先」判定，只看一版：

| 完整版 | 短版 | 文案 | 按钮 |
|---|---|---|---|
| 有结果 | 任意 | `已完成 · {完整版 top2 tags}` | 查看结果 |
| 有进度 | 任意 | `已完成 n/120 · 进度自动保存` | `继续 n/120` |
| 空 | 有结果 | `快速版已完成 · {短版 top2 tags} · 可继续完整版` | 查看结果 |
| 空 | 有进度 | `快速版已完成 n/30 · 进度自动保存` | `继续 n/30` |
| 空 | 空 | 原文案 | 进入测试 |

「查看结果」与「继续」都进同一个答题页，由页面按上表选中的版本决定初始 tab 与落点；
两种情况下 intro 页的版本切换仍然可用，用户可随时切到另一版从头或从断点开始。

### 10. 卡牌联动

恋爱 / 家庭 / 人际浮层里的卡牌工具卡关闭浮层并 `openPush('cardGameHub', { deck, writeBackDim })`。
`PushPayload` 新增 `deck?: DeckKind` 与 `writeBackDim?: DimensionKey`；`CardGameHubPush` 带 deck
时直接进入该牌组而非选择页。`DeckView` 新增可选 prop `onSaveToProfile?: (names: string[]) => void`，
提供时在结果阶段渲染「写入「{维度标题}」」按钮，把留下的三张底牌名写回维度。该 prop 可选，
现有 hub 用法不受影响。

## 文件清单

新增 `flash-app/src/screens/studio/`：

| 文件 | 职责 | 预估行数 |
|---|---|---|
| `assessmentConfig.ts` | 六种测评统一 config + 大五短版派生 | ~110 |
| `assessmentEngine.ts` | 纯函数计分 + tags + narrative | ~150 |
| `assessmentStore.ts` | 答题状态 + 续答持久化 + snapshot | ~120 |
| `portraitStore.ts` | 六维值 + 完成度 + 持久化 | ~90 |
| `AssessmentPush.tsx` | 通用答题页 | ~190 |
| `AssessmentResultView.tsx` | 结果页 | ~150 |
| `DimensionSheet.tsx` | 维度浮层 | ~200 |
| `studioCardState.ts` | 卡片三态文案（纯函数） | ~95 |

修改：

- `src/store/appStore.ts` — `PushPayload` 加 `assessmentKind` / `deck` / `writeBackDim`；
  新增 `dimensionSheet` 状态与开关 action
- `src/App.tsx` — 挂载 `AssessmentPush` / `AssessmentResultPush` / `DimensionSheet`
- `src/screens/push/ProfileStudioPush.tsx` — 六张卡接线 + 三态回显，移除 toast 占位
- `src/screens/home/PersonaPortrait.tsx` — 六按钮路由 + 真实维度值 + 完成度进度条
- `src/screens/push/CardGameHubPush.tsx` — 支持 deck payload 直达与写回
- `src/screens/home/cards/DeckView.tsx` — 新增可选 `onSaveToProfile`
- `src/data/demoAssessments.ts` — 补 `BIGFIVE_LOW_LABELS`

删除：

- `src/screens/me/HollandQuiz.tsx` — 并入 `AssessmentPush`

`src/screens/me/hollandScoring.ts` 保留，被 `assessmentEngine` 复用。

## 约束

- 单组件文件不超过 300 行（`flash-app/CLAUDE.md`）
- 跨目录导入用 `@/` 别名
- 所有交互控件带唯一 `data-testid`
- 禁止 `alert()` / `confirm()`，提示统一走 `showToast`
- localStorage 读取必须先归一化再渲染
- 交付前 `npm run check` 必须通过

## 验收

1. 首页六个维度按钮全部可点进对应页面，无一落到 toast 占位
2. 六种测评（含大五短版）都能走完 intro → 答题 → 结果 → 写入画像
3. 中途退出后重进，进度从断点恢复，卡片显示 `已完成 n/total`
4. 保存后首页维度文案与完成度百分比立即更新
5. 恋爱 / 家庭 / 人际浮层的卡牌工具能打开对应牌组并把三张底牌写回维度
6. 清空 localStorage 或写入畸形数据后，页面不崩，回落到未填状态
7. `npm run check` 通过

## 实现说明（与上文设计的差异）

**结果页是组件不是 push。** 原计划做成独立的 `assessmentResultPage` push，实际把结果做成
答题页的 `result` 阶段（`AssessmentResultView.tsx`），与被它取代的 `HollandQuiz` 一致 ——
`.result-*` 样式本来就渲染在 `.assessment-body` 里，拆成两个 push 反而要复制一遍顶栏与
进度条。拆成两个文件仍然让各自都在 300 行以内。`appStore` 里 `assessmentResultPage`
这个 push id 从改动前就没有使用者，本次未动它。

**`dimensions.ts` 的 `tests` 重构成了 `tools`。** 原来是 `[标题, 描述, 时长, 颜色]` 四元组，
没有字段能区分「点进去是测评」还是「点进去是卡牌」。改成带显式 `action` 的对象。
该类型改动前无任何消费方（只有声明），顺带删掉了同样无人使用的 `target` / `button` /
`selected` —— 其中 `selected: []` 是挂在模块级常量上的可变数组，留着迟早被误改成共享状态。

**层级与安全区。** 原型里维度浮层只从首页唤起，`.sheet` 的 z-index 60 够用；这次它也从
画像工作室（z-index 74）唤起，不抬高会被整页盖住。在 `app-shell.css` 里把
backdrop/sheet 抬到 78/80、测评页与卡牌页抬到 84，并给浮层补了底部安全区内边距。

**验证中发现并修掉的三个问题**（详见提交）：

1. 从维度浮层进测评、保存结果后浮层仍开着，其草稿还停留在打开那一刻；用户接着按浮层的
   「保存到我的画像」会用旧草稿覆盖刚写入的测评结果。改为保存时一并关闭浮层（iOS 同此）。
2. 关键词上限不一致：浮层手动保存截前 5 个，测评结果不截 —— 霍兰德六维并列时会写进
   6 个词。上限收敛到 `MAX_DIMENSION_KEYWORDS`，两条路径共用。
3. 浮层的保存按钮在未选词时是 `disabled`，但 `.result-save` 没有 disabled 样式，看上去
   仍可点。补了 `opacity: .32`，与 `.assessment-foot` / `.context-save` 的处理一致。
