package app.possibility.android.core

import app.possibility.android.BuildConfig

/** 全局配置，对应 ios/Possibility/App/AppConfig.swift。 */
object AppConfig {

    val supabaseUrl: String = BuildConfig.SUPABASE_URL.trimEnd('/')
    val supabaseAnonKey: String = BuildConfig.SUPABASE_ANON_KEY

    fun functionUrl(name: String): String = "$supabaseUrl/functions/v1/$name"

    object Price {
        const val UNLOCK_PROFILE = 9.9
        const val CONSULT = 29.0
        const val COMPANION = 599.0
    }

    object Threshold {
        const val PORTRAIT_INITIAL_PCT = 60
        const val MAX_MESSAGE_LENGTH = 2000
        const val MAX_ASK_LENGTH = 200
        val SIM_YEAR_RANGE = 1..10
        const val SIM_DEFAULT_YEARS = 5
    }

    object Copy {
        const val APP_NAME = "Possibility"
        const val APP_NAME_EN = "POSSIBILITY"
        const val SIM_DISCLAIMER = "推演不是预言，是一面镜子"
    }
}
