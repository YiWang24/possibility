package app.possibility.android

import android.app.Application
import app.possibility.android.core.network.SupabaseService
import io.github.jan.supabase.SupabaseClient
import io.github.jan.supabase.auth.Auth
import io.github.jan.supabase.createSupabaseClient
import io.github.jan.supabase.functions.Functions
import io.github.jan.supabase.postgrest.Postgrest
import io.github.jan.supabase.realtime.Realtime
import io.github.jan.supabase.serializer.KotlinXSerializer

class PossibilityApp : Application() {

    lateinit var supabase: SupabaseClient
        private set

    override fun onCreate() {
        super.onCreate()
        supabase = createSupabaseClient(
            supabaseUrl = BuildConfig.SUPABASE_URL,
            supabaseKey = BuildConfig.SUPABASE_ANON_KEY,
        ) {
            // PostgREST 解码与 Edge Function 共用一套宽容 JSON 配置
            defaultSerializer = KotlinXSerializer(SupabaseService.json)
            install(Auth)
            install(Postgrest)
            install(Functions)
            install(Realtime)
        }
        SupabaseService.init(supabase)
    }
}
