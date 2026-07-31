package app.possibility.android.core.model

import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable
import kotlinx.serialization.builtins.ListSerializer
import kotlinx.serialization.builtins.serializer

// 我的公开主页数据模型（原型 DEFAULT_MY_PROFILE / MY_PROFILE_KEY）
// 对应 ios/Possibility/Core/Models/MyProfileModels.swift。
// 本地缓存作为离线兜底；公开字段同步到 public_profiles。

@Serializable
data class MyProfile(
    val name: String,
    /** 头像色相（Theme.hue 0–4） */
    val hue: Int,
    val quote: String,
    val tags: List<String>,
    val bio: String,
    val traj: List<TimelineNode>,
    val adviceModules: List<AdviceModule>,
    val services: List<ServiceOffer>,
    val meta: Meta,
) {
    /** wire 键为 {age,t,d}（与 travelers.trajectory 一致） */
    @Serializable
    data class TimelineNode(
        val age: String,
        val t: String,
        val d: String,
    )

    @Serializable
    data class AdviceModule(
        val id: String,
        val title: String,
        val content: String,
        val links: List<Link>,
    ) {
        @Serializable
        data class Link(
            val label: String,
            val url: String,
        )
    }

    @Serializable
    data class ServiceOffer(
        val id: String,
        val enabled: Boolean,
        val type: String,
        val title: String,
        val price: String,
        val desc: String,
    )

    @Serializable
    data class Meta(
        val age: Int,
        val city: String,
        val from: String,
        val to: String,
        val years: String,
        val result: String,
        val consulted: Int,
        val response: String,
        val intro: String,
        val full: String,
    )

    companion object {
        val defaultProfile = MyProfile(
            name = "", hue = 4, quote = "", tags = emptyList(), bio = "", traj = emptyList(),
            adviceModules = emptyList(), services = emptyList(),
            meta = Meta(
                age = 0, city = "", from = "", to = "", years = "", result = "",
                consulted = 0, response = "", intro = "", full = "",
            ),
        )
    }

    /** 上行 payload（SupabaseService.savePublicProfileRemote 用），profile_version 固定 2 */
    val remotePayload: RemotePublicProfile
        get() = RemotePublicProfile(
            profileVersion = 2,
            name = name, quote = quote, bio = bio, avatarUrl = null,
            tags = tags, trajectory = traj, services = services,
            advice = adviceModules,
            hue = hue, age = meta.age, city = meta.city,
            fromRole = meta.from, toRole = meta.to,
            stage = meta.years, result = meta.result,
            storyIntro = meta.intro, storyFull = meta.full,
        )

    /** 用远端字段覆盖本地模型（远端缺失/空字段保留本地值，不破坏本地持久化语义） */
    fun merging(remote: RemotePublicProfile): MyProfile {
        var merged = this
        remote.name?.let { merged = merged.copy(name = it) }
        remote.quote?.let { merged = merged.copy(quote = it) }
        remote.bio?.let { merged = merged.copy(bio = it) }
        remote.tags?.let { merged = merged.copy(tags = it) }
        remote.trajectory?.let { merged = merged.copy(traj = it) }
        remote.services?.let { merged = merged.copy(services = it) }
        remote.advice?.let { merged = merged.copy(adviceModules = it) }
        remote.hue?.let { if (it in 0..4) merged = merged.copy(hue = it) }
        remote.age?.let { if (it in 0..150) merged = merged.copy(meta = merged.meta.copy(age = it)) }
        remote.city?.let { merged = merged.copy(meta = merged.meta.copy(city = it)) }
        remote.fromRole?.let { merged = merged.copy(meta = merged.meta.copy(from = it)) }
        remote.toRole?.let { merged = merged.copy(meta = merged.meta.copy(to = it)) }
        remote.stage?.let { merged = merged.copy(meta = merged.meta.copy(years = it)) }
        remote.result?.let { merged = merged.copy(meta = merged.meta.copy(result = it)) }
        remote.storyIntro?.let { merged = merged.copy(meta = merged.meta.copy(intro = it)) }
        remote.storyFull?.let { merged = merged.copy(meta = merged.meta.copy(full = it)) }
        return merged
    }
}

// MARK: - 远端映射（public_profiles 表 ↔ MyProfile）
//
// 上行：POST /save-profile action=save_public_profile（save-profile/index.ts 逐字段透传）。
// 下行：GET /get-profile 的 public_profile 字段（select("*")，未建档时为 null）。

/**
 * public_profiles 行的 wire 模型（profile_version 2）。
 * trajectory/services/advice jsonb 直接复用 MyProfile 嵌套结构的编码形状：
 * trajectory=[{age,t,d}]，services=[{id,enabled,type,title,price,desc}]，
 * advice=[{id,title,content,links:[{label,url}]}]。
 * jsonb 子结构解码失败时逐字段降级为 null，不让整体失败（Lenient*Serializer）。
 */
@Serializable
data class RemotePublicProfile(
    @SerialName("profile_version") val profileVersion: Int? = null,
    val name: String? = null,
    val quote: String? = null,
    val bio: String? = null,
    @SerialName("avatar_url") val avatarUrl: String? = null,
    @Serializable(with = LenientStringListSerializer::class)
    val tags: List<String>? = null,
    @Serializable(with = LenientTimelineListSerializer::class)
    val trajectory: List<MyProfile.TimelineNode>? = null,
    @Serializable(with = LenientServiceOfferListSerializer::class)
    val services: List<MyProfile.ServiceOffer>? = null,
    @Serializable(with = LenientAdviceModuleListSerializer::class)
    val advice: List<MyProfile.AdviceModule>? = null,
    val hue: Int? = null,
    val age: Int? = null,
    val city: String? = null,
    @SerialName("from_role") val fromRole: String? = null,
    @SerialName("to_role") val toRole: String? = null,
    val stage: String? = null,
    val result: String? = null,
    @SerialName("story_intro") val storyIntro: String? = null,
    @SerialName("story_full") val storyFull: String? = null,
)

object LenientStringListSerializer :
    LenientFieldSerializer<List<String>>(ListSerializer(String.serializer()))

object LenientTimelineListSerializer :
    LenientFieldSerializer<List<MyProfile.TimelineNode>>(ListSerializer(MyProfile.TimelineNode.serializer()))

object LenientServiceOfferListSerializer :
    LenientFieldSerializer<List<MyProfile.ServiceOffer>>(ListSerializer(MyProfile.ServiceOffer.serializer()))

object LenientAdviceModuleListSerializer :
    LenientFieldSerializer<List<MyProfile.AdviceModule>>(ListSerializer(MyProfile.AdviceModule.serializer()))
