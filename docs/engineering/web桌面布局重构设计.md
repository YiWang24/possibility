# Web 桌面布局重构设计

> 2026-07-31 · 状态：已确认方向，实施中
> 关联：PR #83（全局 shadcn Navbar）、PR #84（按 App Router 规范重建桌面布局）

## 1. 问题

1800×1100 实测（本地 dev，真实渲染）：

| 页面 | 容器令牌 | 内容宽 | 内容左边界 | 视口利用率 |
| --- | --- | --- | --- | --- |
| 顶部导航 | `max-w-[1280px]` | 1216 | x=292 | — |
| **/chat（核心体验）** | `measure` 768 | **768** | x=516 | **43%** |
| / 首页 | `app` 1184 | 1062 | x=369 | 59% |
| /lab | `app` 1184 | 1062 | x=369 | 59% |
| /community | `board` 1536 | 1414 | x=193 | 79% |

### 根因

这是 iOS 应用的逐屏移植，且移植只做了一半。代码里并存两套互不相容的布局系统：

- **系统 A**（PR #84 引入）：`PageContainer` + `PageGrid` + 三档宽度令牌。仅覆盖首页 / 实验室 / 社区 / 我的 4 个页面。
- **系统 B**（iOS 直译，PR #84 未触及）：`min-h-dvh` + `flex-1 overflow-y-auto` + 硬编码 `max-w-measure(768px)`。覆盖 chat、diary、studio、card-game、assessment、profile、bounty、traveler 共 9 个页面，**包含产品核心体验「AI 对话承接迷茫」**。

### 四个症状与根因的对应

1. **桌面空间浪费** —— 见上表，核心页仅用掉 43% 视口宽。
2. **信息层级分散** —— 桌面上存在 **4 条不同的内容左边界**（292 / 369 / 193 / 516）。没有任何两个页面共享中轴线，顶栏 logo 与其正下方页面内容错位 78px。这不是观感问题，是几何上缺少对齐系统。
3. **主视觉不突出** —— 签名视觉资产（PersonaStage 动态数字形象、OrbView、DialView、万花筒）在 iOS 上是全屏主角，web 上被压进卡片：首页数字形象位于折叠线以下，被压成约 1030×200 的扁条；/chat 首屏无任何视觉资产。
4. **内部滚动条** —— 8 个文件 13 处 `flex-1 overflow-y-auto` 配 `h-dvh`，是 iOS「固定头 + 滚动体 + 固定尾」原生范式的直译，在 web 上表现为页面里套页面。

## 2. 设计原则

**把 768px 拉宽到 1600px 只会让对话行宽变烂。真正的问题不是内容不够宽，而是横向空间里没有值得放的东西。**

这个产品恰好有一个天然该放在那里的东西——**动态画像**。它是被对话 / 日记 / 卡牌 / 测评持续喂养的活体资产，也是社区匹配的依据（见 README 核心价值链）。iOS 一次只能显示一屏，被迫把画像与对话拆开；桌面可以让画像常驻，使用户**边对话边看见自己的画像正在被改写**。

> 桌面横向空间用来同时呈现「你正在做的事」与「它在改变什么」。

这是 web 端相对 iOS 的独立价值，而不是把手机屏放大。

### 已确认的两个前提

- **外壳架构**：保留现有顶栏（PR #83/#84 刚做，完成度高、气质对），把顶栏与内容收敛到同一条中轴线；桌面新增常驻右轨承载动态画像。
- **与 iOS 的关系**：移动端断点继续与 iOS 保持一致；`lg` 以上的桌面档按 web 自身逻辑重排。共用组件与设计令牌，**只有布局分叉**。

## 3. 布局系统

### 3.1 令牌（单一真源）

```css
@theme {
  /* 全站唯一外框：navbar 与所有页面内容共用 —— 一条中轴线 */
  --container-shell: 96rem;   /* 1536px */
  /* 阅读行宽上限：用于主栏内部的正文段落，不再用作页面外框 */
  --container-measure: 44rem; /* 704px */
  /* 画像伴随轨 */
  --rail: 21rem;              /* 336px */
}
:root {
  --nav-h: 74px;              /* 顶栏高度的单一真源 */
}
```

`--nav-h` 取代当前散落在 15+ 处的硬编码 `74px` / `calc(100dvh-74px)`。

旧的三档令牌 `--container-app` / `--container-board` 删除；`--container-measure` 保留但语义收窄为「段落行宽」而非「页面宽度」。

### 3.2 尺寸推演

| 视口 | 外框 | gutter | 内容宽 | 轨 | 主栏 | 利用率 |
| --- | --- | --- | --- | --- | --- | --- |
| 1100 (lg) | 1100 | 37 | 1026 | 336 | 658 | 93% |
| 1440 (xl) | 1440 | 49 | 1342 | 336 | 966 | 93% |
| 1800 | 1536 | 56 | 1424 | 336 | 1048 | 79% |
| 2560 (2xl) | 1536 | 56 | 1424 | 336 | 1048 | 56%（有意封顶）|

核心页 /chat 从 43% → 79%，且新增的宽度承载的是画像而非留白。

### 3.3 组件

**`PageShell`** —— 替代 `PageContainer` + `PageGrid`，全站唯一的宽度与分栏出口。

```tsx
<PageShell
  header={<PageHeader eyebrow="…" title="…" />}  // 通栏，位于分栏之上
  rail={<PersonaRail highlight={["skill"]} />}    // 为空则退化单列
  railSide="end"                                  // "start" 用于「我的主页」名片轨
>
  {children}
</PageShell>
```

- 外层：`shell-gutter mx-auto w-full max-w-shell`
- header 跨满内容宽（不只主栏）——页面标题对齐外框中轴，是层级清晰的关键
- 轨：`lg:sticky lg:top-[calc(var(--nav-h)+2rem)] lg:self-start`

**`PersonaRail`** —— 新增，桌面画像伴随轨。

内容：紧凑数字形象 → 完成度条 → 六维紧凑列表（`highlight` 命中的维度高亮）→「补全画像 ›」。
`highlight` 由页面注入，用于表达「这次对话/推演点亮了哪些维度」。

**`PersonaStage`** —— 解耦。当前写死 `h-[216px]` 且带 `-mx-5 -mt-[22px]` 负边距，与父卡片的 `px-5 pt-[22px]` 强耦合，只能活在那一种卡片里。改为接收 `height` 与 `bleed` 参数；`PersonaCanvas` 的绘制坐标增加 `scale` 因子，使其能同时用于首页 hero（大尺寸）与轨内缩略（小尺寸）。

## 4. 滚动模型

**规则：页面永不产生内部滚动条；只有 modal / sheet 可以。**

| 位置 | 判定 | 处理 |
| --- | --- | --- |
| ChatView:117 | 页面 | 改文档流，输入栏 `sticky bottom-0` |
| AssessmentView:179/234/344 | 页面 | 改文档流 + sticky 底部操作栏 |
| GameView:327/380/461/599/685/791 | 页面 | 改文档流 + sticky 底部操作栏 |
| DimensionSheet / HistorySheet / SummaryPanel / PaywallView / BountyCompose / BountyDetail(sheet) / LoginSheet / ProfilePrivacyView / MeEditView / KaleidoscopeDraw | modal / 全屏浮层 | **保留** `overflow-y-auto` |

同时移除页面级 `h-dvh` / `min-h-dvh` + `md:h-[calc(100dvh-74px)]` 组合，交回文档流；`min-h` 仅在 AppShell 保留一处用于撑满短页面。

## 5. 页面重排

| 页面 | 主栏 | 轨 |
| --- | --- | --- |
| **/ 首页** | **画像 hero**（大尺寸数字形象 + 六维）—— 画像主场 | 今天三件事：日记 / 发问 / 卡牌 |
| **/chat** | 对话流（气泡上限 68ch）+ sticky 输入栏 | 画像轨 + 本次被点亮 |
| /lab | 时间旋钮 + 选择卡（现有双栏收进主栏） | 画像轨（推演依据） |
| /community | 卡片看板 3–4 列 | 匹配条件 + 抽一位旅人 |
| /me | tab 内容 | 名片（左轨，沿用现有） |
| /diary | 日历 + 条目流 | 画像轨（情绪维度） |
| /studio · /card-game · /assessment | 沉浸主栏 | 无轨 |

首页与其他页的分工：**首页是画像主场，其他页画像伴随**。

## 6. 实施顺序

**Phase 1 — 地基**（无视觉回归风险）
1. 令牌：`--container-shell` / `--rail` / `--nav-h`
2. AppShell：顶栏换用 shell 容器，与内容同轴；移除 `max-w-[1280px]`
3. 新增 `PageShell` + `PersonaRail`；`PersonaStage` 解耦

**Phase 2 — 消灭内部滚动条**
4. ChatView / AssessmentView / GameView / StudioView 改文档流 + sticky 底栏

**Phase 3 — 页面重排**
5. 首页画像 hero
6. chat / lab / community / diary 接入画像轨

**Phase 4 — 收尾**
7. 删除 `PageContainer` / `PageGrid`，全站统一到 `PageShell`
8. `pnpm typecheck` + 断点回归截图：390 / 768 / 1100 / 1440 / 1800 / 2560

## 7. 验收标准

- **应用页**（首页 / 实验室 / 社区 / 我的 / 对话 / 日记 / 画像工坊）在桌面上共用一条内容左边界，顶栏 logo 与页面内容对齐，误差 0
- **沉浸流程**（测评 / 卡牌）是另一种页面原型：任务列居中，页头与任务列同轴。
  它们刻意不上 shell 轴 —— 单任务专注屏用居中窄列是对的，把标题拉到左边缘反而会和居中的题目脱节。
  代价是这两类页面之间不共享中轴线，这是有意的取舍，不是漏改。
- 页面级内部滚动条数量为 **0**（modal 除外）
- /chat 在 1800px 下视口利用率 ≥ 75%
- 首页首屏包含动态数字形象
- 390px 移动端布局与改造前一致（与 iOS 对齐不回归）
- `pnpm typecheck` 通过
