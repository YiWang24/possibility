# Possibility · Android

Kotlin + Jetpack Compose + [supabase-kt](https://github.com/supabase-community/supabase-kt)，与 iOS/Web/灵光共用同一 Supabase 后端。

## 环境要求

- JDK 17+
- Android Studio（或命令行 Android SDK，`ANDROID_HOME` 已配置）
- Doppler CLI（变量注入）

## 首次构建

本目录未提交 Gradle Wrapper，首次需生成（任选其一）：

```bash
# Android Studio 打开 android/ 会自动处理；或命令行：
cd android
gradle wrapper --gradle-version 8.11.1
```

## 开发

```bash
# Doppler 注入 SUPABASE_URL / SUPABASE_ANON_KEY 后构建
doppler run -- ./gradlew assembleDebug
```

- 未注入变量时 debug 默认连模拟器宿主机本地栈 `http://10.0.2.2:54321`（先 `supabase start`）
- 明文 HTTP 仅 debug 变体允许（见 `app/src/debug/AndroidManifest.xml`）
- Supabase 配置经 `BuildConfig.SUPABASE_URL` / `BuildConfig.SUPABASE_ANON_KEY` 读取
