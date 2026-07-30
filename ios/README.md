# Possibility iOS 前端

SwiftUI（iOS 17+，`@Observable`）实现的万花筒前端。**构建 / 真机调试在 macOS 完成**。

`Possibility.xcodeproj` 已入库，但**唯一事实来源是 `project.yml`** —— 改了目录或加了文件后跑
`xcodegen generate` 重新生成工程，不要在 Xcode 里手工调工程设置（会被下次生成覆盖）。

## 目录结构

标准 Xcode 布局：`.xcodeproj` 与 target 同名源码目录平级，测试 target 各自独立成目录。

```
ios/
├─ Possibility.xcodeproj/   由 project.yml 生成（`xcodegen generate`）
├─ Possibility/             ← app target 源码根，与 target 同名
│  ├─ App/                  入口 PossibilityApp · 配置 AppConfig · 导航 Navigation
│  ├─ Core/
│  │  ├─ Analytics/         三层埋点门面 · PostHog · Sentry · app_events 缓冲
│  │  ├─ DesignSystem/      Theme · 组件 · 四个签名动画（Orb/Kaleidoscope/Dial/Waveform）
│  │  ├─ Models/            数据模型 · DemoData（断网兜底种子）
│  │  ├─ Network/           SupabaseService · ChatStreamClient（SSE 流式）
│  │  └─ Utilities/         AsyncTimeout · SupabaseTimestamp
│  ├─ Features/             Home / Chat / Lab / Community / Profile / Auth /
│  │                        CardGame / Diary / Me / Studio（各含 View + Model）
│  ├─ Resources/            Assets.xcassets · Info.plist
│  └─ Possibility.entitlements
├─ PossibilityTests/        单测（Swift Testing）
├─ PossibilityUITests/      UI 测试 · App Store 截图
├─ Config/                  Base.xcconfig（入库）· Config.xcconfig.example
└─ project.yml              工程定义：target / SPM 依赖 / Info.plist 键 / 签名
```

社区头像等共享图片的母版在 `docs/design/assets/`，用 `scripts/sync-assets.sh` 分发进
`Possibility/Resources/Assets.xcassets`，不要直接手改 xcassets 里的图片。

## 配置

前端运行时从 Info.plist 读取后端地址/密钥；**缺省已回落到线上 Supabase 项目**（`gxmruqzcyahjlktshpkh`，anon key 受 RLS 约束、可公开），拉取即可直连云端，无需额外配置。

如需连本地 `supabase start`，再自行覆盖：

1. 复制 `Config/Config.xcconfig.example` → `Config/Config.xcconfig`（真实文件已被 `.gitignore` 忽略）。
2. 填入本地 `SUPABASE_URL`（如 `http://127.0.0.1:54321`）与对应 `SUPABASE_ANON_KEY`。
3. 无需手工点选 —— `Config/Base.xcconfig` 已 `#include?` 该文件，project.yml 的 `configFiles`
   指向 Base.xcconfig，Info.plist 的配置键也由 project.yml 生成。重跑 `xcodegen generate` 即生效。

PostHog / Sentry 为可选观测后端：在同一 `Config.xcconfig` 中填写
`POSTHOG_API_KEY`、`POSTHOG_HOST`、`SENTRY_DSN`。留空时 App 正常运行，
自有 `app_events` 事实表仍会采集。

未配置 xcconfig 时，`AppConfig` 回落到线上项目 `https://gxmruqzcyahjlktshpkh.supabase.co`。

> `ANTHROPIC_API_KEY` **绝不进 App / 仓库**，只存 Supabase Function Secrets（技术设计文档 §5 / §11.1）。

## 依赖

- Swift Package：`supabase-swift`、`posthog-ios`、`sentry-cocoa`
  （均由 `project.yml` 声明，不要在 Xcode 中手工增删）。
- 后端：Supabase（`supabase db push` 建表 + 灌 `seed.sql`，`functions deploy` 部署 Edge Functions）。
  离线或后端未就绪时，前端自动使用 `DemoData` 的 5 位种子旅人，社区 / 匹配 / 主页仍可演示。

## 运行

iOS 17+ 模拟器或真机构建运行即可。主线演示：首页发问 → 流式对话 → 岔路口 → 万花筒抽人 → 旅人主页 → ¥9.9 mock 解锁。
