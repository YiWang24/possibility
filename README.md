<div align="center">

# Possibility

**AI 决策陪伴 · 青年人生 OS**

面向 22–30 岁职业与身份转换期年轻人的 AI 决策陪伴产品。  
用 AI 对话承接迷茫，在决策最痛的急性时刻用精准真人经验匹配推动现实行动。

[![CI](https://github.com/YiWang24/adx/actions/workflows/ci.yml/badge.svg)](https://github.com/YiWang24/adx/actions/workflows/ci.yml)
[![Platform](https://img.shields.io/badge/platform-iOS%2017+-blue.svg)](https://developer.apple.com/ios/)
[![Backend](https://img.shields.io/badge/backend-Supabase%20Edge%20Functions-3ECF8E.svg)](https://supabase.com)
[![LLM](https://img.shields.io/badge/LLM-Anthropic%20Claude-CC785C.svg)](https://anthropic.com)
[![License](https://img.shields.io/badge/license-MIT-green.svg)](LICENSE)

[产品理念](#-产品理念) · [系统架构](#-系统架构) · [技术栈](#-技术栈) · [快速开始](#-快速开始) · [项目结构](#-项目结构) · [开发指南](#-开发指南) · [部署](#-部署)

</div>

---

## 💡 产品理念

### 我们解决什么问题

> 用户真正缺少的不是更多建议或更多内容，而是两件事的组合：**在迷茫时被承接、被初步判断**，以及**在决策时看到与自己此刻处境高度相关的他人经验**。

ChatGPT 能承接迷茫却给不出真人经验；小红书/知乎有真人经验却承接不了迷茫、也不精准。万花筒把两者串成一条漏斗——AI 对话承接前者，经验匹配负责后者，在急性时刻用一次性买断变现。

### 核心价值链

```
迷茫进入（急性、尚未成形的纠结）
  → AI 对话承接：缓解焦虑 + 采集背景 + 给出初步判断
  → 困惑被逐步澄清成一个具体的岔路口
  → 系统形成可反驳的当前状态理解与匹配条件
  → 【付费墙 · 单次买断 ¥9.9】解锁 3 条相关但结局不同的真实经验
  → 用户获得校准并选择一个低成本现实行动
  → 行动反馈更新动态自我理解
```

### 独特站位

- **相对 ChatGPT**：我们不止给泛化建议——我们匹配真实亲历者的结构化经验，说清"为什么推荐给你"以及"哪类人不应照搬"。
- **相对内容平台**：我们不靠关键词搜索——AI 先理解你的状态（人生节点 · 现实约束 · 核心张力 · 决策阶段 · 支持需求），再做精准匹配。
- **相对职业咨询**：我们立场中立——不替用户做决定，不为某个下游服务背书，甚至可能帮你得出"你现在还不需要做这件事"。
- **相对心理咨询**：我们没有临床责任——更像一次 coffee chat，平等交换经历，不诊断、不治疗。

### 为什么是单次买断

岔路口是低频、高痛、一次性的需求。用户愿意在最痛的点一次性买"方向感"，但一个几年才用一次的能力很难支撑持续订阅。买断制对上了需求的时间形状。

---

## 🏗 系统架构

```
┌────────────────────────── iOS App (SwiftUI · iOS 17+) ──────────────────────────┐
│  Features: Home / Chat / Lab / Community / CardGame / Studio / Me                │
│  DesignSystem: OrbView · KaleidoscopeView · DialView · WaveformView             │
│  Network: SupabaseService (supabase-swift) · ChatStreamClient (SSE)              │
└───────────┬────────────────────────────────────────┬───────────────────────────┘
            │ supabase-swift (Auth/DB/Storage)        │ URLSession SSE (JWT)
            ▼                                         ▼
┌──────────────────────────── Supabase ──────────────────────────────────────────┐
│  Auth (匿名)       Postgres + RLS       Storage (音频)      Edge Functions (TS) │
│                    10 migrations                             12 functions        │
│                                                              │ ANTHROPIC_KEY    │
│                                                              ▼                  │
│                                                   Anthropic Claude API          │
│                                                   (Opus / Sonnet / Haiku)       │
└────────────────────────────────────────────────────────────────────────────────┘
```

### 端到端数据流（付费漏斗主线）

```
App 匿名登录 → auth.uid() + JWT
    ↓
首页发问 → POST /chat (流式 SSE)
    ↓ 打字机效果 + 并行 Haiku 抽取画像/岔路口信号
岔路口成形 (crossroads.ready == true)
    ↓
前端呈现「看看走过这条路的人」→ 万花筒抽人动画
    ↓
POST /match → Claude 结构化输出 → 3 位结局不同旅人 + 匹配理由
    ↓
旅人主页 → 付费墙 ¥9.9 → mock 解锁 → 完整经验 + 现实行动
```

---

## 🔧 技术栈

| 层 | 选型 | 说明 |
|---|---|---|
| **前端** | Swift + SwiftUI (iOS 17+, `@Observable`) | 原生签名动画（光球/万花筒/转盘/波形）|
| **客户端 SDK** | supabase-swift | Auth / Postgres / Storage |
| **流式聊天** | URLSession `bytes(for:)` SSE | 绕过 `functions.invoke` 缓冲，实现打字机 |
| **后端 BaaS** | Supabase (Postgres + Auth + Storage + Edge Functions) | 一站式后端，匿名登录 |
| **Edge Functions** | TypeScript (Deno) | 12 个函数，全部 `verify_jwt` |
| **LLM** | Anthropic Claude (Opus 4.8 / Sonnet 5 / Haiku 4.5) | 对话/匹配/推演/日记分析 |
| **结构化输出** | Claude `output_config.format` + JSON Schema | 7 套契约严格约束输出 |
| **数据库** | Postgres 17 + RLS | 10 个 migration，行级安全 |
| **CI/CD** | GitHub Actions | 格式/lint/类型/单测/RLS 全链路 |

---

## ✨ 功能模块

### 认识自己 (Home)

- AI 对话前门：承接迷茫 → 初步判断 → 澄清岔路口
- 动态画像：对话中自然沉淀，无需填表
- 语音日记：录音 → 转写 → 情绪分析 → 画像更新
- 周历/月报：日记聚合 + LLM 洞察

### 人生实验室 (Lab)

- 转盘选年限（1–10 年）+ 选择卡拖入
- AI 推演三种未来：一般 / 乐观 / 警示
- 底线分析 + 推荐相似经历旅人

### 万花筒社区 (Community)

- 万花筒抽取动画（六瓣折光旋转）
- 悬赏问答：发布 / 回应 / 详情
- 围观模式

### 卡牌游戏 (CardGame)

- 自我探索游戏化
- 结果持久化到云端

### 画像工作室 (Studio)

- 多维测评
- 上下文扫描
- 评估结果可视化

### 我的主页 (Me)

- 公开主页编辑
- 云端同步

---

## 🚀 快速开始

### 前置依赖

- [Node.js](https://nodejs.org/) ≥ 18
- [Deno](https://deno.land/) ≥ 1.40
- [Supabase CLI](https://supabase.com/docs/guides/cli) ≥ 2.109
- [Docker](https://docker.com/)（本地数据库）
- Xcode 15+（iOS 构建，macOS）

### 后端本地开发

```bash
# 1. 安装依赖
npm install

# 2. 启动本地 Supabase（Postgres + Auth + Storage + Functions）
npm run db:start

# 3. 重建数据库（应用 migration + seed）
npm run db:reset

# 4. 配置 Anthropic Key
cp supabase/functions/.env.example supabase/.env.local
# 编辑 supabase/.env.local，填入 ANTHROPIC_API_KEY

# 5. 启动函数服务
npx supabase functions serve --env-file supabase/.env.local

# 6. 运行全量检查
npm test
```

### iOS 前端

```bash
# 前端已配置线上 Supabase 回落，拉取即可直连云端
open ios/Possibility.xcodeproj
# Xcode → 选择 iOS 17+ 模拟器或真机 → Build & Run
```

如需连本地 Supabase：

1. 复制 `ios/Config/Config.xcconfig.example` → `ios/Config/Config.xcconfig`
2. 填入本地 `SUPABASE_URL` 和 `SUPABASE_ANON_KEY`
3. `cd ios && xcodegen generate`（`Config/Base.xcconfig` 已自动引入，无需手点 Build Settings）

> ⚠️ `ANTHROPIC_API_KEY` **绝不进 App / 仓库**，只存 Supabase Function Secrets。

---

## 📁 项目结构

顶层按「交付物」切分：`ios/` `android/` `web/` `flash-app/` 四个可独立构建的前端，`supabase/` 一个后端，
`packages/` TS 共享层，`scripts/` 工具脚本。环境变量统一由 **Doppler**（项目 `possibility`，dev/stg/prd 三环境）管理。
**所有不进产物的资料（文档 / 设计稿 / 原型 / 宣传物料）统一收在 `docs/` 一个目录下。**

```
possibility/
├── ios/                         # iOS App (SwiftUI) —— 标准 Xcode 布局
│   ├── Possibility.xcodeproj/   # 由 project.yml 生成，勿手改工程设置
│   ├── Possibility/             # ← app target 源码根（与 target 同名）
│   │   ├── App/                 # 入口 · 配置 · 导航路由
│   │   │   ├── PossibilityApp.swift  # @main，暗色主题，四 Tab
│   │   │   ├── AppConfig.swift       # URL/Key/价格/阈值配置
│   │   │   └── Navigation.swift      # 全局路由 · 旅人主页 cover
│   │   ├── Core/
│   │   │   ├── DesignSystem/    # Theme · 组件 · 四个签名动画
│   │   │   ├── Models/          # 数据模型 · DemoData（断网兜底）
│   │   │   ├── Network/         # SupabaseService · ChatStreamClient
│   │   │   └── Utilities/       # AsyncTimeout · SupabaseTimestamp
│   │   ├── Features/
│   │   │   ├── Home/            # 认识自己（画像 · 日记 · AI 提问）
│   │   │   ├── Chat/            # 探索对话（流式 SSE）
│   │   │   ├── Lab/             # 人生实验室（转盘 · 推演）
│   │   │   ├── Community/       # 万花筒社区（抽取 · 悬赏 · 围观）
│   │   │   ├── CardGame/        # 卡牌游戏
│   │   │   ├── Studio/          # 画像工作室（测评 · 上下文扫描）
│   │   │   ├── Me/              # 我的主页
│   │   │   ├── Diary/           # 语音日记
│   │   │   ├── Auth/            # 手机验证码 · Apple 登录
│   │   │   └── Profile/         # 旅人主页 · 付费墙
│   │   ├── Resources/           # Assets.xcassets · Info.plist
│   │   └── Possibility.entitlements
│   ├── PossibilityTests/        # 单测（Swift Testing）
│   ├── PossibilityUITests/      # UI 测试 · App Store 截图
│   ├── Config/                  # Base.xcconfig（入库）· Config.xcconfig.example
│   └── project.yml              # xcodegen 工程定义（唯一事实来源）
│
├── supabase/                    # 后端 (Supabase)
│   ├── migrations/              # 10 个 SQL migration
│   │   ├── 0001_schema.sql      # 核心建表
│   │   ├── 0002_rls.sql         # 行级安全策略
│   │   ├── 0003_storage.sql     # 对象存储桶策略
│   │   ├── 0004_hardening.sql   # 安全加固
│   │   └── ...                  # 后续功能迭代
│   ├── functions/
│   │   ├── _shared/             # 公共层（Anthropic/Auth/Validate/SSE/DB）
│   │   ├── chat/                # 流式对话 + 画像/岔路口信号
│   │   ├── match/               # 3 位旅人经验匹配
│   │   ├── simulate/            # 三种未来情景推演
│   │   ├── analyze-diary/       # 日记情绪/关键词分析
│   │   ├── diary-summary/       # 月/年度日记洞察
│   │   ├── lab-choices/         # 实验室选择卡生成
│   │   ├── persona/             # 动态数字形象
│   │   ├── community/           # 万花筒/悬赏/旅人
│   │   ├── save-profile/        # 画像写入
│   │   ├── get-profile/         # 画像读取
│   │   ├── list-conversations/  # 会话历史
│   │   └── list-diary/          # 日记列表
│   ├── tests/                   # RLS 集成测试
│   ├── seed.sql                 # 种子数据（12 位旅人）
│   └── config.toml              # 项目配置
│
├── web/                         # 灵光赛道演示站（纯静态 mock，规划重建为完整 Next.js 产品应用）
│
├── flash-app/                   # 灵光 App（Vite + React，独立工程链，自带 CLAUDE.md）
│
├── android/                     # Android App（Kotlin + Jetpack Compose + supabase-kt）
│   ├── app/                     # 应用模块，BuildConfig 读 Doppler 注入的 Supabase 配置
│   └── gradle/libs.versions.toml
│
├── packages/                    # TS 共享层（pnpm workspace；flash-app 独立不引用）
│   ├── shared-types/            # supabase gen types 产物 + Edge Function 名称契约
│   └── api-client/              # Supabase 客户端 + Edge Function 调用封装
│
├── docs/                        # ← 所有不进产物的资料，只此一处
│   ├── 产品同步0723.md           # 产品 PRD（完整需求）
│   ├── 技术设计文档.md            # 技术架构设计
│   ├── 后端开发架构.md            # 后端模块拆解与依赖图
│   ├── 并行开发方案.md            # 前后端接线开发方案
│   ├── design/                  # 设计资产
│   │   ├── prototype/           # 高保真原型 HTML（seed.sql 的数据来源）
│   │   ├── screens/             # 各界面设计稿
│   │   ├── app-icon-iterations/ # App 图标迭代
│   │   ├── appstore/            # App Store 上架截图
│   │   └── assets/              # 共享图片母版（社区头像 · 数字人）
│   └── marketing/               # 宣传物料
│       └── possibility-poker/   # 人生决策扑克牌（HTML 模板 + 出图提示词）
│
├── scripts/                     # 工具脚本
│   ├── gen_seed.mjs             # 从原型生成 seed.sql
│   ├── gen-types.sh             # Supabase → TS（packages/shared-types）+ Swift（ios/…/Generated）
│   ├── gen-xcconfig.sh          # doppler run -- 生成 ios/Config/Config.xcconfig
│   ├── doppler-sync.sh          # Doppler → Supabase Edge Functions Secrets 单向同步
│   ├── sync-assets.sh           # docs/design/assets 母版 → iOS xcassets + web/
│   └── verify_db.sh             # 无 CLI 环境下校验迁移
│
├── doppler.yaml                 # Doppler 作用域（possibility/dev），doppler run -- 注入变量
├── pnpm-workspace.yaml          # pnpm workspace：packages/* + web
├── .github/workflows/           # CI/CD（按路径触发：backend / packages / android）
└── package.json                 # 根构建脚本
```

### 目录约定

- **不进产物的资料只放 `docs/`** —— 文档、设计稿、原型、宣传物料全部收在这一个目录下，
  根目录不再新增 `assets/` `design/` 之类的平级目录。
- **目录名一律 ASCII**（进路径 / CI / URL），文档文件名保留中文。
- `supabase/` 必须在仓库根 —— Supabase CLI 按此定位工程。
- `docs/design/assets/` 是共享图片的**唯一母版**；iOS 的 `Assets.xcassets` 与 `web/assets/` 都是
  由 `scripts/sync-assets.sh` 分发的副本（Xcode 和静态托管都需要真实文件，不能用符号链接）。
  改图只改母版再跑同步。
- `flash-app/` 是灵光赛道的独立工程，有自己的 lint / tsconfig / CLAUDE.md，不受根目录约定管辖。

> ⚠️ 本仓库在 `~/Documents` 下，处于 iCloud Drive 同步范围。git 批量重命名目录时 iCloud 会
> 留下空的 `xxx 2` 副本（无内容，未跟踪）。执行大规模目录调整后用
> `find . -not -path './.git/*' -name '* [0-9]' -type d -empty -delete` 清理，
> 或把仓库移出 `~/Documents` 彻底避免。

---

## 🛠 开发指南

### NPM Scripts

| 命令 | 说明 |
|---|---|
| `npm test` | 全量后端检查（格式 + lint + 类型 + 单测）|
| `npm run backend:fmt` | 格式化后端代码 |
| `npm run backend:check` | 严格类型检查 + 单测 |
| `npm run db:start` | 启动本地 Supabase |
| `npm run db:reset` | 重建数据库（migration + seed）|
| `npm run db:test` | RLS 集成测试 |
| `npm run seed:generate` | 从原型重建种子数据 |

### Edge Functions

所有业务函数要求统一请求头：

```http
Authorization: Bearer <supabase-user-jwt>
apikey: <supabase-anon-key>
Content-Type: application/json
```

| Function | 路由 | 模型 | 流式 | 说明 |
|---|---|---|---|---|
| `chat` | POST /chat | claude-opus-4-8 | ✅ SSE | 流式对话 + 并行画像/岔路口信号 |
| `match` | POST /match | claude-opus-4-8 | ❌ | 3 位旅人匹配 + 可解释理由 |
| `simulate` | POST /simulate | claude-opus-4-8 | ❌ | 三种未来情景推演 |
| `analyze-diary` | POST /analyze-diary | claude-haiku-4-5 | ❌ | 日记情绪/关键词/画像更新 |
| `diary-summary` | POST /diary-summary | claude-sonnet-5 | ❌ | 月/年度洞察聚合 |
| `lab-choices` | POST /lab-choices | claude-sonnet-5 | ❌ | 实验室选择卡生成 |
| `persona` | POST /persona | claude-sonnet-5 | ❌ | 动态数字形象 |
| `community` | POST /community | — | ❌ | 万花筒/悬赏/旅人 CRUD |
| `save-profile` | POST /save-profile | — | ❌ | 画像/卡牌/公开主页写入 |
| `get-profile` | POST /get-profile | — | ❌ | 画像/卡牌/公开主页读取 |
| `list-conversations` | POST /list-conversations | — | ❌ | 会话列表 + 历史消息 |
| `list-diary` | POST /list-diary | — | ❌ | 日记分页列表 |

### 数据模型

核心表设计遵循两大原则：

- **内容侧**（公开只读）：`travelers`、`traveler_details`、`traveler_services`、`bounties` — 匿名用户可读
- **用户侧**（RLS 锁到 `auth.uid()`）：`profiles`、`conversations`、`messages`、`diary_entries`、`simulations`、`unlocks` — 仅本人可访问

### 安全基线

1. **Key 隔离**：`ANTHROPIC_API_KEY` 只存 Function Secrets，App 只持 anon key（受 RLS 约束）
2. **JWT 校验**：所有 12 个 Edge Function 均 `verify_jwt = true`
3. **RLS 二次约束**：写库经行级安全策略再次验证 `auth.uid()`
4. **输入校验**：message 4000 字符、transcript 20000、topic 40 字符上限
5. **结构化输出**：全部走 `output_config.format` JSON Schema 约束，不裸解析
6. **内容红线**：编码进 system prompt — 不做诊断、不替用户决定、识别高风险转介

### 前端架构特点

- **状态分治**：服务端状态经 `SupabaseService` 缓存；UI/客户端状态留在各 Feature Model
- **真实优先 + 静默回退**：接口调用失败时静默回退到 `DemoData`，不白屏
- **SSE 直连**：聊天不走 `functions.invoke`（会缓冲），`URLSession.bytes` 直连函数 URL
- **签名动画原生重建**：光球/万花筒/转盘/波形均 SwiftUI 原生实现，支持 `reduceMotion`

---

## 🚢 部署

### 线上部署（无需本地 Supabase）

```bash
# 关联远程项目
npx supabase link --project-ref <project-ref>

# 推送数据库 migration
npx supabase db push

# 设置密钥
npx supabase secrets set --env-file supabase/.env.local

# 部署全部函数
npx supabase functions deploy chat
npx supabase functions deploy match
npx supabase functions deploy simulate
npx supabase functions deploy analyze-diary
npx supabase functions deploy diary-summary
npx supabase functions deploy lab-choices
npx supabase functions deploy persona
npx supabase functions deploy community
npx supabase functions deploy save-profile
npx supabase functions deploy get-profile
npx supabase functions deploy list-conversations
npx supabase functions deploy list-diary
```

### 环境变量

| 变量 | 位置 | 说明 |
|---|---|---|
| `SUPABASE_URL` | Edge Runtime 自动注入 | Supabase 项目 URL |
| `SUPABASE_ANON_KEY` | Edge Runtime 自动注入 | 匿名访问 Key |
| `ANTHROPIC_API_KEY` | Function Secrets | Claude API 密钥 |
| `ANTHROPIC_BASE_URL` | Function Secrets (可选) | 网关代理地址 |
| `ANTHROPIC_CHAT_MODEL` | Function Secrets (可选) | 覆盖对话模型 |
| `ANTHROPIC_STRUCTURED_MODEL` | Function Secrets (可选) | 覆盖结构化模型 |
| `ANTHROPIC_DIARY_MODEL` | Function Secrets (可选) | 覆盖日记模型 |

### CI/CD

推送到 `main` 分支自动触发 GitHub Actions：
- 格式检查 (`deno fmt --check`)
- Lint (`deno lint`)
- 严格类型检查 (全部 12 个函数入口)
- 单元测试 (`deno test`)
- RLS 集成测试 (Docker + pgTAP)

---

## 📐 设计原则

| 原则 | 含义 |
|---|---|
| **AI 是前门，不是四个功能之一** | chatbot 承接迷茫、驱动漏斗；经验匹配是对话之后的环节 |
| **提炼而不是定义** | AI 帮用户看见自己，不贴固定人格标签 |
| **可反驳** | 用户可以认领、修正或否决系统对自己的理解 |
| **结局多样** | 推荐成功/失败/延迟/返回等多种结局，避免确认偏误 |
| **行动导向** | 产品最终目标是推动现实行动，不是继续消费内容 |
| **推演不是预言，是一面镜子** | 帮你注意到自己的反应，不替你做决定 |

---

## 🗺 路线图

- [ ] **pgvector 精准匹配**：travelers 加 embedding，余弦召回 + Claude 解释
- [ ] **StoreKit 2 IAP**：接入真实支付（consumable）
- [ ] **供给侧录入**：结构化经验贡献后台（12 字段人生经验节点）
- [ ] **画像资产**：认领/反驳/修正 + 行动回访，沉淀动态人生说明书
- [ ] **轻玄学入口**：答案之书/抛硬币作为免费"照见反应"投射前端

---

## 🤝 参与贡献

1. Fork 本仓库
2. 创建功能分支 (`git checkout -b feat/amazing-feature`)
3. 提交变更 (`git commit -m 'feat(frontend): 添加惊喜功能'`)
4. 推送分支 (`git push origin feat/amazing-feature`)
5. 创建 Pull Request

> 提交信息遵循中文 Conventional Commit 风格：`feat(frontend)/fix(backend)/docs/chore`

---

## 📄 License

[MIT](LICENSE)

---

<div align="center">

**Possibility** — 不替你做决定，帮你把"要不要做"这个前置问题想清楚。

</div>
