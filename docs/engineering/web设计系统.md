# Possibility · Web 设计系统

> 适用范围：`web/`（Next.js 15 + React 19 + Tailwind v4 + shadcn/ui）
> 状态：v1 · 2026-07 · 单一真源：`web/app/globals.css`（token）+ `web/components/ui/`（基元）
> 护栏：`pnpm --filter @possibility/web run lint:tokens`（CI：`.github/workflows/web.yml`）

---

## 1. 为什么需要它

v1 之前的一次全量审计（71 个 tsx / 1.35 万行）：

| 问题 | 规模 |
|---|---|
| 任意值 class（`x-[..]`） | 1882 处；其中字号 672 处 / **36 种**（含 10 种 0.5px 半档） |
| 裸 hex 颜色 | 423 处；`#5E96FF` 写了 51 次而 `--color-brand` 就是它 |
| 任意圆角 | 148 处 / 22 种值（token 只有 3 档） |
| 手写主按钮 | `bg-btn-g` 在 24 个文件重复 33 次，py/字号/disabled 各不相同 |
| ad-hoc 蓝色标签 | 6 套并行样式；弹层底板 12 处手写、5 个 z-index |
| shadcn / cva / cn() | 脚手架配好但形同虚设：1 个 shadcn 组件、cva 0 处自用 |

结论不是「视觉方向错了」——深色极光的品牌语言与 iOS 端一致，是对的——而是**它从未被系统化执行**。本设计系统做三件事：把视觉决策收敛为 token；把交互模式收敛为组件；用 ratchet 护栏保证债务只降不升。

## 2. 设计方向

**延续「深色极光 / 万花筒」，不引入第三方视觉体系。**

- 纯 dark（`color-scheme: dark`），不做 light 模式；这是产品性格，不是欠账。
- 明度阶梯撑起层次：`stage → paper → card → raised`（越亮越靠近用户）。
- 极光渐变（`bg-aurora`）只用于品牌时刻：logo、主标题点睛、签名动画。界面交互色一律是单色 `brand` 蓝。
- 技术底座沿用已选型的 **Tailwind v4 CSS-first `@theme` + shadcn/ui（new-york）+ cva + cn()**，不换库。语义色已完整映射，此后 `npx shadcn add <component>` 拉下来即是万花筒皮肤。

## 3. Token 参考（`web/app/globals.css`）

### 3.1 颜色

| 类别 | Token | 用途 |
|---|---|---|
| 表面 | `stage / paper / card / raised` | 舞台底 → 页面底 → 卡片 → 抬升面 |
| 文字 | `ink / sub / faint` | 主文 → 次文 → 弱注记 |
| 描边 | `line`（白 8%） | 所有 1px 描边 |
| 品牌 | `brand / brand-deep / brand-bright / brand-lite` | 交互主色 / 渐变深端 / 渐变亮端·悬停描边 / tint 上的文字 |
| 点缀 | `violet-soft / pink / magenta / orange / apricot / teal / teal-lite / lime` | 分类与情绪点缀 |
| 状态 | `danger / success / warning` | = orange / teal / apricot，错误提示一律 `text-danger` |
| shadcn 语义 | `primary / secondary / muted / accent / destructive / border / input / ring …` | 供 shadcn 生成组件直接消费，业务代码优先用上面的具名 token |

tint 配方（Badge/Chip 类彩色标签）：背景 `<color>/13`、描边 `<color>/30`、文字用对应 `-lite` 或本色。不要再发明第 7 种透明度。

### 3.2 字阶（替代一切 `text-[..px]`）

| Token | 尺寸 | 用途 |
|---|---|---|
| `text-micro` | 10px | 徽标、计数、最小注记 |
| `text-caption` | 11px | 辅助说明、chip 文字 |
| `text-footnote` | 12px | 次要信息、标签 |
| `text-body` | 13px | **正文默认** |
| `text-callout` | 14px | 强调正文、输入框 |
| `text-lead` | 15px | 主按钮、导语 |
| `text-subtitle` | 16px | 小节标题 |
| `text-title` | 17px | 卡片标题 |
| `text-heading` | 20px | 区块大标题（非流体） |
| `text-section` | 15→19px 流体 | 分区标题（SectionHeader 内置） |
| `text-display` | 27→40px 流体 | 页面主标题（PageHeader 内置） |
| `text-eyebrow` | 11→12px 流体 | 全大写眉题 |

半档字号（10.5/11.5/12.5…）一律吸附到最近整档。需要改行高就叠 `leading-*`，会覆盖字阶默认值。

### 3.3 圆角（五档封顶）

`rounded-field`(12) 输入框小控件 · `rounded-tile`(16) 卡内小块面 · `rounded-card`(22) 标准卡片 · `rounded-sheet`(30) 弹层 · `rounded-chip`(999) 胶囊。

### 3.4 阴影 / 动效 / 层级

- `shadow-card` 卡片投影 · `shadow-pop` 弹层投影 · `shadow-glow` 品牌辉光（主 CTA 专用，唯一真源）。
- 标准过渡 200ms；强调入场用 `--ease-soft`；签名动画（光球/万花筒）不受此限。
- z 阶固定三层：navbar `z-50` < sheet `z-70` < toast `z-90`。不新增中间值。

### 3.5 布局

断点 `md 768 / lg 1100 / xl 1440 / 2xl 1760`；内容宽度三档 `max-w-measure / app / board` 走 `PageContainer`；留白用 `shell-gutter / shell-inset`。

## 4. 组件基元（`web/components/ui/`）

| 组件 | 替代的旧写法 | 关键 API |
|---|---|---|
| `Button` | `PrimaryButton` / `GhostButton` / 33 处手写 `bg-btn-g` | `variant: primary·tonal·ghost·plain` · `size: sm·md·lg` · `asChild`。无默认 `type`，form 里天然 submit |
| `Badge` | `TagPill` / 6 套 ad-hoc chip | `tone: brand·teal·violet·orange·neutral` · `size: sm·md` |
| `Chip` | `ChipToggle` / 手写 seg | `selected` · `onClick` · 内建 `aria-pressed` |
| `Card` | `kaleido-card` 之外 22 处手写卡片 | `elevation: flat·raised` · `radius: tile·card·sheet` |
| `Field / Input / Textarea` | 各表单手写输入行 | Field 承载外观（抬升底+聚焦描边），输入本体透明 |
| `SheetShell` | 12 处手写弹层底板 | `onClose`；移动贴底/桌面居中；固定 `z-70`。带复杂动画的弹层可自持结构，但必须遵守 z 阶与 token |
| `PageHeader / SectionHeader` | 原 `Basics.tsx`（已删除） | API 不变，从 `@/components/ui/page-header` 导入 |
| `useToast / ToastHost` | — | 全局提示，`z-90` |

用法示例：

```tsx
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

<Button size="lg" className="w-full" disabled={!canSubmit}>解锁完整经验</Button>
<Button variant="ghost" size="sm" onClick={onSkip}>先跳过</Button>
<Badge tone="teal" size="sm">已公开</Badge>
```

## 5. 贡献约定（护栏强制项加粗）

1. **新增代码禁止裸 hex**——颜色一律来自 token；LLM 动态输出的颜色过 `lib/theme.ts` 的 `cardAccent()` 吸附。
2. **禁止 `text-[..px]`**——字号只从字阶取。
3. **禁止 `rounded-[..]` / `shadow-[..]`**——五档圆角、三档阴影。
4. 间距走 Tailwind 4px 网格（`p-3.5` 而不是 `p-[13px]`）；确需破格写进组件而不是调用点。
5. 按钮/标签/胶囊/卡片/输入行/弹层先用基元；基元不够用就给基元加 variant，不在业务代码里另起炉灶。
6. 条件类名用 `cn()`（`@/lib/utils`），不再手拼模板字符串。
7. 按压反馈统一 `active:scale-[0.97]`（基元已内建）；焦点态交给基元的 `focus-visible` ring。
8. inline `style` 只允许表达真正的动态值（LLM 色、测量值、动画插值）；静态样式一律 class。
9. 新组件按 shadcn 惯例：小写文件名、`data-slot`、`className` 透传、cva 管变体。
10. z-index 只用 50/70/90 三层。

## 6. 工程化护栏（ratchet）

```bash
pnpm --filter @possibility/web run lint:tokens            # CI 同款校验
pnpm --filter @possibility/web run lint:tokens -- --update # 清理存量后收紧基线
```

`web/scripts/check-design-tokens.mjs` 按文件统计四类违规（hex / 字号 / 圆角 / 阴影），与提交在库的基线 `design-token-baseline.json` 对比：**每个文件只许减少、不许增加，新文件必须为零**。清理了存量就跑 `--update` 把水位锁低，基线变更随代码一起 review。

## 7. 迁移状态与后续路线

v1 已完成：token 层全量、组件基元、`Basics.tsx` 删除、全部 feature 的按钮/标签/字号/圆角机械迁移、auth 表单改造、CI 接入。

剩余债务（按价值排序，都有基线兜底）：

1. **`MeView` ↔ `ProfilePanels` 合并**——「我的档案」与「他人档案」1107 行并行实现（`StoryPanel/AdvicePanel/ServicePanel` 三对同名组件），应抽成共享 panel 库按 `isOwner` 分叉。
2. **弹层收编**——余下手写弹层逐步迁到 `SheetShell` 或统一动画方案（framer-motion 版可抽 `MotionSheet`）。
3. **`BackButton` 去重**——`chat/ChatChrome` 与 `card-game/ui` 的同形实现合入 `components/ui`。
4. **inline style 清理**——静态部分转 class；`withAlpha` 工具收敛到一处。
5. **间距网格化**——271 处非 4 倍数间距随日常改动顺手吸附，不专项推进。
