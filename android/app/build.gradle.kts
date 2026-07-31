plugins {
  alias(libs.plugins.android.application)
  alias(libs.plugins.kotlin.android)
  alias(libs.plugins.kotlin.compose)
  alias(libs.plugins.kotlin.serialization)
}

// Supabase 配置必须由构建环境注入。优先读取 Gradle 属性，其次读取环境变量：
// doppler run -- ./gradlew assembleDebug
// ./gradlew assembleDebug -PSUPABASE_URL=... -PSUPABASE_ANON_KEY=...
// 本地联调也必须注入 HTTPS 端点，避免调试包放宽全局明文流量策略。
val supabaseUrl = providers.gradleProperty("SUPABASE_URL")
  .orElse(providers.environmentVariable("SUPABASE_URL"))
  .getOrElse("")
val supabaseAnonKey = providers.gradleProperty("SUPABASE_ANON_KEY")
  .orElse(providers.environmentVariable("SUPABASE_ANON_KEY"))
  .getOrElse("")

android {
  namespace = "app.possibility.android"
  compileSdk = 35

  defaultConfig {
    applicationId = "app.possibility.android"
    minSdk = 26
    targetSdk = 35
    versionCode = 1
    versionName = "0.1.0"

    buildConfigField("String", "SUPABASE_URL", "\"$supabaseUrl\"")
    buildConfigField("String", "SUPABASE_ANON_KEY", "\"$supabaseAnonKey\"")
  }

  buildTypes {
    release {
      isMinifyEnabled = true
      proguardFiles(getDefaultProguardFile("proguard-android-optimize.txt"), "proguard-rules.pro")
    }
  }

  buildFeatures {
    compose = true
    buildConfig = true
  }

  compileOptions {
    sourceCompatibility = JavaVersion.VERSION_17
    targetCompatibility = JavaVersion.VERSION_17
  }

  kotlinOptions {
    jvmTarget = "17"
  }
}

dependencies {
  implementation(libs.androidx.core.ktx)
  implementation(libs.androidx.activity.compose)
  implementation(libs.androidx.lifecycle.runtime.compose)
  implementation(libs.androidx.lifecycle.viewmodel.compose)

  implementation(platform(libs.compose.bom))
  implementation(libs.compose.ui)
  implementation(libs.compose.material3)
  implementation(libs.compose.material.icons.extended)
  implementation(libs.compose.ui.tooling.preview)
  debugImplementation(libs.compose.ui.tooling)

  implementation(libs.kotlinx.serialization.json)

  implementation(platform(libs.supabase.bom))
  implementation(libs.supabase.postgrest)
  implementation(libs.supabase.auth)
  implementation(libs.supabase.functions)
  implementation(libs.supabase.realtime)
  implementation(libs.ktor.client.okhttp)

  testImplementation(libs.junit)
}
