# 万花筒 · 微信小程序端

原生小程序 + TypeScript，以 iOS 为设计基准全量复刻 10 个功能模块，与 `ios/` `android/` `web/`
共用同一套 Supabase 后端。

完整方案见 [`docs/engineering/小程序端开发方案.md`](../docs/engineering/小程序端开发方案.md)。

## 快速开始

```bash
cd miniprogram
npm install          # 装 miniprogram-api-typings + tsc（不在 pnpm workspace 内）
npm run typecheck    # 类型检查
npm run size         # 主包 2MB / 总包 20MB 护栏
```

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
│   │   ├── request.ts               # Edge Function 调用
│   │   ├── auth.ts                  # 微信一键登录 + 会话续期
│   │   ├── chat-stream.ts           # ← ios/Core/Network/ChatStreamClient.swift
│   │   ├── utf8.ts                  # 增量 UTF-8 解码（小程序没有 TextDecoder）
│   │   └── functions.ts             # 函数名契约
│   └── design/tokens.wxss           # ← ios/Core/DesignSystem/Theme.swift
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

## 当前进度

波次 0 的 `W0-1`（工程脚手架 + CI）已完成，21 个页面骨架可导航，`tokens.wxss` 与网络层骨架
（`request` / `auth` / `chat-stream` / `utf8` / `functions`）已就位。

待做：`W0-0` 冒烟结论、`W0-2` 组件基元、`W0-3` 模型层与埋点、`W0-4` 后端 `wechat-auth`。
