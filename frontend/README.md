# Kaleido · 万花筒 KALEIDO iOS 前端

SwiftUI（iOS 17+，`@Observable`）实现的万花筒前端。源码在 Linux 侧产出，**Xcode 组装 / 构建 / 真机在 macOS 完成**（本仓库不含 `.xcodeproj` / `Package.swift`，由 Mac 侧生成）。

## 目录结构

```
frontend/
├─ App/            入口 KaleidoApp · 配置 AppConfig · 导航 Navigation
├─ Core/
│  ├─ DesignSystem/  Theme · 组件 · 四个签名动画（Orb/Kaleidoscope/Dial/Waveform）
│  ├─ Models/        数据模型 · DemoData（断网兜底种子）
│  └─ Network/       SupabaseService · ChatStreamClient（SSE 流式）
└─ Features/       Home / Chat / Lab / Community / Profile（各含 View + Model）
```

## 配置（首次拉取必做）

前端**不写死任何后端地址或密钥**，运行时从 Info.plist 读取。拉取后需自行配置：

1. 复制 `Config.xcconfig.example` → `Config.xcconfig`（真实文件已被 `.gitignore` 忽略）。
2. 填入你的 Supabase 项目 `SUPABASE_URL` 与 `SUPABASE_ANON_KEY`（anon key 受 RLS 约束、可公开）。
3. Xcode target → Build Settings，将 Configuration 指向该 xcconfig；在 Info.plist 增加键
   `SUPABASE_URL = $(SUPABASE_URL)`、`SUPABASE_ANON_KEY = $(SUPABASE_ANON_KEY)`。

未配置时，`AppConfig` 回落到本地 `http://127.0.0.1:54321`（配合 `supabase start`）。

> `ANTHROPIC_API_KEY` **绝不进 App / 仓库**，只存 Supabase Function Secrets（技术设计文档 §5 / §11.1）。

## 依赖

- Swift Package：`supabase-swift`（在 Xcode 中 Add Package Dependencies 引入 `Supabase`）。
- 后端：Supabase（`supabase db push` 建表 + 灌 `seed.sql`，`functions deploy` 部署 Edge Functions）。
  离线或后端未就绪时，前端自动使用 `DemoData` 的 5 位种子旅人，社区 / 匹配 / 主页仍可演示。

## 运行

iOS 17+ 模拟器或真机构建运行即可。主线演示：首页发问 → 流式对话 → 岔路口 → 万花筒抽人 → 旅人主页 → ¥9.9 mock 解锁。
