# Possibility iOS 前端

SwiftUI（iOS 17+，`@Observable`）实现的万花筒前端。源码在 Linux 侧产出，**Xcode 组装 / 构建 / 真机在 macOS 完成**（本仓库不含 `.xcodeproj` / `Package.swift`，由 Mac 侧生成）。

## 目录结构

```
frontend/
├─ App/            入口 PossibilityApp · 配置 AppConfig · 导航 Navigation
├─ Core/
│  ├─ DesignSystem/  Theme · 组件 · 四个签名动画（Orb/Kaleidoscope/Dial/Waveform）
│  ├─ Models/        数据模型 · DemoData（断网兜底种子）
│  └─ Network/       SupabaseService · ChatStreamClient（SSE 流式）
└─ Features/       Home / Chat / Lab / Community / Profile（各含 View + Model）
```

## 配置

前端运行时从 Info.plist 读取后端地址/密钥；**缺省已回落到线上 Supabase 项目**（`gxmruqzcyahjlktshpkh`，anon key 受 RLS 约束、可公开），拉取即可直连云端，无需额外配置。

如需连本地 `supabase start`，再自行覆盖：

1. 复制 `Config.xcconfig.example` → `Config.xcconfig`（真实文件已被 `.gitignore` 忽略）。
2. 填入本地 `SUPABASE_URL`（如 `http://127.0.0.1:54321`）与对应 `SUPABASE_ANON_KEY`。
3. Xcode target → Build Settings，将 Configuration 指向该 xcconfig；在 Info.plist 增加键
   `SUPABASE_URL = $(SUPABASE_URL)`、`SUPABASE_ANON_KEY = $(SUPABASE_ANON_KEY)`。

未配置 xcconfig 时，`AppConfig` 回落到线上项目 `https://gxmruqzcyahjlktshpkh.supabase.co`。

> `ANTHROPIC_API_KEY` **绝不进 App / 仓库**，只存 Supabase Function Secrets（技术设计文档 §5 / §11.1）。

### 埋点密钥（docs/埋点方案.md）

同一条注入路径再加三个键，填在 `Config.xcconfig` 里：

| 键 | 去哪拿 | 缺省行为 |
|---|---|---|
| `POSTHOG_API_KEY` | PostHog → Project Settings → **Project API Key**（`phc_` 开头） | 不注册 PostHog |
| `POSTHOG_HOST` | 默认 `https://us.i.posthog.com`；EU 区改 `eu.i.posthog.com`，有自建反代就填反代域名 | 用美区默认值 |
| `SENTRY_DSN` | Sentry → 项目 → Client Keys (DSN) | 不启动 Sentry |

- **不要填 PostHog 的 Personal API Key** —— 那是读权限凭证，泄漏后果比写入 token 严重得多。
- 三个键**留空也能正常跑**：对应 backend 不注册，App 照常启动、埋点静默 no-op，
  事件仍然写入 Supabase `app_events`（Layer 1 不依赖任何外部密钥）。跳过时会有一行
  `notice` 级日志，用 Console.app 按 subsystem = bundle id、category = `analytics` 过滤即可确认。
- xcconfig 里 `//` 是注释符，URL 中的 `//` 要写成 `/$()/` 转义（模板文件里有示例）。

## 依赖

- Swift Package：`supabase-swift`（在 Xcode 中 Add Package Dependencies 引入 `Supabase`）。
- 后端：Supabase（`supabase db push` 建表 + 灌 `seed.sql`，`functions deploy` 部署 Edge Functions）。
  离线或后端未就绪时，前端自动使用 `DemoData` 的 5 位种子旅人，社区 / 匹配 / 主页仍可演示。

## 运行

iOS 17+ 模拟器或真机构建运行即可。主线演示：首页发问 → 流式对话 → 岔路口 → 万花筒抽人 → 旅人主页 → ¥9.9 mock 解锁。
