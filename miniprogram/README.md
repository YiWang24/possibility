# 万花筒 · 微信小程序端

原生小程序 + TypeScript，以 iOS 为设计基准全量复刻 10 个功能模块，与 `ios/` `android/` `web/`
共用同一套 Supabase 后端。

完整方案见 [`docs/engineering/小程序端开发方案.md`](../docs/engineering/小程序端开发方案.md)。

## 快速开始

```bash
cd miniprogram
npm install     # 装 miniprogram-api-typings + tsc（不在 pnpm workspace 内）
npm run check   # 类型检查 + 工程结构护栏 + 包体护栏（CI 跑的就是这三条）
```

单独跑：`npm run typecheck` / `npm run structure` / `npm run size`。

`structure` 校验的是 tsc 抓不到的一类错误——页面四件套是否齐全、`usingComponents`
路径能否解析、`preloadRule` 有没有引用不存在的分包。这些只有微信开发者工具编译时
才会炸，而 CI 里没有开发者工具。

然后用**微信开发者工具**打开 `miniprogram/` 目录（不是 `miniprogram/src/`——
`miniprogramRoot` 已在 `project.config.json` 里指向 `src/`）。

首次打开需要：

1. 填入自己的 AppID，或用「测试号」（`project.config.json` 里当前是 `touristappid`）
2. 详情 → 本地设置 → 勾选**「不校验合法域名、web-view、TLS 版本以及 HTTPS 证书」**

第 2 步是必须的：后端 `*.supabase.co` 未 ICP 备案，不能作为小程序的 request 合法域名。
提审前要把 `src/core/config.ts` 的 `API_BASE` 切到备案域名的反代网关，详见方案文档 §6.3。

## 目录

```
src/
├── app.ts / app.json / app.wxss     # 入口 · 路由与分包 · 全局样式
├── custom-tab-bar/                  # 自定义 tabBar（对应 iOS AppTab）
├── core/
│   ├── config.ts                    # ← ios/App/AppConfig.swift
│   ├── net/
│   │   ├── request.ts               # Edge Function 调用 + PostgREST 直读（内容侧公开表）
│   │   ├── api.ts                   # 28 个函数封装 ← SupabaseService.swift
│   │   ├── auth.ts                  # 微信一键登录 + 会话续期
│   │   ├── chat-stream.ts           # ← ios/Core/Network/ChatStreamClient.swift
│   │   ├── utf8.ts                  # 增量 UTF-8 解码（小程序没有 TextDecoder）
│   │   └── functions.ts             # 函数名契约
│   ├── models/                      # ← _shared/schemas.ts；dimensions/emotions/demo-data 镜像自 web/lib
│   ├── analytics/                   # app_events 上报（小程序只有 Layer 1，见下）
│   └── design/
│       ├── tokens.wxss              # ← ios/Core/DesignSystem/Theme.swift
│       ├── motion.ts                # 动效开关（小程序没有系统 reduceMotion 信号）
│       └── components/              # orb（熔岩灯光球）· kaleido-card · tag-pill · btn · sheet
├── pages/                           # 主包：home / lab / community / me / login
└── subpkg/                          # 分包：chat / profile / diary / card-game / studio / community-ext
```

## 约定

- **iOS 是设计基准。** 每个页面的头部注释里写了对应的 Swift 文件，复刻前先读它。
  同一功能不允许出现第四种交互逻辑（README 设计原则）。
- **不写死样式值。** 颜色、圆角、阴影一律引 `core/design/tokens.wxss` 的 CSS 变量。
  `Theme.swift` 是唯一事实来源，改色只改 tokens。
- **真实优先 + 静默回退。** 接口失败回退 `DemoData`，不白屏。
- **密钥不进包。** 小程序只持受 RLS 约束的 anon key；`DEEPSEEK_API_KEY` / `AZURE_SPEECH_KEY` /
  微信 AppSecret 只存 Supabase Function Secrets（源头 Doppler）。
- **函数名契约要同步。** `core/net/functions.ts` 是 `packages/shared-types/src/api.ts` 的手工
  镜像（小程序不在 pnpm workspace 内），后端增删函数时两处都要改。

## Skyline

`app.json` 全局是 `"renderer": "webview"`，只有 `pages/dev-skyline-smoke/` 用 Skyline。
那一页是波次 0 · W0-0 的冒烟验证——把七项有风险的 CSS 特性并排铺开，跑一次得出
「全量 Skyline vs 混合渲染」的结论。开发者工具里编译模式选「Skyline 冒烟验证（W0-0）」直达。

该页不进生产：`sitemap.json` 已 disallow，提审前从 `app.json` 的 `pages` 里删掉。

## 埋点

小程序端**只有 Layer 1**（Supabase `app_events`）。PostHog 与 Sentry 都要求把各自域名加进
「request 合法域名」白名单，而该白名单只接受已 ICP 备案的域名——posthog.com / sentry.io
不在我们名下，备不了案。

这带来一个 iOS 没有的约束：在 iOS 上 `app_events` 是兜底事实表，漏报还有 PostHog 兜着；
在小程序上它是**唯一**事实来源，漏报即永久丢数。所以 `core/analytics/` 的队列落本地存储、
冷启动重放、切后台立刻 flush，而不是像 iOS 那样只用内存缓冲。

事件目录的唯一事实来源是 [`docs/engineering/埋点方案.md`](../docs/engineering/埋点方案.md)，
`core/analytics/events.ts` 是它的镜像，改动先改文档。

## 当前进度

波次 0 已完成 `W0-1` ~ `W0-4`：

- **W0-1** 工程脚手架 + CI（21 个页面骨架、分包与 preloadRule、三条护栏）
- **W0-2** 设计系统：`tokens.wxss`（与 `Theme.swift` 逐项对齐）+ orb / kaleido-card / tag-pill / btn / sheet
- **W0-3** 网络层 + 模型层 + 埋点层
- **W0-4** 后端 `wechat-auth` + `app_events` 放开 `source='miniprogram'`

**待做**：`W0-0` 的 Skyline 冒烟结论——冒烟页已就绪（`pages/dev-skyline-smoke/`），
需要在真机上跑一次、把「全量 Skyline vs 混合渲染」的判断写回方案文档 §2.1。
这是波次 1 开工前唯一的前置。
