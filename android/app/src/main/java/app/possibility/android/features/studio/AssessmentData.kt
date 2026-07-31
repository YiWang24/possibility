package app.possibility.android.features.studio

import android.content.Context
import android.content.SharedPreferences
import androidx.compose.ui.graphics.Color

// MARK: - 测评数据（迁移自 iOS AssessmentData.swift · 原型 HOLLAND_ITEMS / DEMO_ASSESSMENTS / BIG_FIVE_FACETS）
//
// 全量复刻：霍兰德 30 题、大五 120 题（30 facet × 4 轮）、优势 15 题、关系 18 题、家庭 20 题。
// 题目文案与 iOS 逐字一致，不得节选。

/** 把 iOS `Color(hex: 0xRRGGBB, alpha:)` 语义迁移到 Compose。 */
internal fun hexColor(value: Long, alpha: Float = 1f): Color {
    val r = ((value shr 16) and 0xFF) / 255f
    val g = ((value shr 8) and 0xFF) / 255f
    val b = (value and 0xFF) / 255f
    return Color(r, g, b, alpha)
}

/** 共享 SharedPreferences（测评进度 + MBTI 徽标），key 与 iOS UserDefaults 语义一致。 */
internal fun studioPrefs(context: Context): SharedPreferences =
    context.getSharedPreferences("kaleido_prefs", Context.MODE_PRIVATE)

/** 测评类型（对应 iOS AssessmentKind）。 */
enum class AssessmentKind(val id: String) {
    HOLLAND("holland"),
    BIGFIVE("bigfive"),
    STRENGTH("strength"),
    LOVE("love"),
    FAMILY("family");

    /** 结果写入的画像维度键（bigfive → 人格底色单独处理，返回 null）。 */
    val targetDimension: String?
        get() = when (this) {
            HOLLAND -> "like"
            STRENGTH -> "skill"
            LOVE -> "love"
            FAMILY -> "family"
            BIGFIVE -> null
        }

    companion object {
        fun fromId(id: String): AssessmentKind? = entries.firstOrNull { it.id == id }
    }
}

data class AssessmentDim(
    val key: String,
    val name: String,
    val label: String,
    /** 0xRRGGBB */
    val color: Long,
    val desc: String,
)

data class AssessmentItem(
    val dim: String,
    val facet: String? = null,
    val text: String,
    val reversed: Boolean = false,
)

data class AssessmentConfig(
    val kind: AssessmentKind,
    val title: String,
    val sub: String,
    val kicker: String,
    val introTitle: String,
    val intro: String,
    val notices: List<String>,
    val resultTitle: String,
    val resultSub: String,
    val saveLabel: String,
    /** 有序维度表 */
    val dims: List<AssessmentDim>,
    val items: List<AssessmentItem>,
    /** 5 点量表标签 */
    val likert: List<String>,
) {
    fun dim(key: String): AssessmentDim = dims.first { it.key == key }
}

/** 大五细分面向：4 条 (题面, 是否反向)。 */
data class Facet(
    val d: String,
    val f: String,
    val name: String,
    val items: List<Pair<String, Boolean>>,
)

object AssessmentData {

    fun config(kind: AssessmentKind): AssessmentConfig = when (kind) {
        AssessmentKind.HOLLAND -> holland
        AssessmentKind.BIGFIVE -> bigfive
        AssessmentKind.STRENGTH -> strength
        AssessmentKind.LOVE -> love
        AssessmentKind.FAMILY -> family
    }

    // MARK: 霍兰德（O*NET Mini-IP，30 题，RIASEC）

    const val hollandMax = 20 // 每维 5 题 × 最高 4 分

    private val hollandRaw: List<Pair<String, String>> = listOf(
        "R" to "制作厨房橱柜", "I" to "研发一种新药", "A" to "创作一本书或一部戏剧", "S" to "帮助他人处理个人或情绪问题", "E" to "管理大型公司中的一个部门", "C" to "为大型计算机网络安装软件",
        "R" to "修理家用电器", "I" to "研究减少水污染的方法", "A" to "作曲或编曲", "S" to "为他人提供职业发展指导", "E" to "创办自己的企业", "C" to "使用计算器进行计算",
        "R" to "组装电子零件", "I" to "进行化学实验", "A" to "为电影制作特效", "S" to "提供康复治疗", "E" to "谈判商业合同", "C" to "整理货物收发记录",
        "R" to "驾驶车辆向办公室和住户配送包裹", "I" to "使用显微镜检查血液样本", "A" to "绘制舞台布景", "S" to "在非营利组织从事志愿工作", "E" to "推广一个新的服装系列", "C" to "使用手持设备盘点物资",
        "R" to "在零件发货前检查其质量", "I" to "研发更准确预测天气的方法", "A" to "为电影或电视节目编写剧本", "S" to "教授高中课程", "E" to "在百货商店销售商品", "C" to "为一个组织分拣和分发邮件",
    )

    val holland = AssessmentConfig(
        kind = AssessmentKind.HOLLAND,
        title = "霍兰德兴趣测评", sub = "兴趣不是能力，也不是职业判决", kicker = "O*NET MINI INTEREST PROFILER",
        introTitle = "哪些活动，\n会让你自然地靠近？",
        intro = "接下来会出现30种活动。请只回答“喜欢不喜欢”，不要考虑自己现在会不会、薪资高不高或别人怎么看。",
        notices = listOf("这是霍兰德RIASEC模型的官方移动短版", "结果描述兴趣，不代表能力、资格或命定职业", "中文内容为产品验证中的翻译版本", "答案会保存在当前设备，可随时退出继续"),
        resultTitle = "兴趣画像", resultSub = "正式量表来源 · O*NET Mini-IP", saveLabel = "将这组兴趣信号保存到我的画像",
        dims = listOf(
            AssessmentDim("R", "实际型", "动手实践", 0x7DB5A0, "你容易被可以操作、制作和解决现场问题的活动吸引。"),
            AssessmentDim("I", "研究型", "深度探索", 0x789EFF, "你容易投入分析证据、追根究底和理解复杂问题的活动。"),
            AssessmentDim("A", "艺术型", "创意表达", 0xD785C8, "你更愿意在审美、想象和开放表达中形成自己的作品。"),
            AssessmentDim("S", "社会型", "理解与帮助", 0xE99B78, "你容易从支持、教学、沟通和帮助他人成长中获得意义。"),
            AssessmentDim("E", "企业型", "影响推动", 0xD9B563, "你对发起、谈判、组织资源和推动目标更容易产生兴趣。"),
            AssessmentDim("C", "常规型", "秩序组织", 0x8F91B8, "你更喜欢规则清楚、细节可靠和可以持续优化的工作方式。"),
        ),
        items = hollandRaw.map { AssessmentItem(dim = it.first, text = it.second) },
        likert = listOf("非常不喜欢", "不喜欢", "不确定", "喜欢", "非常喜欢"),
    )

    /** 双字母兴趣组合叙事（原型 hollandNarrative）。 */
    val hollandPairNarrative: Map<String, String> = mapOf(
        "RI" to "你喜欢先弄清原理，再把想法变成可以工作的东西。",
        "RA" to "你在材料、技术和表达之间寻找创造的实感。",
        "IA" to "你容易在分析与想象之间建立新的解释。",
        "IS" to "你希望理解复杂问题，也希望这些理解能真正帮助到人。",
        "AS" to "表达和连接对你同样重要，你更愿意让创作抵达别人。",
        "AE" to "你不只喜欢产生想法，也容易被传播和推动它们吸引。",
        "SE" to "你更享受与人协作，并把共同目标向前推动。",
        "SC" to "你愿意用稳定、可靠的方式支持人的需要。",
        "EC" to "目标、资源和流程的组织容易激发你的投入感。",
        "IC" to "你擅长被复杂信息吸引，并愿意把它整理成可靠结构。",
    )

    // MARK: 大五人格（120 题 = 30 facet × 4 轮）

    val bigFiveFacets: List<Facet> = listOf(
        Facet("N", "N1", "焦虑", listOf("我常为事情担心" to false, "我容易设想最坏的结果" to false, "许多事情会让我感到害怕" to false, "我很容易感到压力" to false)),
        Facet("E", "E1", "友善", listOf("我很容易结交新朋友" to false, "和别人在一起时我通常很自在" to false, "我会避免与别人接触" to true, "我习惯和别人保持距离" to true)),
        Facet("O", "O1", "想象力", listOf("我的想象力很丰富" to false, "我喜欢不受拘束地幻想" to false, "我喜欢做白日梦" to false, "我喜欢沉浸在自己的思绪中" to false)),
        Facet("A", "A1", "信任", listOf("我通常愿意信任别人" to false, "我相信大多数人抱有善意" to false, "我愿意相信别人说的话" to false, "我很难信任别人" to true)),
        Facet("C", "C1", "效能感", listOf("我能成功完成交给自己的任务" to false, "我通常能把自己做的事情做好" to false, "我能顺利处理大多数任务" to false, "我知道怎样把事情办成" to false)),
        Facet("N", "N2", "易怒", listOf("我很容易生气" to false, "我很容易被惹恼" to false, "我有时会控制不住脾气" to false, "我通常不会轻易恼火" to true)),
        Facet("E", "E2", "合群", listOf("我喜欢热闹的大型聚会" to false, "在聚会上我会和许多不同的人交谈" to false, "我更喜欢独处" to true, "我会避开拥挤的人群" to true)),
        Facet("O", "O2", "艺术兴趣", listOf("我相信艺术很重要" to false, "我能看到别人可能忽略的美" to false, "我不喜欢诗歌" to true, "我不享受参观美术馆或展览" to true)),
        Facet("A", "A2", "真诚", listOf("我会利用别人达到自己的目的" to true, "为了占优势，我可能会作弊" to true, "我会占别人的便宜" to true, "我会故意阻碍别人的计划" to true)),
        Facet("C", "C2", "条理", listOf("我喜欢整理和收拾东西" to false, "我常忘记把东西放回原位" to true, "我的房间或工作区经常很乱" to true, "我经常把物品随手乱放" to true)),
        Facet("N", "N3", "低落", listOf("我常感到情绪低落" to false, "我有时不喜欢自己" to false, "我经常提不起精神" to false, "我通常能自在地接纳自己" to true)),
        Facet("E", "E3", "主导性", listOf("需要时我会主动负责" to false, "我会尝试带领别人" to false, "我倾向主动掌控事情的进展" to false, "我通常等别人先带头" to true)),
        Facet("O", "O3", "情感丰富", listOf("我的情绪体验很强烈" to false, "我能感受到别人的情绪" to false, "我很少留意自己的情绪反应" to true, "我难以理解情绪反应强烈的人" to true)),
        Facet("A", "A3", "利他", listOf("我关心别人的处境" to false, "我喜欢帮助别人" to false, "我对别人的感受漠不关心" to true, "我不愿意为别人花时间" to true)),
        Facet("C", "C3", "责任感", listOf("我会遵守自己的承诺" to false, "我重视诚实地说出事实" to false, "我会随意破坏规则" to true, "我经常违背自己答应的事情" to true)),
        Facet("N", "N4", "社交敏感", listOf("我觉得主动接近别人很困难" to false, "我害怕成为别人注意的焦点" to false, "只有和熟人在一起时我才真正放松" to false, "困难的社交场合通常不会困扰我" to true)),
        Facet("E", "E4", "活跃度", listOf("我总让自己保持忙碌" to false, "我经常处于行动状态" to false, "空闲时间里我也会做很多事情" to false, "我喜欢放慢节奏、轻松度日" to true)),
        Facet("O", "O4", "冒险性", listOf("比起固定惯例，我更喜欢变化" to false, "我更愿意坚持自己熟悉的事物" to true, "我不喜欢变化" to true, "我很依恋传统的做法" to true)),
        Facet("A", "A4", "合作", listOf("我喜欢和别人激烈争斗" to true, "我会对别人大喊大叫" to true, "我会用言语羞辱别人" to true, "别人伤害我后，我会想办法报复" to true)),
        Facet("C", "C4", "成就追求", listOf("我常愿意做得比要求更多" to false, "我工作时很努力" to false, "我很少为工作投入时间和精力" to true, "我往往只做到刚好过关" to true)),
        Facet("N", "N5", "冲动", listOf("我有时会毫无节制地放纵自己" to false, "我很少过度放纵" to true, "我通常能抵抗诱惑" to true, "我能够控制自己的强烈欲望" to true)),
        Facet("E", "E5", "寻求刺激", listOf("我喜欢刺激的体验" to false, "我会主动寻找冒险" to false, "我有时享受不计后果的感觉" to false, "我偶尔喜欢表现得疯狂而不受拘束" to false)),
        Facet("O", "O5", "思辨", listOf("我喜欢阅读有挑战性的内容" to false, "我会避开哲学性的讨论" to true, "我较难理解抽象观念" to true, "我对理论讨论不感兴趣" to true)),
        Facet("A", "A5", "谦逊", listOf("我认为自己比别人更优秀" to true, "我对自己的评价非常高" to true, "我常觉得自己高人一等" to true, "我会向别人夸耀自己的优点" to true)),
        Facet("C", "C5", "自律", listOf("我通常会提前做好准备" to false, "我会执行自己制定的计划" to false, "我经常把时间浪费掉" to true, "我很难开始应该完成的任务" to true)),
        Facet("N", "N6", "脆弱性", listOf("我很容易陷入慌乱" to false, "事情一多我就容易不知所措" to false, "我有时觉得自己应付不了问题" to false, "压力之下我通常能保持冷静" to true)),
        Facet("E", "E6", "积极情绪", listOf("我经常流露出愉快的情绪" to false, "我生活中有许多快乐时刻" to false, "我热爱生活" to false, "我习惯看到事情积极的一面" to false)),
        Facet("O", "O6", "观念开放", listOf("我倾向支持更开放的社会观念" to false, "我认为是非并不总有绝对答案" to false, "我更倾向维护传统保守的社会观念" to true, "我认为对违规行为通常应采取强硬惩罚" to true)),
        Facet("A", "A6", "同理心", listOf("我会同情无家可归的人" to false, "我会为处境比自己艰难的人感到难过" to false, "我对别人的困难不感兴趣" to true, "我会刻意不去想处境困难的人" to true)),
        Facet("C", "C6", "审慎", listOf("我常没想清楚就直接行动" to true, "我有时会做出草率决定" to true, "我容易仓促行事" to true, "我会不经思考就采取行动" to true)),
    )

    val bigfive: AssessmentConfig = run {
        val items: List<AssessmentItem> = (0 until 4).flatMap { round ->
            bigFiveFacets.map { facet ->
                AssessmentItem(
                    dim = facet.d,
                    facet = facet.f,
                    text = facet.items[round].first,
                    reversed = facet.items[round].second,
                )
            }
        }
        AssessmentConfig(
            kind = AssessmentKind.BIGFIVE,
            title = "大五人格", sub = "五个维度都是光谱", kicker = "PERSONALITY PROFILE",
            introTitle = "你通常如何\n感受、思考与行动？",
            intro = "请按照过去一年里大多数时候的真实状态回答，而不是理想中的自己。完成后会看到五个主要维度和三十个细分面向。",
            notices = listOf("完整版共120题，通常需要15–20分钟", "结果展示五维连续分数，不把你分成固定类型", "答案保存在当前设备，原始答案默认私密"),
            resultTitle = "人格底色", resultSub = "大五人格", saveLabel = "保存为我的人格底色",
            dims = listOf(
                AssessmentDim("O", "开放", "好奇开放", 0x8FA4FF, "愿意接触新观点、想象与复杂体验"),
                AssessmentDim("C", "尽责", "可靠有序", 0x6FD0B0, "倾向规划、自律并把事情完成"),
                AssessmentDim("E", "外向", "主动联结", 0xE7B86D, "容易从互动、表达和行动中获得能量"),
                AssessmentDim("A", "宜人", "体谅合作", 0xE58BBF, "重视理解、信任与合作"),
                AssessmentDim("N", "情绪敏感", "情绪敏锐", 0xA997DB, "更容易觉察压力、担忧与情绪波动"),
            ),
            items = items,
            likert = listOf("非常不符合", "比较不符合", "不确定", "比较符合", "非常符合"),
        )
    }

    /** 大五低分端标签（原型 demoResultTags low 表）。 */
    val bigfiveLowLabels: Map<String, String> = mapOf(
        "O" to "务实聚焦", "C" to "灵活随性", "E" to "安静蓄能", "A" to "独立判断", "N" to "情绪稳定",
    )

    fun facetMeta(f: String): Facet? = bigFiveFacets.firstOrNull { it.f == f }

    // MARK: 优势证据探索（15 题）

    val strength = AssessmentConfig(
        kind = AssessmentKind.STRENGTH,
        title = "优势证据探索", sub = "不需要先知道答案，也不依赖关键词选择", kicker = "STRENGTH EVIDENCE · SITUATIONAL DEMO",
        introTitle = "先看你会怎么做，\n再反推你可能擅长什么。",
        intro = "这里不要求你先声明“我擅长什么”。请判断下面这些真实工作与生活情境有多像你，系统会从重复出现的行为证据中提炼优势信号。",
        notices = listOf("15题情境判断，可直接开始", "结果是待验证的优势假设，不是能力证明", "建议之后补充一段真实经历来增强可信度"),
        resultTitle = "优势画像", resultSub = "行为证据 · Demo 探索版", saveLabel = "把优势信号写入“我擅长”",
        dims = listOf(
            AssessmentDim("structure", "结构", "结构化思考", 0x7F9EFF, "把复杂信息拆开、整理并建立清楚路径"),
            AssessmentDim("empathy", "共情", "理解他人", 0xE88FB9, "觉察感受与立场，帮助对话继续"),
            AssessmentDim("expression", "表达", "清晰表达", 0xC394E8, "把模糊想法转化为别人能理解的语言或画面"),
            AssessmentDim("execution", "推进", "推动落地", 0xE7B36C, "协调资源、处理阻力并把事情向前推进"),
            AssessmentDim("learning", "学习", "快速学习", 0x67CBAE, "从反馈中抓住规律并迁移到新问题"),
        ),
        items = listOf(
            AssessmentItem(dim = "structure", text = "信息混乱时，我会自然地给它们分类并找出主线"),
            AssessmentItem(dim = "empathy", text = "两个人争执时，我常能听出双方真正担心什么"),
            AssessmentItem(dim = "expression", text = "别人听不懂时，我能换一种说法或画法继续解释"),
            AssessmentItem(dim = "execution", text = "计划卡住时，我会找到下一步可执行的小动作"),
            AssessmentItem(dim = "learning", text = "接触新工具后，我能较快摸清它的基本规律"),
            AssessmentItem(dim = "structure", text = "面对复杂任务，我会先明确目标、限制和优先级"),
            AssessmentItem(dim = "empathy", text = "团队气氛微妙变化时，我通常能较早觉察"),
            AssessmentItem(dim = "expression", text = "我能把长篇内容压缩成重点，又不丢掉关键含义"),
            AssessmentItem(dim = "execution", text = "需要多人配合时，我会主动确认责任和时间点"),
            AssessmentItem(dim = "learning", text = "一次失败后，我通常能总结出下次可调整的办法"),
            AssessmentItem(dim = "structure", text = "我喜欢发现看似无关信息之间的关系"),
            AssessmentItem(dim = "empathy", text = "别人表达不完整时，我能用提问帮他把想法说清楚"),
            AssessmentItem(dim = "expression", text = "我对措辞、叙事或视觉呈现是否准确比较敏感"),
            AssessmentItem(dim = "execution", text = "即使条件不完美，我也能先做出可验证的版本"),
            AssessmentItem(dim = "learning", text = "我能把一个领域学到的方法迁移到另一个问题上"),
        ),
        likert = listOf("非常不符合", "比较不符合", "不确定", "比较符合", "非常符合"),
    )

    // MARK: 关系安全感（18 题）

    val love = AssessmentConfig(
        kind = AssessmentKind.LOVE,
        title = "关系安全感与靠近方式", sub = "理解需要，不评判依恋类型", kicker = "RELATIONSHIP SECURITY · DEMO CONSTRUCT VERSION",
        introTitle = "当关系变重要时，\n你会怎样靠近或保护自己？",
        intro = "请想象一段对你重要的亲密关系，按照你真实的反应回答。题目参考依恋焦虑与回避构念重新编写，仅用于 Demo 自我探索。",
        notices = listOf("18题，观察安全感需求与距离调节", "高低都不是好坏，而是不同的保护方式", "结果不用于诊断，也不替代真实关系中的沟通"),
        resultTitle = "恋爱关系画像", resultSub = "亲密关系构念 · Demo 改写版", saveLabel = "写入“我在恋爱关系中在意”",
        dims = listOf(
            AssessmentDim("anxiety", "确认需要", "及时回应", 0xEC8C86, "关系不确定时，更需要清晰回应与稳定确认"),
            AssessmentDim("avoidance", "距离需要", "尊重边界", 0x8EA1D8, "关系靠近时，更重视自主空间与不被侵入"),
        ),
        items = listOf(
            AssessmentItem(dim = "anxiety", text = "对方回复变慢时，我会担心自己不再重要"),
            AssessmentItem(dim = "avoidance", text = "关系太亲密时，我会担心失去自己的空间"),
            AssessmentItem(dim = "anxiety", text = "发生矛盾后，如果问题悬着，我很难安心做别的事"),
            AssessmentItem(dim = "avoidance", text = "我不太习惯把最脆弱的感受交给伴侣"),
            AssessmentItem(dim = "anxiety", text = "我需要对方明确表达在乎，而不只是让我自己猜"),
            AssessmentItem(dim = "avoidance", text = "遇到压力时，我通常更想自己消化而不是寻求伴侣支持"),
            AssessmentItem(dim = "anxiety", text = "关系出现距离时，我容易反复回想是不是自己做错了什么"),
            AssessmentItem(dim = "avoidance", text = "即使关系很好，我也需要保留不被追问的私人部分"),
            AssessmentItem(dim = "anxiety", text = "我能相信对方即使暂时忙碌也不会离开", reversed = true),
            AssessmentItem(dim = "avoidance", text = "我可以坦然依靠伴侣，也允许伴侣依靠我", reversed = true),
            AssessmentItem(dim = "anxiety", text = "对方语气细微变化会明显影响我的安全感"),
            AssessmentItem(dim = "avoidance", text = "谈到长期承诺时，我有时会本能地想后退"),
            AssessmentItem(dim = "anxiety", text = "我担心自己投入得比对方更多"),
            AssessmentItem(dim = "avoidance", text = "我不喜欢伴侣知道我所有的需要"),
            AssessmentItem(dim = "anxiety", text = "冲突后得到一个明确的修复动作对我很重要"),
            AssessmentItem(dim = "avoidance", text = "即使意见不同，我也能在关系中保持亲近", reversed = true),
            AssessmentItem(dim = "anxiety", text = "我通常确信自己值得被稳定地爱", reversed = true),
            AssessmentItem(dim = "avoidance", text = "表达依赖会让我觉得自己失去了主动权"),
        ),
        likert = listOf("非常不符合", "比较不符合", "不确定", "比较符合", "非常符合"),
    )

    // MARK: 家庭关系与期待（20 题）

    val family = AssessmentConfig(
        kind = AssessmentKind.FAMILY,
        title = "家庭关系与期待", sub = "看见你想守住的家庭价值", kicker = "FAMILY VALUES · DEMO CONSTRUCT VERSION",
        introTitle = "在家人之间，\n什么让你感觉这是“家”？",
        intro = "请按照你真正期待的家庭关系回答，而不是判断原生家庭好坏。题目参考家庭凝聚、沟通、边界、责任与自主构念重新编写。",
        notices = listOf("20题，覆盖五个家庭关系维度", "测的是你的期待与偏好，不给家庭贴标签", "结果可继续用自定义关键词修正"),
        resultTitle = "家庭价值画像", resultSub = "家庭关系构念 · Demo 改写版", saveLabel = "写入“我在家庭关系中在意”",
        dims = listOf(
            AssessmentDim("cohesion", "支持", "彼此支持", 0x6FD1B1, "重要时刻能够互相靠近并提供实际支持"),
            AssessmentDim("communication", "沟通", "坦诚沟通", 0x7FA7E8, "问题能被说出来，也能被认真听见"),
            AssessmentDim("boundary", "边界", "尊重边界", 0xA796D8, "亲近不等于控制，允许保留个人空间"),
            AssessmentDim("responsibility", "责任", "共同承担", 0xE3B26E, "家庭责任清楚、公平且说到做到"),
            AssessmentDim("autonomy", "自主", "允许不同选择", 0xE68FAD, "家人可以拥有不同道路而不被否定"),
        ),
        items = listOf(
            AssessmentItem(dim = "cohesion", text = "遇到真正困难时，家人愿意放下分歧一起面对"),
            AssessmentItem(dim = "communication", text = "不舒服的事情可以直接说，而不用靠猜或冷战"),
            AssessmentItem(dim = "boundary", text = "家人会先征求意见，再介入彼此的个人决定"),
            AssessmentItem(dim = "responsibility", text = "照顾、家务和经济责任应当被清楚讨论"),
            AssessmentItem(dim = "autonomy", text = "即使选择不同，家人也应尊重彼此的人生方向"),
            AssessmentItem(dim = "cohesion", text = "重要时刻有人在场，比表面的热闹更重要"),
            AssessmentItem(dim = "communication", text = "家里应该允许表达脆弱，而不被嘲笑或指责"),
            AssessmentItem(dim = "boundary", text = "亲密关系里也应该保留隐私和独处空间"),
            AssessmentItem(dim = "responsibility", text = "答应家人的事情应该尽量做到"),
            AssessmentItem(dim = "autonomy", text = "爱不应该以服从为前提"),
            AssessmentItem(dim = "cohesion", text = "家人之间的支持应当包括实际行动，而不只是口头关心"),
            AssessmentItem(dim = "communication", text = "发生冲突后，愿意回来修复比假装没事更重要"),
            AssessmentItem(dim = "boundary", text = "家人不应通过愧疚感来迫使彼此答应要求"),
            AssessmentItem(dim = "responsibility", text = "承担更多的人也应该有权表达疲惫和需要"),
            AssessmentItem(dim = "autonomy", text = "成年人有权决定自己的伴侣、工作和生活方式"),
            AssessmentItem(dim = "cohesion", text = "即使不常联系，也应让彼此知道需要时可以求助"),
            AssessmentItem(dim = "communication", text = "家人之间应该说清期待，而不是把“你应该懂”当作规则"),
            AssessmentItem(dim = "boundary", text = "关心一个人不代表可以替他做所有决定"),
            AssessmentItem(dim = "responsibility", text = "家庭里的付出需要被看见，而不是被当作理所当然"),
            AssessmentItem(dim = "autonomy", text = "家庭和睦不意味着所有人必须想法一致"),
        ),
        likert = listOf("非常不符合", "比较不符合", "不确定", "比较符合", "非常符合"),
    )

    // MARK: MBTI

    val mbtiTypes = listOf(
        "ISTJ", "ISFJ", "INFJ", "INTJ", "ISTP", "ISFP", "INFP", "INTP",
        "ESTP", "ESFP", "ENFP", "ENTP", "ESTJ", "ESFJ", "ENFJ", "ENTJ",
    )
}
