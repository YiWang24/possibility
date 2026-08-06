<div align="center">

# Possibility · 万花筒

**AI 决策陪伴 · 青年人生 OS**

面向 22–30 岁职业与身份转换期年轻人的 AI 决策陪伴产品。
用 AI 对话承接迷茫，在决策最痛的急性时刻用精准真人经验匹配推动现实行动。

[![CI](https://github.com/YiWang24/possibility/actions/workflows/ci.yml/badge.svg)](https://github.com/YiWang24/possibility/actions/workflows/ci.yml)
[![Deploy](https://github.com/YiWang24/possibility/actions/workflows/deploy.yml/badge.svg)](https://github.com/YiWang24/possibility/actions/workflows/deploy.yml)
[![Platform](https://img.shields.io/badge/platform-iOS%20%C2%B7%20Android%20%C2%B7%20Web-blue.svg)](#三端与后端)
[![Backend](https://img.shields.io/badge/backend-Supabase%20Edge%20Functions-3ECF8E.svg)](https://supabase.com)
[![LLM](https://img.shields.io/badge/LLM-DeepSeek%20via%20Vercel%20AI%20SDK-4D6BFE.svg)](https://deepseek.com)

[产品理念](#-产品理念) · [系统架构](#-系统架构) · [技术栈](#-技术栈) · [快速开始](#-快速开始) · [项目结构](#-项目结构) · [开发指南](#-开发指南) · [部署](#-部署) · [路线图](#-路线图)

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

### 三端与后端

三个客户端**功能对等**，共用同一套 Supabase 后端与数据契约。iOS 是设计基准，Android / Web 以其为标准复刻——同一个功能不会出现三种交互逻辑。

```
┌── iOS (SwiftUI) ──┐  ┌── Android (Compose) ──┐  ┌── Web (Next.js 15) ──┐
│  iOS 17+          │  │  minSdk 26            │  │  React 19 · TW 4      │
│  @Observable      │  │  supabase-kt          │  │  App Router · zustand │
└─────────┬─────────┘  └───────────┬───────────┘  └───────────┬───────────┘
          │                        │                          │
          │  Home · Chat · Lab · Community · CardGame · Studio · Diary · Me
          │  Auth（匿名 + Apple）· Profile（旅人主页 · 付费墙）
          └────────────────────────┼──────────────────────────┘
                                   │ JWT（Auth）· SSE（流式对话）
                                   ▼
┌──────────────────────────── Supabase ───────────────────────────────────┐
│  Auth        Postgres 17 + RLS       Storage（音频）     Edge Functions  │
│  匿名/Apple  33 migrations                               29 个（Deno TS）│
└───────────────────────────────────┬─────────────────────────────────────┘
                                    │  密钥只存 Function Secrets
          ┌─────────────────────────┼──────────────────────┐
          ▼                         ▼                      ▼
   DeepSeek v4-flash        Azure AI Speech          Langfuse · Sentry
   （Vercel AI SDK）         （语音转写）              （LLM 追踪 · 错误）
```

> **Web 已不是 demo**。`web/` 曾是纯静态 mock，现已是完整的 Next.js 15 产品应用（App Router + 设计 token + cva 组件基元），直接消费 `packages/api-client`。

### 端到端数据流（付费漏斗主线）

```
匿名登录 → auth.uid() + JWT
    ↓
首页发问 → POST /chat（流式 SSE）
    ↓ 打字机输出 + 并行抽取画像 / 岔路口信号
岔路口成形（crossroads.ready == true）
    ↓
前端呈现「看看走过这条路的人」→ 万花筒抽人动画
    ↓
POST /match → 结构化输出 → 3 位结局不同的旅人 + 匹配理由
    ↓
旅人主页 → 付费墙 ¥9.9 → 解锁完整经验 + 现实行动
```

> 付费当前是 **demo mock 解锁**（写 `unlocks` 表），真实 IAP 见[路线图](#-路线图)。

### 语音日记异步流水线

日记不在请求里同步处理——录音落 Storage 后**入队**，重活全在 `diary-worker` 里做。
面向客户端的函数只负责建条目、入队和读结果，所以请求永远快速返回，转写慢或模型抖动都不会卡住 UI：

```
录音 → create-diary-entry（建条目 + 上传票据）→ Storage
    → finalize-diary-entry（入队 transcribe 任务）
                    │
                    ▼
        diary-worker（内部队列消费者，x-diary-worker-secret 鉴权）
            ├─ Azure Speech 转写        → status: transcribed
            ├─ 分析（情绪/关键词/画像提案）→ status: ready
            └─ 月/年洞察聚合            → LLM 失败时降级为统计文案

客户端侧：diary-summary 只负责入队与取结果；analyze-diary 是直接文本分析的同步入口
```

---

## 🔧 技术栈

| 层 | 选型 | 说明 |
|---|---|---|
| **iOS** | Swift + SwiftUI（iOS 17+，`@Observable`） | 设计基准端；原生签名动画（光球/万花筒/转盘/波形）|
| **Android** | Kotlin + Jetpack Compose + supabase-kt | compileSdk 35 / minSdk 26，以 iOS 为标准全量复刻 |
| **Web** | Next.js 15 + React 19 + Tailwind 4 | App Router、cva 组件基元、zustand、framer-motion |
| **流式聊天** | SSE（iOS 走 `URLSession.bytes`） | 绕过 `functions.invoke` 的缓冲，实现打字机效果 |
| **后端 BaaS** | Supabase（Postgres + Auth + Storage + Edge Functions） | 一站式后端，匿名登录起步 |
| **Edge Functions** | TypeScript / Deno 2 | 29 个函数，26 个强制 `verify_jwt` |
| **LLM** | DeepSeek `v4-flash`（Vercel AI SDK `ai@7`）| 对话 / 结构化 / 日记三个模型槽位，可独立灰度 |
| **结构化输出** | JSON Schema 约束 | `_shared/schemas.ts` 10 套契约，不裸解析模型输出 |
| **语音转写** | Azure AI Speech Fast Transcription | 密钥仅存 Function Secrets |
| **可观测性** | Langfuse（OTel）· Sentry · PostHog · `app_events` | LLM 追踪 / 错误 / 产品埋点 / 自有事件四层 |
| **数据库** | Postgres 17 + RLS | 33 个 migration，行级安全，4 套 RLS 测试 |
| **配置管理** | Doppler（`possibility` 项目 · dev/stg/prd） | 唯一密钥源，单向同步到 Supabase Secrets |
| **CI/CD** | GitHub Actions | 5 条流水线，按路径触发；合入 main 自动部署 |

> **模型槽位**：`DEEPSEEK_CHAT_MODEL` / `DEEPSEEK_STRUCTURED_MODEL` / `DEEPSEEK_DIARY_MODEL` 默认都指向 `deepseek-v4-flash`（延迟与成本优先），保留三个独立变量是为了单场景灰度换模型。

---

## ✨ 功能模块

以下模块**三端均已实现**（`ios/…/Features/`、`android/…/features/`、`web/features/` 一一对应）。

| 模块 | 做什么 |
|---|---|
| **Home · 认识自己** | AI 对话前门：承接迷茫 → 初步判断 → 澄清岔路口；画像在对话中自然沉淀，无需填表 |
| **Chat · 探索对话** | 流式 SSE 对话，并行抽取画像与岔路口信号 |
| **Lab · 人生实验室** | 转盘选年限（1–10 年）+ 选择卡拖入 → 推演一般 / 乐观 / 警示三种未来 + 底线分析 |
| **Community · 万花筒社区** | 万花筒抽取动画（六瓣折光）、悬赏问答发布/回应、围观模式 |
| **CardGame · 卡牌游戏** | 自我探索游戏化，含压力/强制交换机制与 AI 叙事生成，结果持久化 |
| **Studio · 画像工作室** | 多维测评、上下文扫描、评估结果可视化 |
| **Diary · 语音日记** | 录音 → 转写 → 情绪分析 → 画像提案；周历/月报 LLM 洞察 |
| **Me · 我的主页** | 公开主页编辑、隐私可见性控制、云端同步 |
| **Profile · 旅人主页** | 匹配结果详情、付费墙、完整经验与现实行动 |
| **Auth · 账号** | 匿名登录起步 + Apple 登录；手机验证码与匿名合并代码保留但**当前休眠** |

---

## 🚀 快速开始

### 前置依赖

| 依赖 | 版本 | 用途 |
|---|---|---|
| [Node.js](https://nodejs.org/) | ≥ 18 | 脚本与 workspace |
| [pnpm](https://pnpm.io/) | 10.34.1 | 包管理器（根 `packageManager` 已锁定）|
| [Deno](https://deno.land/) | 2.x | Edge Functions 开发与检查 |
| [Supabase CLI](https://supabase.com/docs/guides/cli) | ≥ 2.109 | 本地数据库与部署 |
| [Docker](https://docker.com/) | — | 本地 Supabase 依赖 |
| Xcode | 15+ | iOS 构建（仅 macOS）|
| JDK | 17 或 21 | Android 构建（尚不支持 JDK 25）|

### 后端本地开发

```bash
pnpm install                 # 安装 workspace 依赖

pnpm run db:start            # 启动本地 Supabase（Postgres + Auth + Storage）
pnpm run db:reset            # 应用 33 个 migration + seed

cp supabase/functions/.env.example supabase/functions/.env
# 编辑 .env，至少填入 DEEPSEEK_API_KEY；语音日记还需 AZURE_SPEECH_*

npx supabase functions serve --env-file supabase/functions/.env

pnpm test                    # 全量后端检查：fmt + lint + 类型 + 单测
pnpm run db:test             # 4 套 RLS / 数据隔离测试
```

### iOS

```bash
open ios/Possibility.xcodeproj    # 已配置线上 Supabase 回落，拉取即可直连云端
# Xcode → 选 iOS 17+ 模拟器或真机 → Build & Run
```

连本地后端：复制 `ios/Config/Config.xcconfig.example` → `Config.xcconfig`，填入本地
`SUPABASE_URL` / `SUPABASE_ANON_KEY`，然后 `cd ios && xcodegen generate`。

> `Possibility.xcodeproj` 虽然入库，但**唯一事实来源是 `project.yml`**——改目录或加文件后必须重跑
> `xcodegen generate`，不要在 Xcode 里手工调工程设置（会被下次生成覆盖）。详见 [`ios/README.md`](ios/README.md)。

### Android

```bash
cd android && ./gradlew assembleDebug
```

需要 `ANDROID_HOME` 已配置。后端配置经 `BuildConfig` 注入，可用 Doppler 覆盖。详见 [`android/README.md`](android/README.md)。

### Web

```bash
pnpm --filter @possibility/web dev        # 本地开发
pnpm --filter @possibility/web typecheck  # 类型检查
pnpm --filter @possibility/web lint:tokens # 设计 token 护栏
```

> ⚠️ **密钥红线**：`DEEPSEEK_API_KEY`、`AZURE_SPEECH_KEY` 等**绝不进 App / 前端 / 仓库**，
> 只存 Supabase Function Secrets（源头在 Doppler）。客户端只持 anon key，受 RLS 约束。

---

## 📁 项目结构

顶层按「交付物」切分：`ios/` `android/` `web/` `flash-app/` 四个可独立构建的前端，`supabase/` 一个后端，
`packages/` TS 共享层，`scripts/` 工具脚本。
**所有不进产物的资料（文档 / 设计稿 / 原型 / 宣传物料 / demo 视频工程）统一收在 `docs/` 一个目录下。**

```
possibility/
├── ios/                         # iOS App（SwiftUI）—— 标准 Xcode 布局
│   ├── Possibility.xcodeproj/   # 由 project.yml 生成，勿手改工程设置
│   ├── Possibility/             # ← app target 源码根（与 target 同名）
│   │   ├── App/                 # 入口 · 配置 · 导航路由
│   │   ├── Core/
│   │   │   ├── Analytics/       # 埋点四层：Analytics · PostHog · Sentry · SupabaseEvent
│   │   │   ├── DesignSystem/    # Theme · 组件 · 四个签名动画
│   │   │   ├── Models/          # 数据模型 · DemoData（断网兜底）
│   │   │   ├── Network/         # SupabaseService · ChatStreamClient
│   │   │   └── Utilities/
│   │   ├── Features/            # Home Chat Lab Community CardGame Studio Diary Me Auth Profile
│   │   └── Resources/
│   ├── PossibilityTests/        # 单测（Swift Testing）
│   ├── PossibilityUITests/      # UI 测试 · App Store 截图
│   ├── Config/                  # Base.xcconfig（入库）· Config.xcconfig.example
│   └── project.yml              # xcodegen 工程定义（唯一事实来源）
│
├── android/                     # Android App（Kotlin + Compose + supabase-kt）
│   └── app/src/main/java/app/possibility/android/
│       ├── features/            # 与 iOS 一一对应的 10 个模块
│       └── ui/                  # 设计系统与共享组件
│
├── web/                         # Web 产品应用（Next.js 15 · React 19 · Tailwind 4）
│   ├── app/(app)/               # App Router 路由：chat lab community card-game diary studio me …
│   ├── features/                # 与 iOS 对应的功能实现
│   ├── components/ui/           # cva 组件基元（button/card/sheet/…）+ OrbView
│   ├── lib/                     # supabase · chat-stream · theme · demo-data
│   └── scripts/                 # check-design-tokens.mjs（设计 token 护栏）
│
├── supabase/                    # 后端
│   ├── migrations/              # 33 个 SQL migration
│   ├── functions/               # 29 个 Edge Function（Deno TS）
│   │   ├── _shared/             # 公共层：llm · schemas · auth · sse · telemetry · sentry …
│   │   ├── chat/ match/ simulate/ lab-choices/        # 对话与推演
│   │   ├── create-diary-entry/ … diary-worker/        # 语音日记流水线
│   │   ├── save-profile/ get-profile/ profile-privacy/ persona/
│   │   ├── card-game-catalog/ card-game-session/ card-game-result/
│   │   └── community/ list-conversations/ list-diary/ delete-account/ …
│   ├── analytics/               # 分析 SQL：funnel · retention · llm_cost · observability
│   ├── tests/                   # 4 套 RLS 集成测试
│   ├── seed.sql                 # 种子数据（12 位旅人）
│   └── config.toml              # 项目配置（含每函数 verify_jwt）
│
├── packages/                    # TS 共享层（pnpm workspace）
│   ├── shared-types/            # supabase gen types 产物 + Edge Function 名称契约
│   └── api-client/              # Supabase 客户端 + Edge Function 调用封装
│
├── flash-app/                   # 灵光 App（Vite + React，独立工程链，自带 CLAUDE.md）
│
├── docs/                        # ← 所有不进产物的资料，只此一处（索引见 docs/README.md）
│   ├── product/                 # 产品定义与 PRD
│   ├── engineering/             # 技术设计 · 后端架构 · 埋点方案（Swift/TS 镜像的唯一事实来源）
│   ├── features/                # 单功能模块设计
│   ├── design/                  # 原型 · 设计稿 · 图标 · 上架截图 · 图片母版
│   ├── marketing/               # 海报 · 人生决策扑克牌
│   └── demo-video/              # 产品 demo 视频的 Remotion 工程（独立 npm 工程）
│
├── scripts/                     # 工具脚本
│   ├── gen_seed.mjs             # 从原型生成 seed.sql
│   ├── gen-types.sh             # Supabase → TS（packages/shared-types）+ Swift
│   ├── gen-xcconfig.sh          # doppler run -- 生成 ios/Config/Config.xcconfig
│   ├── doppler-sync.sh          # Doppler → Supabase Function Secrets 单向同步
│   ├── sync-assets.sh           # docs/design/assets 母版 → iOS xcassets + web/
│   └── verify_db.sh             # 无 CLI 环境下校验迁移
│
├── doppler.yaml                 # Doppler 作用域（possibility/dev）
├── pnpm-workspace.yaml          # pnpm workspace：packages/* + web
├── .github/workflows/           # ci · web · android · packages · deploy
└── package.json                 # 根构建脚本
```

### 子文档导航

| 文档 | 讲什么 |
|---|---|
| [`docs/README.md`](docs/README.md) | 全部非产物资料的索引（先看这个） |
| [`ios/README.md`](ios/README.md) | iOS 目录结构、xcodegen 约定、构建与签名 |
| [`android/README.md`](android/README.md) | Android 环境要求与构建 |
| [`supabase/README.md`](supabase/README.md) | 后端函数职责说明 |
| [`flash-app/README.md`](flash-app/README.md) | 灵光赛道独立工程 |
| [`docs/demo-video/README.md`](docs/demo-video/README.md) | Demo 视频的 Remotion 工程与剪辑约定 |

### 目录约定

- **不进产物的资料只放 `docs/`** —— 文档、设计稿、原型、宣传物料、demo 视频工程全部收在这一个目录下，
  根目录不再新增 `assets/` `design/` 之类的平级目录。
- **目录名一律 ASCII**（进路径 / CI / URL），文档文件名保留中文。
- `supabase/` 必须在仓库根 —— Supabase CLI 按此定位工程。
- `docs/design/assets/` 是共享图片的**唯一母版**；iOS 的 `Assets.xcassets` 与 `web/assets/` 都是
  由 `scripts/sync-assets.sh` 分发的副本（Xcode 和静态托管都需要真实文件，不能用符号链接）。
  改图只改母版再跑同步。
- `flash-app/` 是灵光赛道的独立工程，有自己的 lint / tsconfig / CLAUDE.md，不受根目录约定管辖，
  也不在 pnpm workspace 内。`docs/demo-video/` 同理，是独立 npm 工程。

> ⚠️ 本仓库在 `~/Documents` 下，处于 iCloud Drive 同步范围。git 批量重命名目录时 iCloud 会
> 留下空的 `xxx 2` 副本（无内容，未跟踪）。执行大规模目录调整后用
> `find . -not -path './.git/*' -name '* [0-9]' -type d -empty -delete` 清理，
> 或把仓库移出 `~/Documents` 彻底避免。

---

## 🛠 开发指南

### 常用命令

| 命令 | 说明 |
|---|---|
| `pnpm test` | 全量后端检查（fmt + lint + 29 个入口类型检查 + 单测）|
| `pnpm run backend:fmt` | 格式化后端代码 |
| `pnpm run backend:check` | 同 `pnpm test` |
| `pnpm run db:start` | 启动本地 Supabase |
| `pnpm run db:reset` | 重建数据库（migration + seed）|
| `pnpm run db:test` | 4 套 RLS / 数据隔离测试（rls · diary_v2 · profile_privacy · card_game）|
| `pnpm run packages:typecheck` | 共享包类型检查 |
| `pnpm run gen:types` | Supabase schema → TS + Swift 类型 |
| `pnpm run doppler:sync` | Doppler → Supabase Function Secrets 单向同步 |
| `pnpm run seed:generate` | 从原型重建种子数据 |

### Edge Functions

统一请求头（`verify_jwt` 函数）：

```http
Authorization: Bearer <supabase-user-jwt>
apikey: <supabase-anon-key>
Content-Type: application/json
```

29 个函数按域分组，全部 `POST`。带 🤖 的会调用 LLM。

| 域 | 函数 |
|---|---|
| **对话与推演** | 🤖 `chat`（流式 SSE + 并行画像/岔路口信号）· 🤖 `match`（3 位旅人匹配 + 可解释理由）· 🤖 `simulate`（三种未来推演）· 🤖 `lab-choices`（实验室选择卡）|
| **语音日记** | 🤖 `diary-worker`（队列消费：转写 + 分析 + 洞察）· 🤖 `analyze-diary`（直接文本分析）· `create-diary-entry` · `finalize-diary-entry` · `diary-summary`(入队) · `retry-diary-entry` · `update-diary-transcript` · `diary-audio-url` · `delete-diary-entry` · `delete-diary-audio` · `export-diary` · `list-diary` |
| **画像与主页** | `save-profile` · `get-profile` · `profile-privacy` · 🤖 `persona`（动态数字形象）· 🤖 `analyze-self-discovery`（喜欢 × 擅长证据综合）|
| **卡牌游戏** | `card-game-catalog`(公开目录) · `card-game-session` · 🤖 `card-game-result`（AI 叙事）|
| **社区与会话** | 🤖 `community`（万花筒/悬赏/旅人）· `list-conversations` |
| **账号** | `delete-account` · `merge-anonymous`(休眠) · `send-sms-hook`(休眠) |

**JWT 例外（3 个，均有替代鉴权）**：

| 函数 | 为什么不校验 JWT | 怎么鉴权 |
|---|---|---|
| `card-game-catalog` | 公开卡牌目录，未登录也要能看 | 只读已发布目录，不碰用户数据，带公开缓存头 |
| `diary-worker` | 内部队列消费者，无用户上下文 | `x-diary-worker-secret` 头 |
| `send-sms-hook` | Supabase Auth Webhook，无用户 JWT | `standardwebhooks` 签名校验 |

### 数据模型

核心表设计遵循两大原则：

- **内容侧**（公开只读）：`travelers`、`traveler_details`、`traveler_services`、`bounties`
- **用户侧**（RLS 锁到 `auth.uid()`）：`profiles`、`profile_facts`、`conversations`、`messages`、
  `diary_entries`、`simulations`、`unlocks`、卡牌 session/result —— 仅本人可访问

RLS 不是可选项：`supabase/tests/` 下 4 套测试专门验证跨用户读写全部被拒。

### 安全基线

1. **密钥隔离**：`DEEPSEEK_API_KEY` / `AZURE_SPEECH_KEY` 只存 Function Secrets（源头 Doppler），客户端只持受 RLS 约束的 anon key
2. **JWT 校验**：29 个函数中 26 个 `verify_jwt = true`，3 个例外各有替代鉴权（见上表）
3. **RLS 二次约束**：写库经行级安全策略再次验证 `auth.uid()`，不信任函数层判断
4. **输入校验**：`_shared/validate.ts` 统一长度与类型上限（message 4000 字符、transcript 20000、topic 40）
5. **结构化输出**：11 套 JSON Schema 约束模型输出，不裸解析
6. **内容红线**：编码进 system prompt —— 不做诊断、不替用户决定、识别高风险转介

### 可观测性

四层各司其职，契约的唯一事实来源是 [`docs/engineering/埋点方案.md`](docs/engineering/埋点方案.md)——
Swift / Kotlin / TS 三端镜像必须跟随该文件改动：

| 层 | 工具 | 看什么 |
|---|---|---|
| 产品埋点 | PostHog | 漏斗、留存、功能使用 |
| 自有事件 | Supabase `app_events` 表 | 可 SQL 关联业务数据的原始事件 |
| 错误上报 | Sentry | 客户端与 Edge Function 异常 |
| LLM 追踪 | Langfuse（OpenTelemetry） | prompt / 响应 / token / 成本 / 延迟 |

`supabase/analytics/` 下备有现成 SQL：`funnel.sql` · `retention.sql` · `llm_cost.sql` · `observability.sql`。

> Sentry / Langfuse 未配置时对应模块**静默关闭**——可观测性不可用，但绝不阻断请求或部署。

### 前端架构特点

- **三端对齐**：iOS 是设计与交互基准，Android / Web 复刻；同一功能不允许三种逻辑
- **状态分治**：服务端状态经各端 Service 层缓存；UI 状态留在各 Feature Model / store
- **真实优先 + 静默回退**：接口失败时静默回退到 `DemoData`，不白屏
- **SSE 直连**：聊天不走 `functions.invoke`（会缓冲），直连函数 URL 读流
- **签名动画原生实现**：光球 / 万花筒 / 转盘 / 波形各端原生重建，支持 `reduceMotion`
- **Web 设计 token 护栏**：`lint:tokens` 在 CI 拦截绕过 token 的硬编码样式

---

## 🚢 部署

### 自动部署（默认路径）

**合入 `main` 即自动部署**，无需手工执行任何 Supabase 命令。`.github/workflows/deploy.yml` 依次完成：

```
supabase link                       关联生产项目
supabase db push --include-all      推送迁移（含时间戳早于远端的并行 PR 迁移）
scripts/doppler-sync.sh prd         Doppler → Function Secrets 单向同步
supabase functions deploy           部署全部 Edge Functions
```

唯一的 GitHub Secret 是 `DOPPLER_TOKEN`（scoped 到 `possibility/prd`），其余凭据全部由 `doppler run` 注入。
工作流带 `concurrency: production-deploy`，同一时间只跑一个生产部署。

### 环境变量

全部由 **Doppler**（项目 `possibility`，dev/stg/prd 三环境）统一管理。
`doppler-sync.sh` 只排除 `DOPPLER_` / `SUPABASE_` 前缀，其余键全量同步到 Function Secrets——加新变量不需要改部署脚本。

| 变量 | 位置 | 说明 |
|---|---|---|
| `SUPABASE_URL` / `SUPABASE_ANON_KEY` | Edge Runtime 自动注入 | 项目 URL 与匿名 Key |
| `DEEPSEEK_API_KEY` | Function Secrets | **必需**，LLM 密钥 |
| `DEEPSEEK_BASE_URL` | 可选 | 默认 `https://api.deepseek.com` |
| `DEEPSEEK_CHAT_MODEL` / `_STRUCTURED_MODEL` / `_DIARY_MODEL` | 可选 | 三个模型槽位，默认均为 `deepseek-v4-flash` |
| `AZURE_SPEECH_KEY` / `AZURE_SPEECH_ENDPOINT` | Function Secrets | 语音转写；**禁止**放入 Web 环境变量 |
| `AZURE_SPEECH_API_VERSION` / `AZURE_SPEECH_LOCALES` | 可选 | 默认 `2025-10-15` / `zh-CN,en-US` |
| `DIARY_WORKER_SECRET` | 可选 | Cron 触发 diary-worker；留空则复用 service-role |
| `DIARY_DAILY_ENTRY_LIMIT` | 可选 | 单用户日记日配额，默认 30 |
| `SENTRY_DSN` / `SENTRY_ENVIRONMENT` | 可选 | 未配置时错误上报静默关闭 |

### CI

PR 按路径触发，互不干扰：

| 工作流 | 触发路径 | 做什么 |
|---|---|---|
| `ci.yml` | `supabase/**` `scripts/**` `package.json` | Deno fmt / lint / 28 入口类型检查 / 单测；启本地库跑迁移 + RLS 测试 |
| `web.yml` | `web/**` `packages/**` | 类型检查 + 设计 token 护栏 |
| `android.yml` | `android/**` | `assembleDebug` |
| `packages.yml` | `packages/**` | 共享包类型检查 |
| `deploy.yml` | push 到 `main` | 生产部署（见上）|

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
| **三端对齐优先于单端最优** | 交互差异要有理由（平台惯例），不能是实现方便 |

---

## 🗺 路线图

- [ ] **pgvector 精准匹配**：travelers 加 embedding，余弦召回 + LLM 解释（当前为纯 LLM 匹配）
- [ ] **StoreKit 2 IAP**：接入真实支付（consumable），替换当前的 demo mock 解锁
- [ ] **供给侧录入**：结构化经验贡献后台（12 字段人生经验节点）
- [ ] **画像资产**：认领/反驳/修正 + 行动回访，沉淀动态人生说明书
- [ ] **恢复手机验证码登录**：`send-sms-hook` / `merge-anonymous` 代码已就位，当前休眠
- [ ] **轻玄学入口**：答案之书/抛硬币作为免费"照见反应"投射前端

---

## 🤝 参与贡献

1. 创建功能分支（`git checkout -b feat/amazing-feature`）
2. 本地跑通对应检查（后端 `pnpm test` / Web `typecheck` + `lint:tokens` / Android `assembleDebug`）
3. 提交变更（`git commit -m 'feat(web): 添加惊喜功能'`）
4. 推送并创建 Pull Request，等待路径对应的 CI 通过

> 提交信息遵循中文 Conventional Commit 风格，scope 用交付物名：
> `feat(ios)` / `fix(android)` / `perf(web)` / `refactor(backend)` / `chore(docs)`

---

## 📄 License

本仓库**尚未声明开源许可**。在补充 `LICENSE` 文件之前，按默认版权处理——保留所有权利，
不授予复制、修改或再分发的许可。

---

<div align="center">

**Possibility** — 不替你做决定，帮你把"要不要做"这个前置问题想清楚。

</div>
