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

## 发布到 TestFlight

```bash
doppler run --project possibility --config prd -- scripts/gen-xcconfig.sh   # 注入密钥
scripts/ios-testflight.sh                                                   # 归档 → 导出 → 上传
```

签名事实（都在 `project.yml` 里，不要在 Xcode 里手改，`xcodegen generate` 会覆盖）：

| 项 | 值 |
|---|---|
| Team | `985WPAR345` |
| Bundle ID | `com.possibility.possibility`（测试 target 为其 `.tests` / `.uitests` 子级） |
| 签名方式 | 自动（`CODE_SIGN_STYLE = Automatic`），两个配置都用 `Apple Development` |

### 为什么归档用的是开发身份

分发签名由 `xcodebuild -exportArchive` 按 `ios/ExportOptions.plist`（method
`app-store-connect`）统一重签 —— 这正是 Xcode Organizer「Distribute App」的原生流程。
命令行 `xcodebuild archive` 的自动签名**只会解析开发描述文件**，钉成 `Apple Distribution`
会直接报「automatically signed for development ... conflicting identity」。

**不要试图跳过归档签名**（`CODE_SIGN_IDENTITY = ""` 或 `CODE_SIGNING_ALLOWED=NO`）。
实测过：那样导出的 ipa 本地 `codesign --verify --deep --strict` 全绿，上传却被
App Store Connect 以 **90035 Invalid Signature** 拒掉，报错直指
`Possibility.app/Frameworks/Sentry.framework/Sentry`；换成正经签名的归档后，同一条
导出上传链路一次通过。

（值得记一笔：两次导出产物里 `Sentry.framework` 的 `codesign -dvvv` 输出是一样的
——同为 `Identifier=io.sentry.Sentry`、`hashes=2+3`、Apple Distribution 签发。
所以差异不在这个框架的最终签名本身，本地无从复现，只能靠上传结果判定。
`Sentry` 是 binaryTarget 预编译 xcframework，包里那个 49KB 二进制只是承载
`PrivacyInfo.xcprivacy` 的桩，Sentry 真正的代码静态链进了 app 主二进制。）

手动签名也不可行，两个硬约束：分发证书是云托管的，本机钥匙串里没有私钥
（`No "iOS Distribution" signing certificate ... with a private key was found`）；
Store 描述文件是 Xcode 托管的，手动模式不允许引用。

### 前置：团队里至少有一台已注册设备

开发描述文件必须包含至少一台已注册设备，否则归档直接失败
（`Your team has no devices from which to generate a provisioning profile`）。
`-allowProvisioningUpdates` **不会**自动注册设备 —— Xcode GUI 会弹窗问，命令行只会
报 `Device "..." isn't registered in your developer account` 然后退出。

团队当前已注册 `Xiao Mi 17 Pro Max`（iPhone 14 Pro）。再加设备走
developer.apple.com/account → Devices，或用 API：

```bash
curl -X POST https://api.appstoreconnect.apple.com/v1/devices \
  -H "Authorization: Bearer <JWT>" -H "Content-Type: application/json" \
  -d '{"data":{"type":"devices","attributes":{"name":"<名字>","platform":"IOS","udid":"<UDID>"}}}'
```

真机 destination 若报 `The developer disk image could not be mounted`，先跑一次
`xcrun devicectl device info processes --device <UDID>` 强制挂载调试镜像，再重试。

### 构建号

同一版本号下构建号必须唯一，重传前递增：

```bash
BUILD_NUMBER=2 scripts/ios-testflight.sh
```

### 凭证

签名与上传都走 App Store Connect API Key，本地和 CI 同一套。三个值存在
Doppler `possibility/prd`：`ASC_KEY_ID`、`ASC_ISSUER_ID`、`ASC_KEY_P8`。

本地：把 `.p8` 放到 `~/.appstoreconnect/private_keys/AuthKey_<KEY_ID>.p8`（权限 600），
然后

```bash
export ASC_KEY_ID=... ASC_ISSUER_ID=...
scripts/ios-testflight.sh
```

文件名不能改 —— `altool` 不接受任意路径，只在几个固定目录里按 `AuthKey_<id>.p8` 找。

三件套缺任何一个，脚本整体回落到 Xcode 已登录账号（本机能跑，CI 上必失败）；
上传还可回落到 `ASC_APPLE_ID` + `ASC_APP_PASSWORD`（App 专用密码）。

> `ASC_*` 已加进 `scripts/doppler-sync.sh` 的排除前缀：签名私钥不该被同步进
> Supabase Edge Function Secrets。新增同类凭据请沿用 `ASC_` 前缀。

### CI

`.github/workflows/ios.yml`：push 到 main 且改动落在 `ios/**` 时自动跑，也可手动触发。
唯一的 GitHub secret 是 `DOPPLER_TOKEN`（与 `deploy.yml` 共用），其余由 `doppler run` 注入。
构建号取 `github.run_number`。

⚠️ CI 上用的是自动签名 + API Key，每次 runner 都是全新钥匙串，Xcode 会**新建一张
开发证书**。Apple 对开发证书有数量上限，跑得频繁会撞上限。真到那一步，
把证书导成 `.p12` 存进 Doppler、CI 里导入临时钥匙串并改用手动签名
（即 fastlane match 的做法）。
