# Possibility · 文档索引

所有不进产物的资料只此一处，按**功能模块**分目录。写新文档前先对照下表选目录，别再往 `docs/` 根上堆。

| 目录 | 放什么 |
|---|---|
| `product/` | 产品定义：需求、PRD、对外叙事 |
| `engineering/` | 跨模块的工程架构与契约：技术设计、后端拆解、排期、埋点、部署片段 |
| `features/` | 单个功能模块的设计稿：一份文档只讲一个功能 |
| `design/` | 设计资产：原型、设计稿、图标、上架截图、图片母版 |
| `marketing/` | 对外物料：海报、扑克牌等可出图的宣传件 |
| `demo-video/` | 产品 demo 视频的 Remotion 工程（唯一的可运行工程，不是文档） |

---

## product/ · 产品

| 文档 | 讲什么 |
|---|---|
| [产品同步0723.md](product/产品同步0723.md) | 产品 PRD：目标用户、价值链、付费漏斗主线的完整需求 |

> `product/funding/` 为融资与申请材料，仅本地保存（走 `.git/info/exclude`），不入库。

## engineering/ · 工程

| 文档 | 讲什么 | 状态 |
|---|---|---|
| [技术设计文档.md](engineering/技术设计文档.md) | 总体技术设计：数据模型、RLS、Edge Function 契约、导航策略 | v0.1（黑客松）· 待评审 |
| [后端开发架构.md](engineering/后端开发架构.md) | 后端 17 个模块的拆解与开发依赖图（哪些并行/串行） | — |
| [并行开发方案.md](engineering/并行开发方案.md) | 前后端接线的三波次并行开发派发方案 | 2026-07-25 |
| [埋点方案.md](engineering/埋点方案.md) | 三层埋点架构与事件清单。**唯一事实来源**，Swift / TS 两侧镜像必须跟随本文件改动 | 生效中 |
| [diary-worker-cron.sql.example](engineering/diary-worker-cron.sql.example) | diary-worker 定时任务的 Vault + pg_cron 部署片段 | 模板 |

## features/ · 功能模块设计

| 文档 | 讲什么 | 状态 |
|---|---|---|
| [个人档案与AI使用设计.md](features/个人档案与AI使用设计.md) | `profile_facts` 最终数据结构与 AI 读写方式（画像唯一真相源） | 已实现，待部署 |
| [AI记忆与检索系统完整设计.md](features/AI记忆与检索系统完整设计.md) | 跨对话经历记忆与向量检索路线图 | 事实层已实现，检索层未实现 |
| [语音日记真实数据与AI总结设计.md](features/语音日记真实数据与AI总结设计.md) | 语音日记的异步流水线：录音 → 转写 → 条目分析 → 日/月/年总结 | 设计稿 |

## design/ · 设计资产

| 目录 | 放什么 |
|---|---|
| [prototype/](design/prototype/) | 高保真原型 HTML（`seed.sql` 的数据来源） |
| [screens/](design/screens/) | 各界面设计稿 |
| [app-icon-iterations/](design/app-icon-iterations/) | App 图标迭代 |
| [appstore/](design/appstore/) | App Store 上架截图 |
| [assets/](design/assets/) | 共享图片母版（社区头像 · 数字人），由 `scripts/sync-assets.sh` 分发到 iOS / web |

## marketing/ · 宣传物料

| 目录 | 放什么 |
|---|---|
| [posters/](marketing/posters/) | 宣传海报套件：5 张成品 + HTML 源 + `render.sh` 出图 |
| [possibility-poker/](marketing/possibility-poker/) | 人生决策扑克牌（HTML 模板 + 出图提示词） |

> `marketing/domains/` 为域名候选调研，暂未入库。

## demo-video/ · 产品 Demo 视频

| 内容 | 讲什么 |
|---|---|
| [README.md](demo-video/README.md) | Remotion 工程：一份剪辑表 (`src/kaleido/script.ts`) 驱动横屏 / 竖屏长版 / 竖屏短版三个成片 |

独立的 npm 工程（不在 pnpm workspace 里），要在 `docs/demo-video/` 内 `npm i` 后使用。
原始录屏与切片素材约 50MB 派生媒体，不入库——新克隆后先跑 `npm run clips` 重建。
