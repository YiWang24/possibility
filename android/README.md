# Possibility · Android

Kotlin + Jetpack Compose + [supabase-kt](https://github.com/supabase-community/supabase-kt)，以 iOS 版为标准全量复刻，与 iOS/Web 共用同一 Supabase 后端与契约。

## 环境要求

- JDK 17 或 21（当前 Kotlin/Gradle 组合尚不支持 JDK 25）
- Android SDK（`ANDROID_HOME` 已配置；compileSdk 35，minSdk 26）
- 可选 Doppler CLI（覆盖后端配置时使用）

## 构建

Gradle Wrapper 已随仓库提交：

```bash
cd android
./gradlew assembleDebug        # 产出 app/build/outputs/apk/debug/app-debug.apk
./gradlew compileDebugKotlin   # 仅编译校验
```

- 构建环境必须注入 Supabase URL 与 anon key；CI 从 GitHub Actions secrets 读取，本地推荐经 Doppler 注入
- 本地联调：通过 HTTPS tunnel 暴露本机 Supabase，再用 `SUPABASE_URL=<https-url> SUPABASE_ANON_KEY=<local> ./gradlew assembleDebug` 注入；调试包同样禁止明文 HTTP
- 也可以通过 `-PSUPABASE_URL=... -PSUPABASE_ANON_KEY=...` 注入；Gradle 属性优先于环境变量
- 配置经 `BuildConfig.SUPABASE_URL` / `BuildConfig.SUPABASE_ANON_KEY` 读取（见 `app/build.gradle.kts`），仓库不提供生产配置回退值

## 架构

- **入口**：`MainActivity` → `ui/RootView.kt`（根状态机：Splash → AuthWall → MainTab，4 Tab：认识你自己 / 人生实验室 / 万花筒社区 / 我的主页）
- **状态**：Compose `mutableStateOf` + `StateFlow`，各功能模块自持轻量 Model，不引入 DI 框架
- **跨 Tab 路由**：`core/AppRouter.kt`（`AppRouter.openLab(q)`、`ToastCenter`）
- **强制深色 + 竖屏**，设计 token 全量对齐 iOS `Theme.swift`（`core/theme/Theme.kt`）

### 目录

```
core/
  theme/Theme.kt          设计系统（色板/渐变/Hue/圆角/kaleidoCard）
  AppConfig.kt            Supabase URL/Key、functionUrl、Price/Threshold/Copy
  AppRouter.kt            跨 Tab 路由 + ToastCenter
  model/                  UserModels / ContentModels / MyProfileModels / DemoData（wire 对齐 snake_case）
  network/
    SupabaseService.kt    单例数据层：Auth、PostgREST 直读、Edge Function 裸 POST、60s 画像缓存
    ChatStreamClient.kt   SSE 流式对话客户端（{"t":…}/done/error）
features/
  auth/       登录墙 + 邮箱注册/登录 + AuthGate 闸门
  home/       首页：语音日记卡(SpeechRecognizer 转写)、提问卡、6 维画像、Persona Canvas
  diary/      日记：日/月/年三视图（list-diary 分页真实记录 + diary-summary）
  chat/       流式对话：clarify→review→correction→ready 阶段机 + match 旅人卡
  lab/        人生实验室：14 档时间旋钮 + lab-choices 动态选项 + simulate 三场景结果
  community/  社区：推荐/Watch 拖拽网格、万花筒抽取、悬赏列表/详情/发帖
  me/         我的：Hero+4 Tab、编辑、隐私中心（facts/提案/回执/可见性/清空）
  profile/    旅人主页 4 Tab + 付费墙（mock 解锁 insert unlocks）
  cardgame/   人生卡牌：大厅 + 引擎状态机 + 四玩法 + card-game-session 同步
  studio/     画像工坊 + 6 类测评（holland/bigfive/strength/love/family/social）+ 喜欢×擅长完整探索
```

## 与 iOS 的平台差异

- 语音转写用 Android `SpeechRecognizer`（zh-CN）；不可用或未识别到内容时明确要求重录/文字输入，不写入示例内容；情绪与关键词只来自 `analyze-diary`
- 登录仅邮箱+密码（Apple 登录为 iOS 专属，未移植）
- 付费为 mock（直接 insert `unlocks` 表）；生产需接 Play Billing
- Edge Function 调用复刻 iOS 契约：`Authorization: Bearer {jwt}` + `apikey` + `X-Request-ID`，180s 超时，统一错误体 `{error:{code,message},request_id}`

## 状态

`./gradlew assembleDebug` 通过，产出可安装的 debug APK。UI 尚未在真机/模拟器上做交互回归。
