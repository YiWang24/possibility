package app.possibility.android.features.lab

import android.content.Context
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.AltRoute
import androidx.compose.material.icons.filled.Balance
import androidx.compose.material.icons.filled.Bolt
import androidx.compose.material.icons.filled.Brush
import androidx.compose.material.icons.filled.Build
import androidx.compose.material.icons.filled.Edit
import androidx.compose.material.icons.filled.Extension
import androidx.compose.material.icons.filled.Favorite
import androidx.compose.material.icons.filled.FlightTakeoff
import androidx.compose.material.icons.filled.Forum
import androidx.compose.material.icons.filled.Groups
import androidx.compose.material.icons.filled.Home
import androidx.compose.material.icons.filled.HourglassEmpty
import androidx.compose.material.icons.filled.Layers
import androidx.compose.material.icons.filled.MenuBook
import androidx.compose.material.icons.filled.PauseCircle
import androidx.compose.material.icons.filled.Payments
import androidx.compose.material.icons.filled.PushPin
import androidx.compose.material.icons.filled.RadioButtonUnchecked
import androidx.compose.material.icons.filled.Science
import androidx.compose.material.icons.filled.Search
import androidx.compose.material.icons.filled.Shield
import androidx.compose.material.icons.filled.Spa
import androidx.compose.material.icons.filled.Undo
import androidx.compose.material.icons.filled.Visibility
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import androidx.compose.ui.graphics.vector.ImageVector
import app.possibility.android.core.model.ExploreTopic
import app.possibility.android.core.model.SimulationHorizon
import app.possibility.android.core.model.SimulationResult
import app.possibility.android.core.network.SupabaseService
import kotlinx.coroutines.coroutineScope
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch
import kotlinx.coroutines.withTimeoutOrNull
import kotlinx.serialization.Serializable
import kotlinx.serialization.encodeToString
import kotlinx.serialization.json.Json

// 人生实验室视图模型 —— 对应 ios/Possibility/Features/Lab/LabModel.swift。
//
// POST /lab-choices 按问题生成动态选择卡；转盘设时间跨度（14 档 SimulationHorizon）+ 选择卡
// (+ 底线卡 carry_cards) → POST /simulate → {general, optimistic, cautionary} 三结局
// + bottom_line_analysis + recommended_traveler_ids。lab-choices 失败一律报错，绝不以 mock 掩盖。

/**
 * 卡面图标语义表（对应 ios CardIcon.swift）。lab-choices 的 glyph 交给模型自由发挥，
 * 拿回来的是彩色 emoji，字重/配色不受控。这里把图标收敛成有限语义键：服务端只给键，
 * 端上统一决定用哪个单色符号；模型给不出合法键（含历史 emoji）时按中文关键词兜底。
 */
enum class CardIcon {
    STAY, DEEPEN, PIVOT, RETREAT,
    EXPLORE, EXPERIMENT, LEARN, BUILD, CREATE, LEAP,
    CONNECT, SPEAK,
    RELOCATE, REST, PAUSE, OBSERVE, TIMING,
    HYBRID, BALANCE, SECURE,
    MONEY, HOME, HEALTH,
    CUSTOM, UNKNOWN;

    /** 语义键 → 单色符号（Material Icons，对齐 iOS SF Symbol 选型）。 */
    val vector: ImageVector
        get() = when (this) {
            STAY -> Icons.Filled.PushPin
            DEEPEN -> Icons.Filled.Layers
            PIVOT -> Icons.Filled.AltRoute
            RETREAT -> Icons.Filled.Undo
            EXPLORE -> Icons.Filled.Search
            EXPERIMENT -> Icons.Filled.Science
            LEARN -> Icons.Filled.MenuBook
            BUILD -> Icons.Filled.Build
            CREATE -> Icons.Filled.Brush
            LEAP -> Icons.Filled.Bolt
            CONNECT -> Icons.Filled.Groups
            SPEAK -> Icons.Filled.Forum
            RELOCATE -> Icons.Filled.FlightTakeoff
            REST -> Icons.Filled.Spa
            PAUSE -> Icons.Filled.PauseCircle
            OBSERVE -> Icons.Filled.Visibility
            TIMING -> Icons.Filled.HourglassEmpty
            HYBRID -> Icons.Filled.Extension
            BALANCE -> Icons.Filled.Balance
            SECURE -> Icons.Filled.Shield
            MONEY -> Icons.Filled.Payments
            HOME -> Icons.Filled.Home
            HEALTH -> Icons.Filled.Favorite
            CUSTOM -> Icons.Filled.Edit
            UNKNOWN -> Icons.Filled.RadioButtonUnchecked
        }

    val key: String get() = name.lowercase()

    companion object {
        /** 中文关键词兜底表；词要够长以避免误伤（用「转岗」而不是「转」）。 */
        private val keywords: Map<CardIcon, List<String>> = mapOf(
            STAY to listOf("留在", "留下", "维持现状", "保持现状", "按兵不动", "原地", "坚守", "守住", "现有岗位", "不换"),
            DEEPEN to listOf("深耕", "精进", "打磨", "专精", "钻研", "沉淀", "积累", "做深", "扎根", "内功"),
            PIVOT to listOf("转岗", "转型", "转行", "换赛道", "跳槽", "换方向", "调岗", "换岗", "转做", "切换到", "换一条"),
            RETREAT to listOf("退回", "止损", "撤回", "退出", "保留退路", "回到原", "回头", "放弃"),
            EXPLORE to listOf("调研", "打听", "摸底", "探索", "考察", "访谈", "搜集", "问清", "了解清楚"),
            EXPERIMENT to listOf("试验", "实验", "小步", "试水", "验证", "试点", "跑通", "先试", "试一", "小规模", "原型"),
            LEARN to listOf("学习", "进修", "补课", "读书", "考证", "上课", "培训", "自学", "课程", "念书"),
            BUILD to listOf("搭建", "动手", "开发", "落地", "做出", "从零做", "工程化", "写代码"),
            CREATE to listOf("创作", "设计", "写作", "作品", "创造", "策展", "表达自己"),
            LEAP to listOf("全力", "孤注", "梭哈", "放手一搏", "破釜", "彻底转", "一次性", "重注", "下决心"),
            CONNECT to listOf("人脉", "内推", "社群", "圈子", "合作", "搭档", "团队", "伙伴", "引荐", "牵线", "认识人"),
            SPEAK to listOf("沟通", "协商", "争取", "谈一谈", "提出", "对话", "反馈", "摊牌", "说清楚"),
            RELOCATE to listOf("换城市", "异地", "出国", "远程", "外派", "搬到", "去外地", "迁移"),
            REST to listOf("休息", "休整", "恢复", "放慢", "慢下来", "调整节奏", "喘口气", "减负", "间隔年"),
            PAUSE to listOf("暂缓", "暂停", "缓一", "先不", "推迟", "延后", "搁置", "等等再"),
            OBSERVE to listOf("观望", "先看", "再看看", "静观", "观察", "不表态", "等信号"),
            TIMING to listOf("时机", "窗口期", "再等", "熬过", "期限", "倒计时", "时间换"),
            HYBRID to listOf("混合", "兼职", "副业", "跨界", "双线", "并行", "两边都", "同时做", "复合"),
            BALANCE to listOf("平衡", "取舍", "权衡", "折中", "兼顾", "分配精力"),
            SECURE to listOf("保底", "稳住", "兜底", "底线", "保障", "稳定", "备份", "抗风险"),
            MONEY to listOf("收入", "薪资", "涨薪", "降薪", "现金", "储蓄", "财务", "预算", "成本", "养家"),
            HOME to listOf("家庭", "家人", "父母", "孩子", "伴侣", "陪伴", "生育", "婚"),
            HEALTH to listOf("健康", "身体", "体力", "睡眠", "精力", "锻炼", "透支"),
        )

        /** 服务端语义键 → 图标；键不合法（含历史 emoji）时按文案做关键词兜底。 */
        fun resolve(key: String?, title: String, desc: String): CardIcon {
            val normalized = key?.trim()?.lowercase()
            if (!normalized.isNullOrEmpty()) {
                entries.firstOrNull { it.key == normalized }?.let { return it }
            }
            return match(title, desc) ?: UNKNOWN
        }

        /** 标题命中优先于描述：标题写的是这张卡的意图，描述只是把它展开。 */
        fun match(title: String, desc: String): CardIcon? = match(title) ?: match(desc)

        /** 关键词命中最长者胜：「转岗体验」取更具体的那个。 */
        fun match(text: String): CardIcon? {
            var best: Pair<CardIcon, Int>? = null
            for ((icon, words) in keywords) {
                for (word in words) {
                    if (text.contains(word) && (best == null || word.length > best!!.second)) {
                        best = icon to word.length
                    }
                }
            }
            return best?.first
        }
    }
}

/** 自定义选择卡的持久化载荷（SharedPreferences JSON）。 */
@Serializable
private data class StoredChoice(
    val icon: String? = null,
    val name: String,
    val desc: String,
    val isCustom: Boolean = true,
    val color: String? = null,
)

class LabModel(private val context: Context) {

    /** 选择卡（LLM 动态卡 / 用户自定义卡）。 */
    data class Choice(
        val icon: CardIcon,
        val name: String,
        val desc: String,
        val isCustom: Boolean = false,
        /** LLM 卡的 CSS 颜色（#RRGGBB / rgba(...)）；null 走默认卡面视觉 */
        val color: String? = null,
    ) {
        val id: String get() = name
    }

    /** 底线卡（原型 carry-section / CARRY_META）。 */
    data class CarryCard(
        val id: String,
        val icon: CardIcon,
        val name: String,
        val source: String,
        /** 最坏结果里的底线风险描述（floor test） */
        val risk: String,
    )

    /** 打开结果页时冻结的上下文（问题 / 选择 / 时间跨度 / 底线卡）。 */
    data class ResultContext(
        val question: String,
        val choice: String,
        val horizon: SimulationHorizon,
        val carry: List<String>,
    )

    // MARK: 问题卡
    var question by mutableStateOf(ExploreTopic.CAREER.sampleQuestion)
    var editing by mutableStateOf(false)
    var draft by mutableStateOf("")

    // MARK: 选择 & 时间旋钮
    var pick by mutableStateOf<String?>(null)
        private set
    var horizon by mutableStateOf(SimulationHorizon.YEAR5)

    // MARK: 推演
    var loading by mutableStateOf(false)
        private set
    var loadStep by mutableIntStateOf(0)
        private set
    /** 非 null 时呈现 ResultSheet（携带完整 /simulate 出参）。 */
    var result by mutableStateOf<SimulationResult?>(null)
    var resultContext by mutableStateOf(ResultContext("", "", SimulationHorizon.YEAR5, emptyList()))
        private set

    // MARK: 选择卡状态
    var customChoices by mutableStateOf<List<Choice>>(emptyList())
        private set
    var remoteChoices by mutableStateOf<List<Choice>>(emptyList())
        private set
    var choicesLoading by mutableStateOf(false)
        private set
    /** API 失败时交给视图弹 toast；绝不以 mock 数据掩盖失败。 */
    var errorMessage by mutableStateOf<String?>(null)

    /** 请求代际：问题更换后丢弃过期响应。 */
    private var choicesRequestID = 0

    val choices: List<Choice> get() = remoteChoices + customChoices

    // MARK: 底线卡
    /** 一起带走的底线卡 id（最多 3 张）。 */
    var carry by mutableStateOf<List<String>>(emptyList())
        private set

    val canSim: Boolean get() = pick != null && !loading

    init {
        loadCustom()
    }

    // MARK: 自定义卡持久化

    private fun loadCustom() {
        val raw = prefs().getString(CUSTOM_STORE_KEY, null) ?: return
        val saved = runCatching { prefsJson.decodeFromString<List<StoredChoice>>(raw) }.getOrNull() ?: return
        customChoices = saved.map { stored ->
            Choice(
                icon = CardIcon.resolve(stored.icon, stored.name, stored.desc),
                name = stored.name,
                desc = stored.desc,
                isCustom = stored.isCustom,
                color = stored.color,
            )
        }
    }

    private fun persistCustom() {
        val payload = customChoices.map {
            StoredChoice(icon = it.icon.key, name = it.name, desc = it.desc, isCustom = it.isCustom, color = it.color)
        }
        runCatching { prefs().edit().putString(CUSTOM_STORE_KEY, prefsJson.encodeToString<List<StoredChoice>>(payload)).apply() }
    }

    /** 加入自定义选择卡；名称/描述都要填、不能重名。返回新卡或 null（校验失败）。 */
    fun addCustomChoice(name: String, desc: String): Choice? {
        val n = name.trim().take(18)
        val d = desc.trim().take(42)
        if (n.isEmpty() || d.isEmpty() || choices.any { it.name == n }) return null
        // 用户自己写的卡也过一遍语义匹配，匹配不上再落到「手写卡」图标。
        val choice = Choice(icon = CardIcon.match(n, d) ?: CardIcon.CUSTOM, name = n, desc = d, isCustom = true)
        customChoices = customChoices + choice
        pick = choice.name
        persistCustom()
        return choice
    }

    fun removeCustomChoice(name: String) {
        customChoices = customChoices.filterNot { it.name == name }
        if (pick == name) pick = null
        persistCustom()
    }

    // MARK: 动态选择卡（POST /lab-choices，仅真实 API，30s 超时）

    /** 按当前问题生成动态选择卡；每次调用都重新请求真实 API。 */
    suspend fun loadChoices() {
        val q = question
        choicesRequestID += 1
        val requestID = choicesRequestID
        choicesLoading = true
        errorMessage = null
        remoteChoices = emptyList()
        pick = null

        // lab-choices 正常约 8~12s，真机叠加 TLS/蜂窝更高；30s 上限覆盖正常波动，真正挂起才落到错误态。
        val response = withTimeoutOrNull(30_000) {
            runCatching { SupabaseService.shared.labChoices(question = q) }.getOrNull()
        }

        // 已有更新的请求在跑：本次结果整体作废（loading 由新请求收尾）。
        if (requestID != choicesRequestID) return
        choicesLoading = false

        val cards = response?.cards
        // 问题已更换 / 请求失败 / 超时：保持空状态，明确提示，不展示 mock。
        if (q != question || cards.isNullOrEmpty()) {
            errorMessage = "选择卡生成失败，请检查网络后重试"
            return
        }

        val seen = customChoices.map { it.name }.toMutableSet()
        val mapped = mutableListOf<Choice>()
        for (card in cards) {
            val name = card.title.trim().take(18)
            val desc = card.description.trim().take(42)
            if (name.isEmpty() || desc.isEmpty() || !seen.add(name)) continue
            mapped.add(
                Choice(
                    icon = CardIcon.resolve(card.glyph, name, desc),
                    name = name,
                    desc = desc,
                    color = card.color,
                ),
            )
        }
        // 卡片全部被去重/清洗过滤：等同 API 返回无效。
        if (mapped.isEmpty()) {
            errorMessage = "选择卡生成结果无效，请重试"
            return
        }
        remoteChoices = mapped
    }

    // MARK: 交互

    fun pickChoice(name: String) {
        pick = name
    }

    fun clearChoice() {
        pick = null
    }

    fun beginEdit() {
        draft = question
        editing = true
    }

    fun saveEdit() {
        val clean = draft.trim()
        if (clean.isNotEmpty()) question = clean
        editing = false
    }

    /** 底线卡开关；满 3 张时返回提示文案。 */
    fun toggleCarry(id: String): String? {
        if (carry.contains(id)) {
            carry = carry.filterNot { it == id }
        } else if (carry.size < 3) {
            carry = carry + id
        } else {
            return "最多带走 3 张底线卡"
        }
        return null
    }

    // MARK: 推演（POST /simulate）

    suspend fun runSim() {
        val chosen = pick ?: return
        if (loading) return
        loading = true
        loadStep = 0
        errorMessage = null
        val service = SupabaseService.shared

        coroutineScope {
            // 加载步骤动画与网络请求并行；请求返回即收尾，不等步骤跑满。
            val steps = launch { runLoadingSteps() }
            try {
                val carryNames = carry.mapNotNull { carryCard(it)?.name }
                val remote = service.simulateFull(
                    question = question,
                    choice = chosen,
                    horizon = horizon,
                    carryCards = carryNames.ifEmpty { null },
                )
                // 服务端会按本次问题实时生成并入库几位旅人，直接回传完整对象——并入缓存，便于点开卡片进主页。
                remote.recommendedTravelers?.takeIf { it.isNotEmpty() }?.let { service.mergeTravelers(it) }
                resultContext = ResultContext(question, chosen, horizon, carry.toList())
                result = remote
            } catch (e: Exception) {
                errorMessage = "推演 API 调用失败，请检查网络后重试"
            } finally {
                steps.cancel()
            }
        }
        loading = false
    }

    private suspend fun runLoadingSteps() {
        for (step in loadSteps.indices) {
            loadStep = step
            delay(750)
        }
    }

    private fun prefs() = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)

    companion object {
        private const val PREFS_NAME = "kaleido_lab_prefs"
        private const val CUSTOM_STORE_KEY = "kaleido_custom_choices_v1"

        private val prefsJson = Json {
            ignoreUnknownKeys = true
            encodeDefaults = true
        }

        val loadSteps = listOf(
            "读取你的动态画像……",
            "匹配 1,842 位相似旅人的经历……",
            "折出三种可能的未来……",
        )

        /** 携带卡 6 张固定（收入/健康/关系/手艺/创作/退路）。 */
        val carryCards: List<CarryCard> = listOf(
            CarryCard("income", CardIcon.MONEY, "稳定收入", "对话线索",
                "转型不顺时，收入可能在一段时间内下降，生活安全感受到直接冲击。"),
            CarryCard("health", CardIcon.HEALTH, "身体不透支", "日记线索",
                "反复尝试与加倍学习可能挤压睡眠和恢复时间，身体先替选择支付代价。"),
            CarryCard("relation", CardIcon.CONNECT, "重要关系", "关系画像",
                "压力与时间投入可能让你减少陪伴，也可能加剧家人对这次改变的不理解。"),
            CarryCard("craft", CardIcon.DEEPEN, "专业积累", "职业画像",
                "最差情况下，新岗位没有站稳，原有专业身份也因中断而需要重新证明。"),
            CarryCard("creation", CardIcon.CREATE, "创造实感", "动态画像",
                "你可能进入一个更偏协调和推进的岗位，却发现真正动手创造的时刻反而更少。"),
            CarryCard("exit", CardIcon.RETREAT, "保留退路", "风险预案",
                "如果投入过深、现金流下降或履历断裂，回到原路径的成本会明显升高。"),
        )

        fun carryCard(id: String): CarryCard? = carryCards.firstOrNull { it.id == id }
    }
}
