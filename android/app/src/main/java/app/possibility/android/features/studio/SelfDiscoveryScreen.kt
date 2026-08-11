package app.possibility.android.features.studio

import androidx.activity.compose.BackHandler
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.systemBarsPadding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.BasicTextField
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.KeyboardArrowLeft
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Icon
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateMapOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.SolidColor
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import app.possibility.android.core.ToastCenter
import app.possibility.android.core.network.SupabaseService
import app.possibility.android.core.theme.Theme
import kotlinx.coroutines.launch
import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.encodeToJsonElement
import kotlinx.serialization.json.jsonObject

// MARK: - 喜欢 × 擅长完整探索（与 Web / iOS 共用同一套中文原创题目）

@Serializable
enum class DiscoveryAxis {
    @SerialName("like") LIKE,
    @SerialName("skill") SKILL,
    @SerialName("evidence") EVIDENCE,
    @SerialName("environment") ENVIRONMENT,
    @SerialName("choice") CHOICE,
    @SerialName("value") VALUE,
    @SerialName("open") OPEN,
}

@Serializable
enum class DiscoveryKind { @SerialName("interest") INTEREST, @SerialName("strength") STRENGTH, @SerialName("select") SELECT, @SerialName("environment") ENVIRONMENT, @SerialName("choice") CHOICE, @SerialName("open") OPEN }

data class DiscoveryOption(val label: String, val tag: String, val glyph: String)
data class DiscoveryQuestion(
    val id: String,
    val axis: DiscoveryAxis,
    val eyebrow: String,
    val title: String,
    val hint: String,
    val options: List<DiscoveryOption>,
    val kind: DiscoveryKind = DiscoveryKind.SELECT,
    val tag: String? = null,
    val left: String? = null,
    val right: String? = null,
)

@Serializable
data class DiscoveryAnswer(val selected: List<String> = emptyList(), val custom: List<String> = emptyList(), val like: Int? = null, val skill: Int? = null, val scale: Int? = null, val text: String? = null)

@Serializable
data class RankedDiscoveryTag(val tag: String, val count: Int)

@Serializable
data class DiscoveryInsight(val label: String, val evidence: String, val reason: String)

@Serializable
data class DiscoveryDirection(
    val title: String,
    val why: String,
    @SerialName("first_step") val firstStep: String,
)

@Serializable
data class SelfDiscoveryAnalysis(
    val summary: String,
    val likes: List<DiscoveryInsight>,
    val strengths: List<DiscoveryInsight>,
    val directions: List<DiscoveryDirection>,
    @SerialName("confidence_note") val confidenceNote: String,
)

@Serializable
data class SelfDiscoveryRequest(
    val responses: List<Response>,
    val evidence: Evidence,
) {
    @Serializable
    data class Response(
        val id: String,
        val axis: DiscoveryAxis,
        val kind: DiscoveryKind,
        val question: String,
        val tag: String? = null,
        val left: String? = null,
        val right: String? = null,
        val response: DiscoveryAnswer,
    )

    @Serializable
    data class Evidence(
        val likes: List<RankedDiscoveryTag>,
        val strengths: List<RankedDiscoveryTag>,
        val values: List<RankedDiscoveryTag>,
        val energy: List<String> = emptyList(),
        val environment: List<String> = emptyList(),
    )
}

object SelfDiscoveryData {
    private fun q(
        id: String,
        axis: DiscoveryAxis,
        eyebrow: String,
        title: String,
        hint: String,
        vararg rows: Triple<String, String, String>,
    ) = DiscoveryQuestion(id, axis, eyebrow, title, hint, rows.map { DiscoveryOption(it.first, it.second, it.third) })

    private val legacyQuestions = listOf(
        q("like-pull", DiscoveryAxis.LIKE, "喜欢的事 · 自然靠近", "没有任务和评价时，你会主动靠近什么？", "选 1–3 项，也可以写下选项之外的真实答案。",
            Triple("内容、画面、音乐或故事", "创造与表达", "✦"), Triple("一个值得追到底的问题", "知识与探索", "◎"), Triple("人的经历、感受与关系", "人类与连接", "♡"), Triple("工具、流程与系统如何运作", "系统与优化", "▦"), Triple("社会变化与真实影响", "影响与推动", "↗"), Triple("自然、身体与动手体验", "实践与体验", "◇")),
        q("like-flow", DiscoveryAxis.LIKE, "喜欢的事 · 心流证据", "哪些活动曾让你忘记时间？", "回想真实发生过的时刻，不选“理想中应该喜欢”的事。",
            Triple("把想法做成作品", "创造与表达", "✦"), Triple("阅读、研究或拆解原理", "知识与探索", "◎"), Triple("深聊、陪伴或理解别人", "人类与连接", "♡"), Triple("整理、规划或持续改进", "系统与优化", "▦"), Triple("组织大家完成一件事", "影响与推动", "↗"), Triple("制作、运动或走进自然", "实践与体验", "◇")),
        q("like-invest", DiscoveryAxis.LIKE, "喜欢的事 · 投入意愿", "你愿意持续把时间或金钱花在哪里？", "真正的兴趣通常会留下持续投入的痕迹。",
            Triple("创作工具、审美与表达训练", "创造与表达", "✦"), Triple("课程、书籍与新知识", "知识与探索", "◎"), Triple("社群、关系与助人体验", "人类与连接", "♡"), Triple("效率工具、方法与系统", "系统与优化", "▦"), Triple("项目、公共议题与行动", "影响与推动", "↗"), Triple("手作、旅行、运动与体验", "实践与体验", "◇")),
        q("like-admire", DiscoveryAxis.LIKE, "喜欢的事 · 羡慕线索", "你最容易羡慕哪种人的日常？", "羡慕不等于要成为对方，它可能提示你想靠近的内容世界。",
            Triple("持续输出独特作品的人", "创造与表达", "✦"), Triple("不断发现和解释新知的人", "知识与探索", "◎"), Triple("真正理解并改善他人处境的人", "人类与连接", "♡"), Triple("把复杂事物变得清晰高效的人", "系统与优化", "▦"), Triple("召集别人创造真实变化的人", "影响与推动", "↗"), Triple("以身体和双手探索世界的人", "实践与体验", "◇")),
        q("like-learn", DiscoveryAxis.LIKE, "喜欢的事 · 好奇方向", "即使短期没有回报，你仍想学什么？", "先把职业名称放在一边，只看你想持续理解的对象。",
            Triple("叙事、视觉、音乐或设计", "创造与表达", "✦"), Triple("科学、技术、历史或思想", "知识与探索", "◎"), Triple("心理、教育、沟通或关系", "人类与连接", "♡"), Triple("商业、产品、流程或组织", "系统与优化", "▦"), Triple("领导力、社会创新或公共议题", "影响与推动", "↗"), Triple("自然、工艺、运动或生活实践", "实践与体验", "◇")),
        q("skill-asked", DiscoveryAxis.SKILL, "擅长的事 · 他人证据", "别人通常会来找你帮什么忙？", "擅长常是你觉得普通、别人却认为可靠的行为方式。",
            Triple("想点子或打开新角度", "创意生成", "✦"), Triple("快速摸清陌生领域", "快速学习", "◎"), Triple("听懂没被说出口的需要", "共情连接", "♡"), Triple("把混乱信息理出主线", "结构化思考", "▦"), Triple("找到下一步并推动完成", "推动落地", "↗"), Triple("直接动手排查和解决", "实践解决", "◇")),
        q("skill-natural", DiscoveryAxis.SKILL, "擅长的事 · 自然反应", "面对一个混乱问题，你会自然先做什么？", "不是问应该怎么做，而是你往往不假思索就会怎么做。",
            Triple("提出几种不同可能", "创意生成", "✦"), Triple("边做边学并找到规律", "快速学习", "◎"), Triple("理解每个人真正担心什么", "共情连接", "♡"), Triple("拆目标、约束与优先级", "结构化思考", "▦"), Triple("拉齐分工、时间和下一步", "推动落地", "↗"), Triple("先做一个能验证的版本", "实践解决", "◇")),
        q("skill-success", DiscoveryAxis.SKILL, "擅长的事 · 成功模式", "过去做成一件事时，你最常贡献什么？", "寻找多次成功背后重复出现的行为，而不只是职位和技能名。",
            Triple("给出别人没想到的方案", "创意生成", "✦"), Triple("从反馈中迅速学会", "快速学习", "◎"), Triple("让不同的人愿意继续对话", "共情连接", "♡"), Triple("把复杂问题讲清楚", "结构化思考", "▦"), Triple("让卡住的事情重新前进", "推动落地", "↗"), Triple("把问题真正修好或做出来", "实践解决", "◇")),
        q("skill-effortless", DiscoveryAxis.SKILL, "擅长的事 · 低耗能优势", "哪些事你做起来不太费力，却常得到好反馈？", "优势不是“永远轻松”，而是相较别人更自然、更容易复现。",
            Triple("迅速联想到新表达或新方案", "创意生成", "✦"), Triple("短时间抓住新事物重点", "快速学习", "◎"), Triple("察觉气氛并让人安心", "共情连接", "♡"), Triple("归纳信息并清楚表达", "结构化思考", "▦"), Triple("协调资源并按时交付", "推动落地", "↗"), Triple("试出来、修出来、做出来", "实践解决", "◇")),
        q("skill-friction", DiscoveryAxis.SKILL, "擅长的事 · 过度使用", "你最常因为哪种“做得太多”被提醒？", "优势用过头也会制造摩擦，这类反馈常藏着可用的能力。",
            Triple("想法太多、容易跳出原方案", "创意生成", "✦"), Triple("总想再查清楚、再学一点", "快速学习", "◎"), Triple("太在意别人感受", "共情连接", "♡"), Triple("过度分析、追求逻辑完整", "结构化思考", "▦"), Triple("推进太快、总想立即行动", "推动落地", "↗"), Triple("不爱空谈、习惯先动手", "实践解决", "◇")),
        q("value-discomfort", DiscoveryAxis.VALUE, "价值观 · 不适线索", "看到什么状态时，你最容易感到不舒服？", "这部分帮助 AI 判断你为何喜欢某件事，不会代替“喜欢”和“擅长”的结果。",
            Triple("表达被限制、没有选择", "自由与创造", "✦"), Triple("停止成长、拒绝求真", "成长与求真", "◎"), Triple("人被忽略、关系缺少理解", "关怀与连接", "♡"), Triple("混乱低效、规则不透明", "秩序与清晰", "▦"), Triple("明知能改变却无人行动", "影响与担当", "↗"), Triple("脱离现实、只有概念没有体验", "真实与实践", "◇")),
        q("value-contribution", DiscoveryAxis.VALUE, "价值观 · 贡献方向", "你希望自己的投入最终带来什么？", "这会作为组合“喜欢 × 擅长”时的判断标准。",
            Triple("让人拥有更多表达与选择", "自由与创造", "✦"), Triple("让知识和成长更容易发生", "成长与求真", "◎"), Triple("让人被看见、理解和支持", "关怀与连接", "♡"), Triple("让复杂世界更清晰有序", "秩序与清晰", "▦"), Triple("推动值得发生的真实变化", "影响与担当", "↗"), Triple("创造可触摸、可使用的成果", "真实与实践", "◇")),
        q("energy-recharge", DiscoveryAxis.EVIDENCE, "能量证据 · 越做越有劲", "完成哪类事情后，你通常会感到被充电？", "这里没有标准答案，只记录什么会让你愿意再次投入。",
            Triple("独自沉浸，把一个问题想透", "深度专注", "◎"), Triple("和人来回讨论，慢慢长出新想法", "共创激发", "♡"), Triple("看见成果被真正使用或认可", "成果反馈", "↗"), Triple("把棘手问题啃下来", "挑战驱动", "◇"), Triple("接触新的人、地方或观点", "新鲜变化", "✦"), Triple("陪伴或支持一个具体的人", "关系滋养", "♡")),
        q("energy-sustain", DiscoveryAxis.EVIDENCE, "能量证据 · 持续投入", "什么会让你即使累，也仍愿意继续一会儿？", "它帮助区分一时兴奋和可持续的投入感。",
            Triple("还差一点就能想清楚或做完整", "深度专注", "◎"), Triple("伙伴之间正在产生默契", "共创激发", "♡"), Triple("已经看见它能解决真实问题", "成果反馈", "↗"), Triple("困难本身让我想再试一次", "挑战驱动", "◇"), Triple("前面还有没见过的可能", "新鲜变化", "✦"), Triple("有人因为这件事变得更好", "关系滋养", "♡")),
        q("context-best", DiscoveryAxis.ENVIRONMENT, "适配环境 · 最好发挥", "在哪种工作或学习状态里，你最容易进入好状态？", "环境不决定能力，但会明显影响你能否稳定发挥。",
            Triple("有自主空间，可以自己安排节奏", "自主空间", "✦"), Triple("和少数可靠的人紧密协作", "小团队共创", "♡"), Triple("目标、边界和标准都很清楚", "目标清晰", "▦"), Triple("能留出长时间不被打断地投入", "连续深度", "◎"), Triple("能快速看到真实用户或成果反馈", "现实反馈", "◇"), Triple("不断面对新任务和新可能", "多元变化", "↗")),
        q("context-friction", DiscoveryAxis.ENVIRONMENT, "适配环境 · 容易消耗", "什么情况最容易让你的好状态被打断？", "识别边界不是挑剔，而是为了选择更可持续的投入方式。",
            Triple("被过度控制、没有做法上的选择", "自主空间", "✦"), Triple("长期独自硬扛、缺少可信的讨论", "小团队共创", "♡"), Triple("目标反复变化、规则模糊", "目标清晰", "▦"), Triple("不断被碎片消息和临时任务打断", "连续深度", "◎"), Triple("做很久却不知道是否有用", "现实反馈", "◇"), Triple("长期重复、几乎没有新刺激", "多元变化", "↗")),
    )

    val questions: List<DiscoveryQuestion> = completeQuestions()

    private fun completeQuestions(): List<DiscoveryQuestion> {
        val interests = listOf(
            "人与心理" to listOf("我会自然想知道：一个人为什么会这样想、这样感受、这样选择？", "心理、人格、自我成长或人际关系的内容，常让我持续看下去。"),
            "社会与文化" to listOf("热点事件出现后，我会想理解背后的群体、时代或社会机制。", "我喜欢比较不同群体、文化和生活方式的差异。"),
            "商业与市场" to listOf("看到流行产品时，我会好奇：它为什么能被人选择或付费？", "新的商业模式、消费趋势或创业故事容易吸引我。"),
            "科技与未来" to listOf("新技术出现时，我会主动想了解它能改变什么。", "我常会想象：技术继续发展后，人会怎样生活。"),
            "生命与自然" to listOf("我会对人体、健康、生命机制或自然规律产生持续好奇。", "动植物、环境与生命科学的内容容易让我投入。"),
            "艺术与审美" to listOf("我会不自觉观察画面、空间、产品或文字的美感。", "看到优秀作品时，我会想：如果由我来做，怎样会更好？"),
            "知识与思想" to listOf("遇到感兴趣的问题时，我会一路查下去，而不只满足于结论。", "哲学、历史、理论或科学解释，容易让我长时间沉浸。"),
            "系统与效率" to listOf("遇到混乱流程时，我会想把它重新整理得更清楚。", "理解复杂系统如何运转、怎样更有效率，会让我感到有趣。"),
            "生活与体验" to listOf("我会主动研究怎样让日常生活变得更有趣、更舒服。", "美食、旅行、运动、空间或新的生活体验中，总有让我投入的领域。"),
        )
        val actions = listOf(
            "探索求知" to listOf("面对陌生问题时，我会主动找资料、追根究底。", "别人得到答案后，我常还会继续追问为什么。"), "分析洞察" to listOf("面对零散信息时，我比较容易发现规律或问题本质。", "别人讨论表面问题时，我常能想到隐藏的原因。"), "创意构想" to listOf("同一个问题，我通常能很快想到不止一种可能。", "听到一个想法后，我常会自然联想到新的做法。"), "结构设计" to listOf("别人说了很多零散信息后，我能较快整理出框架。", "面对复杂任务时，我会自然拆出目标、限制与步骤。"), "表达呈现" to listOf("我比较容易把复杂内容解释到别人能理解。", "我会自然思考怎样讲、写或呈现才能让人接受。"), "共情理解" to listOf("别人没有明说时，我有时也能察觉他真正介意什么。", "发生冲突时，我通常能理解不同的人各自在担心什么。"), "教导赋能" to listOf("看到别人不会一件事时，我会自然想到怎样教他。", "别人因为我的解释突然理解一个问题，会让我有满足感。"), "连接协作" to listOf("我比较容易想到：这件事可以找谁一起做。", "在陌生群体中，我能够比较自然地建立连接。"), "影响推动" to listOf("当我相信一件事值得做时，我会想办法争取支持。", "我不排斥说服、谈判或让别人对一件事产生兴趣。"), "组织统筹" to listOf("很多事情同时出现时，我通常知道应先处理什么。", "多人协作时，我会自然关注时间、人员与资源安排。"), "执行推进" to listOf("讨论足够以后，我会很快转向下一步具体做什么。", "长期任务中，我比较容易持续推进直到完成。"), "实践制作" to listOf("比起一直讨论，我更容易通过先做一个版本找到答案。", "面对工具、实物、空间或真实操作时，我往往更有感觉。"), "优化精进" to listOf("一个东西已经能用时，我还是会发现它可以改进的地方。", "重复做同一件事时，我会自然寻找更快、更准或更好的方法。"),
        )
        val glyphs = listOf("◎", "◌", "↗", "✦", "◇", "♡", "▦", "◈", "☼")
        val actionOptions = actions.mapIndexed { i, item -> DiscoveryOption(item.first, item.first, glyphs[i % glyphs.size]) }
        val values = listOf("自由与创造" to "✦", "成长与求真" to "◎", "关怀与连接" to "♡", "秩序与清晰" to "▦", "影响与担当" to "↗", "真实与实践" to "◇").map { DiscoveryOption(it.first, it.first, it.second) }
        return buildList {
            interests.forEachIndexed { i, item -> item.second.forEachIndexed { j, title -> add(DiscoveryQuestion("interest-${i + 1}-${j + 1}", DiscoveryAxis.LIKE, "兴趣主题 · ${"%02d".format(i + 1)} / 09", title, "按真实投入感评分：1 完全没兴趣，5 即使没人要求也愿意持续投入时间。", emptyList(), DiscoveryKind.INTEREST, item.first)) } }
            actions.forEachIndexed { i, item -> item.second.forEachIndexed { j, title -> add(DiscoveryQuestion("strength-${i + 1}-${j + 1}", DiscoveryAxis.SKILL, "优势动作 · ${"%02d".format(i + 1)} / 13", title, "同一件事分别评价：你是否享受，以及它是否是自然、可复用的优势。", emptyList(), DiscoveryKind.STRENGTH, item.first)) } }
            listOf("哪类事情即使没人教，你也比较容易知道怎么做？", "哪类事情你通常练习几次，就能明显进步？", "别人最经常因为什么事情来找你帮忙？", "在学习、工作和生活中，哪些行为反复成为你的优势？").forEachIndexed { i, title -> add(DiscoveryQuestion("evidence-${i + 1}", DiscoveryAxis.EVIDENCE, "外部证据 · E${i + 1}", title, "最多选 3 项。它用来交叉验证，而不是只听你对自己的判断。", actionOptions)) }
            listOf("独立完成" to "高频协作", "深度投入" to "多任务切换", "稳定明确" to "变化探索", "幕后分析创造" to "台前表达影响", "自主定义方法" to "清晰标准要求", "长期积累" to "即时反馈", "专业深度" to "综合统筹", "低频社交" to "高频社交", "确定性" to "不确定探索", "个人成果" to "帮助他人").forEachIndexed { i, pair -> add(DiscoveryQuestion("environment-${i + 1}", DiscoveryAxis.ENVIRONMENT, "发挥环境 · ${"%02d".format(i + 1)} / 10", "哪一端更接近让你稳定发挥的状态？", "不是选择更好的一端，而是选择你更可持续的工作与学习方式。", emptyList(), DiscoveryKind.ENVIRONMENT, left = pair.first, right = pair.second)) }
            listOf("深入研究一个复杂问题" to "快速把一个想法做出来", "帮一个人真正解决问题" to "影响很多人接受一个观点", "从 0 到 1 想新方案" to "把已有方案做到非常好", "自己深入思考" to "和很多人讨论碰撞", "找规律和原因" to "创造新的表达", "规划全局" to "亲自推进执行").forEachIndexed { i, pair -> add(DiscoveryQuestion("choice-${i + 1}", DiscoveryAxis.CHOICE, "取舍判断 · ${"%02d".format(i + 1)} / 06", "如果只能选一种，你更愿意？", "必须选择一项。它帮助结果在接近时形成更清晰的优先级。", listOf(DiscoveryOption(pair.first, pair.first, "A"), DiscoveryOption(pair.second, pair.second, "B")), DiscoveryKind.CHOICE)) }
            add(DiscoveryQuestion("value-contribution", DiscoveryAxis.VALUE, "价值判断 · 想带来的影响", "你希望自己的投入最终为谁带来什么？", "最多选 3 项。它帮助判断方向是否值得。", values))
            add(DiscoveryQuestion("value-boundary", DiscoveryAxis.VALUE, "价值判断 · 不愿妥协", "看到什么状态时，你最容易感到不舒服？", "最多选 3 项。它会提示你长期选择中的边界。", values))
            listOf("小时候没有人要求你时，你最容易沉迷什么？", "过去几年，有哪三件事让你觉得“虽然累，但做完特别满足”？", "别人最经常因为什么事情找你帮忙？请举一个真实例子。", "你最容易对别人产生哪种“这有什么难的？”的感觉？", "如果未来一年不考虑赚钱和别人怎么看，你最想系统探索哪三件事？").forEachIndexed { i, title -> add(DiscoveryQuestion("open-${i + 1}", DiscoveryAxis.OPEN, "真实叙事 · ${"%02d".format(i + 1)} / 05", title, "写下 1–3 句真实经历。AI 会提取主题、动作、能量与外界证据，而不是只做文本摘要。", emptyList(), DiscoveryKind.OPEN)) }
        }
    }

    fun rankedTags(axis: DiscoveryAxis, answers: Map<String, DiscoveryAnswer>, limit: Int = 3): List<RankedDiscoveryTag> {
        val counts = linkedMapOf<String, Int>()
        questions.filter { it.axis == axis }.forEach { question ->
            val answer = answers[question.id] ?: return@forEach
            if (axis == DiscoveryAxis.LIKE && question.tag != null) counts[question.tag] = (counts[question.tag] ?: 0) + (answer.like ?: 0)
            if (axis == DiscoveryAxis.SKILL && question.tag != null) counts[question.tag] = (counts[question.tag] ?: 0) + (answer.skill ?: 0)
            if (axis == DiscoveryAxis.EVIDENCE || axis == DiscoveryAxis.VALUE || axis == DiscoveryAxis.CHOICE) answer.selected.forEach { label ->
                val tag = question.options.firstOrNull { it.label == label }?.tag ?: label
                counts[tag] = (counts[tag] ?: 0) + if (axis == DiscoveryAxis.EVIDENCE) 2 else 1
            }
        }
        return counts.entries.sortedByDescending { it.value }.take(limit).map { RankedDiscoveryTag(it.key, it.value) }
    }

    fun rankedWithCustom(axis: DiscoveryAxis, answers: Map<String, DiscoveryAnswer>): List<RankedDiscoveryTag> {
        val ranked = rankedTags(axis, answers).toMutableList()
        val seen = ranked.mapTo(mutableSetOf()) { it.tag }
        questions.filter { it.axis == axis }.forEach { question ->
            answers[question.id]?.custom.orEmpty().forEach { custom ->
                val tag = custom.trim().take(18)
                if (tag.isNotEmpty() && seen.add(tag)) ranked += RankedDiscoveryTag(tag, 1)
                if (ranked.size == 3) return ranked
            }
        }
        val defaults = when (axis) {
            DiscoveryAxis.LIKE -> listOf("继续观察投入感", "寻找主动靠近的主题", "记录持续好奇的内容")
            DiscoveryAxis.SKILL -> listOf("继续收集他人反馈", "复盘自然行动模式", "记录低耗能的成功")
            DiscoveryAxis.EVIDENCE -> listOf("记录他人反馈", "复盘重复行为", "观察跨场景优势")
            DiscoveryAxis.ENVIRONMENT -> listOf("观察发挥条件", "记录环境边界", "寻找适配节奏")
            DiscoveryAxis.CHOICE -> listOf("继续做取舍", "用真实行动验证", "避免平均用力")
            DiscoveryAxis.VALUE -> listOf("继续澄清价值排序", "记录重要选择", "观察不愿妥协之处")
            DiscoveryAxis.OPEN -> listOf("补充真实经历", "记录能量变化", "回看外部反馈")
        }
        defaults.forEach { if (seen.add(it) && ranked.size < 3) ranked += RankedDiscoveryTag(it, 1) }
        return ranked.take(3)
    }

    fun localAnalysis(answers: Map<String, DiscoveryAnswer>): SelfDiscoveryAnalysis {
        val likes = rankedWithCustom(DiscoveryAxis.LIKE, answers)
        val strengths = rankedWithCustom(DiscoveryAxis.SKILL, answers)
        val value = rankedWithCustom(DiscoveryAxis.VALUE, answers).firstOrNull()?.tag ?: "你重视的价值"
        val likeInsights = likes.map { DiscoveryInsight(it.tag, "在 ${it.count} 个不同情境中重复出现", "它多次出现在你的注意力、投入感与主动选择中，值得优先用真实行动验证。") }
        val strengthInsights = strengths.map { DiscoveryInsight(it.tag, "在 ${it.count} 个不同情境中重复出现", "它多次出现在你的自然反应、他人反馈与成功模式中，可能是可复用的优势。") }
        val directions = likes.mapIndexed { index, like ->
            val strength = strengths[index % strengths.size].tag
            DiscoveryDirection("用$strength，去探索${like.tag}", "这组组合同时回应了你的兴趣证据，并靠近“$value”。", "在一周内完成一个与“${like.tag}”有关、能使用“$strength”的小行动。")
        }
        return SelfDiscoveryAnalysis(
            "你更容易被${likes.joinToString("、") { it.tag }}吸引，并倾向用${strengths.joinToString("、") { it.tag }}来解决问题。",
            likeInsights,
            strengthInsights,
            directions,
            "这是一份基于兴趣强度、优势双评分、外部证据、环境偏好和真实叙事生成的行动假设；完成 30 天实验后回看，结论会更可靠。",
        )
    }

    fun energySignals(answers: Map<String, DiscoveryAnswer>) = questions.filter { it.axis == DiscoveryAxis.SKILL && (answers[it.id]?.like ?: 0) >= 4 }.mapNotNull { it.tag }.distinct().take(3)
    fun environmentSignals(answers: Map<String, DiscoveryAnswer>) = questions.filter { it.axis == DiscoveryAxis.ENVIRONMENT }.mapNotNull { q -> answers[q.id]?.scale?.let { score -> if (score < 3) q.left else if (score > 3) q.right else "${q.left} / ${q.right}" } }.take(3)

    fun request(answers: Map<String, DiscoveryAnswer>) = SelfDiscoveryRequest(
        responses = questions.map { question ->
            val answer = answers[question.id] ?: DiscoveryAnswer()
            SelfDiscoveryRequest.Response(question.id, question.axis, question.kind, question.title, question.tag, question.left, question.right, answer)
        },
        evidence = SelfDiscoveryRequest.Evidence(
            rankedTags(DiscoveryAxis.LIKE, answers, 9),
            rankedTags(DiscoveryAxis.SKILL, answers, 13),
            rankedTags(DiscoveryAxis.VALUE, answers, 6),
            questions.filter { it.axis == DiscoveryAxis.SKILL && (answers[it.id]?.like ?: 0) >= 4 }.mapNotNull { it.tag }.distinct().take(3),
            questions.filter { it.axis == DiscoveryAxis.ENVIRONMENT }.mapNotNull { q -> answers[q.id]?.scale?.let { score -> if (score < 3) q.left else if (score > 3) q.right else "${q.left} / ${q.right}" } }.take(3),
        ),
    )
}

private enum class DiscoveryPhase { INTRO, QUESTIONS, ANALYZING, RESULT }
private val discoveryJson = Json { ignoreUnknownKeys = true }

@Composable
fun SelfDiscoveryScreen(
    onSave: (likes: List<String>, strengths: List<String>) -> Unit,
    onDismiss: () -> Unit,
) {
    val scope = rememberCoroutineScope()
    val answers = remember { mutableStateMapOf<String, DiscoveryAnswer>() }
    var phase by remember { mutableStateOf(DiscoveryPhase.INTRO) }
    var index by remember { mutableIntStateOf(0) }
    var analysis by remember { mutableStateOf<SelfDiscoveryAnalysis?>(null) }
    var usedAi by remember { mutableStateOf(false) }
    var saved by remember { mutableStateOf(false) }
    var deepUnlocked by remember { mutableStateOf(false) }
    val question = SelfDiscoveryData.questions[index]
    val current = answers[question.id] ?: DiscoveryAnswer()
    val canAdvance = when (question.kind) {
        DiscoveryKind.INTEREST -> current.like != null
        DiscoveryKind.STRENGTH -> current.like != null && current.skill != null
        DiscoveryKind.ENVIRONMENT -> current.scale != null
        DiscoveryKind.OPEN -> !current.text.orEmpty().isBlank()
        DiscoveryKind.SELECT, DiscoveryKind.CHOICE -> current.selected.isNotEmpty()
    }

    fun back() {
        when (phase) {
            DiscoveryPhase.INTRO -> onDismiss()
            DiscoveryPhase.QUESTIONS -> if (index > 0) index-- else phase = DiscoveryPhase.INTRO
            DiscoveryPhase.ANALYZING -> Unit
            DiscoveryPhase.RESULT -> { phase = DiscoveryPhase.QUESTIONS; index = SelfDiscoveryData.questions.lastIndex }
        }
    }

    fun advance() {
        if (!canAdvance) return
        if (index < SelfDiscoveryData.questions.lastIndex) { index++; return }
        phase = DiscoveryPhase.ANALYZING
        deepUnlocked = false
        val snapshot = answers.toMap()
        scope.launch {
            analysis = runCatching {
                val payload = discoveryJson.encodeToJsonElement(SelfDiscoveryData.request(snapshot)).jsonObject
                SupabaseService.shared.callFunction<SelfDiscoveryAnalysis>("analyze-self-discovery", payload)
            }.onSuccess { usedAi = true }.getOrElse {
                usedAi = false
                ToastCenter.show("AI 暂时不可用，已先按重复证据生成结果")
                SelfDiscoveryData.localAnalysis(snapshot)
            }
            phase = DiscoveryPhase.RESULT
        }
    }

    BackHandler { back() }

    Column(Modifier.fillMaxSize().background(Theme.paper).systemBarsPadding()) {
        DiscoveryTopBar(index, phase, ::back)
        when (phase) {
            DiscoveryPhase.INTRO -> DiscoveryIntro { phase = DiscoveryPhase.QUESTIONS }
            DiscoveryPhase.QUESTIONS -> Column(
                Modifier.fillMaxSize().verticalScroll(rememberScrollState()).padding(horizontal = 22.dp).padding(top = 24.dp, bottom = 34.dp),
            ) {
                Text(question.eyebrow, color = Theme.blue, fontSize = 10.sp, fontWeight = FontWeight.SemiBold, letterSpacing = 1.8.sp)
                Text(question.title, color = Theme.ink, fontSize = 23.sp, fontWeight = FontWeight.Bold, lineHeight = 32.sp, modifier = Modifier.padding(top = 9.dp))
                Text(question.hint, color = Theme.sub, fontSize = 12.5.sp, lineHeight = 19.sp, modifier = Modifier.padding(top = 8.dp))
                DiscoveryQuestionInput(question, current, Modifier.padding(top = 18.dp)) { answers[question.id] = it }
                Row(Modifier.padding(top = 22.dp), horizontalArrangement = Arrangement.spacedBy(11.dp)) {
                    DiscoveryButton("上一个", false, Modifier.weight(1f), ::back)
                    DiscoveryButton(if (index == SelfDiscoveryData.questions.lastIndex) "交给 AI 综合分析" else "继续", true, Modifier.weight(1.45f), enabled = canAdvance, onClick = ::advance)
                }
            }
            DiscoveryPhase.ANALYZING -> Column(Modifier.fillMaxSize().padding(32.dp), horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.Center) {
                CircularProgressIndicator(color = Theme.blue)
                Text("AI 正在整理你的证据", color = Theme.ink, fontSize = 22.sp, fontWeight = FontWeight.Bold, modifier = Modifier.padding(top = 22.dp))
                Text("它会区分“被什么内容吸引”和“习惯怎样行动”，并结合你的自由回答寻找重复线索。", color = Theme.sub, fontSize = 13.sp, lineHeight = 20.sp, textAlign = TextAlign.Center, modifier = Modifier.padding(top = 12.dp))
            }
            DiscoveryPhase.RESULT -> analysis?.let { result ->
                Column(Modifier.fillMaxSize().verticalScroll(rememberScrollState()).padding(horizontal = 22.dp).padding(top = 24.dp, bottom = 36.dp)) {
                    Text(if (usedAi) "AI 综合分析" else "本地证据归纳", color = hexColor(0x3ED9A4), fontSize = 10.sp, fontWeight = FontWeight.SemiBold, letterSpacing = 1.8.sp)
                    Text("你喜欢与擅长的基本结论", color = Theme.ink, fontSize = 25.sp, fontWeight = FontWeight.Bold, modifier = Modifier.padding(top = 8.dp))
                    Text(result.summary, color = Theme.sub, fontSize = 13.sp, lineHeight = 20.sp, modifier = Modifier.padding(top = 9.dp))
                    FreeDiscoveryProfile(result, Modifier.padding(top = 18.dp))
                    BasicDiscoveryInsightBlock("我喜欢什么", result.likes, 0xE35CC1, Modifier.padding(top = 20.dp))
                    BasicDiscoveryInsightBlock("我擅长什么", result.strengths, 0x5E96FF, Modifier.padding(top = 12.dp))
                    DiscoveryMap(result, answers, Modifier.padding(top = 12.dp))
                    if (deepUnlocked) {
                        Text("你的完整行动报告", color = Theme.ink, fontSize = 16.sp, fontWeight = FontWeight.Bold, modifier = Modifier.padding(top = 22.dp))
                        DiscoveryInsightBlock("为什么会喜欢", result.likes, 0xE35CC1, Modifier.padding(top = 12.dp))
                        DiscoveryInsightBlock("优势如何发挥", result.strengths, 0x5E96FF, Modifier.padding(top = 12.dp))
                        FullCommercialDiscoveryReport(result, answers, Modifier.padding(top = 14.dp))
                        Text(result.confidenceNote, color = Theme.faint, fontSize = 10.5.sp, lineHeight = 16.sp, modifier = Modifier.padding(top = 15.dp))
                    } else {
                        DeepAnalysisGate {
                            deepUnlocked = true
                            ToastCenter.show("已解锁深入分析（预览环境）")
                        }
                    }
                    Row(Modifier.padding(top = 22.dp), horizontalArrangement = Arrangement.spacedBy(11.dp)) {
                        DiscoveryButton("返回修改", false, Modifier.weight(1f)) { phase = DiscoveryPhase.QUESTIONS; index = SelfDiscoveryData.questions.lastIndex }
                        DiscoveryButton(if (saved) "已保存到动态画像" else "保存到我的动态画像", true, Modifier.weight(1.45f), enabled = !saved) {
                            saved = true
                            onSave(result.likes.map { it.label }.take(5), result.strengths.map { it.label }.take(5))
                        }
                    }
                }
            }
        }
    }
}

@Composable
private fun DiscoveryTopBar(index: Int, phase: DiscoveryPhase, onBack: () -> Unit) {
    Column {
        Row(Modifier.fillMaxWidth().padding(horizontal = 20.dp).padding(top = 14.dp, bottom = 10.dp), verticalAlignment = Alignment.CenterVertically) {
            Box(Modifier.size(34.dp).clip(CircleShape).background(Theme.raised).clickable(onClick = onBack), contentAlignment = Alignment.Center) {
                Icon(Icons.Filled.KeyboardArrowLeft, "退出探索", tint = Theme.ink, modifier = Modifier.size(22.dp))
            }
            Spacer(Modifier.width(12.dp))
            Column(Modifier.weight(1f)) {
                Text("喜欢 × 擅长", color = Theme.ink, fontSize = 16.sp, fontWeight = FontWeight.Bold)
                Text("想做的事探索", color = Theme.faint, fontSize = 10.5.sp)
            }
            if (phase == DiscoveryPhase.QUESTIONS) Text("${index + 1}/${SelfDiscoveryData.questions.size}", color = Theme.faint, fontSize = 10.sp)
        }
        val progress = when (phase) {
            DiscoveryPhase.INTRO -> 0f
            DiscoveryPhase.QUESTIONS -> (index + 1).toFloat() / SelfDiscoveryData.questions.size
            else -> 1f
        }
        Box(Modifier.fillMaxWidth().height(3.dp).background(Theme.raised)) {
            Box(Modifier.fillMaxWidth(progress).height(3.dp).background(Theme.blue))
        }
    }
}

@Composable
private fun DiscoveryIntro(onStart: () -> Unit) {
    Column(Modifier.fillMaxSize().verticalScroll(rememberScrollState()).padding(horizontal = 24.dp).padding(top = 30.dp, bottom = 36.dp)) {
        Text("中文原创自我探索", color = Theme.blue, fontSize = 10.sp, fontWeight = FontWeight.SemiBold, letterSpacing = 2.2.sp)
        Text("用完整证据链，找到\n你喜欢和擅长的事", color = Theme.ink, fontSize = 28.sp, fontWeight = FontWeight.Bold, lineHeight = 38.sp, modifier = Modifier.padding(top = 12.dp))
        Text("沿用“喜欢 × 擅长 × 价值观”的方法结构，通过 ${SelfDiscoveryData.questions.size} 个原创情境收集兴趣、优势、能量与环境证据，最后交给 AI 综合分析。", color = Theme.sub, fontSize = 14.sp, lineHeight = 22.sp, modifier = Modifier.padding(top = 16.dp))
        Column(Modifier.padding(top = 22.dp).fillMaxWidth().clip(RoundedCornerShape(16.dp)).background(Theme.raised).padding(16.dp), verticalArrangement = Arrangement.spacedBy(9.dp)) {
            Text("01  每题可选 1–3 项", color = Theme.sub, fontSize = 12.5.sp)
            Text("02  支持补充自己的答案", color = Theme.sub, fontSize = 12.5.sp)
            Text("03  AI 区分兴趣与可复用优势", color = Theme.sub, fontSize = 12.5.sp)
        }
        Text("题目为方法结构上的产品化原创表达，不复制任何书籍原句。", color = Theme.faint, fontSize = 10.5.sp, modifier = Modifier.padding(top = 14.dp))
        DiscoveryButton("开始完整探索 · 约 10 分钟", true, Modifier.padding(top = 24.dp).fillMaxWidth(), onClick = onStart)
    }
}

@Composable
private fun DiscoveryQuestionInput(question: DiscoveryQuestion, answer: DiscoveryAnswer, modifier: Modifier = Modifier, onChange: (DiscoveryAnswer) -> Unit) {
    when (question.kind) {
        DiscoveryKind.INTEREST -> RatingControl("你有多喜欢这样？", "完全没兴趣", "愿意持续投入", answer.like, modifier) { onChange(answer.copy(like = it)) }
        DiscoveryKind.STRENGTH -> Column(modifier, verticalArrangement = Arrangement.spacedBy(14.dp)) {
            RatingControl("你有多喜欢这样做？", "很消耗", "做完有能量", answer.like) { onChange(answer.copy(like = it)) }
            RatingControl("你有多自然地能做好？", "明显吃力", "常被认为是优势", answer.skill) { onChange(answer.copy(skill = it)) }
        }
        DiscoveryKind.ENVIRONMENT -> RatingControl(null, question.left ?: "左侧", question.right ?: "右侧", answer.scale, modifier) { onChange(answer.copy(scale = it)) }
        DiscoveryKind.OPEN -> Column(modifier.fillMaxWidth().clip(RoundedCornerShape(16.dp)).background(Theme.raised).padding(14.dp)) {
            Text("真实经历比“正确答案”更重要", color = Theme.ink, fontSize = 12.5.sp, fontWeight = FontWeight.SemiBold)
            Box(Modifier.padding(top = 10.dp).fillMaxWidth().height(156.dp).clip(RoundedCornerShape(12.dp)).background(Theme.paper).border(1.dp, Theme.line, RoundedCornerShape(12.dp)).padding(12.dp)) {
                if (answer.text.isNullOrEmpty()) Text("写下 1–3 句真实经历…", color = Theme.faint, fontSize = 13.sp)
                BasicTextField(answer.text.orEmpty(), { onChange(answer.copy(text = it.take(400))) }, textStyle = TextStyle(color = Theme.ink, fontSize = 13.sp), cursorBrush = SolidColor(Theme.blue), modifier = Modifier.fillMaxSize())
            }
            Text("${answer.text?.length ?: 0}/400", color = Theme.faint, fontSize = 10.sp, modifier = Modifier.padding(top = 5.dp).align(Alignment.End))
        }
        DiscoveryKind.SELECT, DiscoveryKind.CHOICE -> Column(modifier, verticalArrangement = Arrangement.spacedBy(9.dp)) {
            question.options.forEach { option ->
                val selected = option.label in answer.selected
                Row(Modifier.fillMaxWidth().clip(RoundedCornerShape(15.dp)).background(if (selected) hexColor(0x5373FF, 0.18f) else Theme.raised).border(1.dp, if (selected) hexColor(0x6FA5FF, 0.72f) else Theme.line, RoundedCornerShape(15.dp)).clickable {
                    val next = when {
                        selected -> answer.selected - option.label
                        question.kind == DiscoveryKind.CHOICE -> listOf(option.label)
                        answer.selected.size < 3 -> answer.selected + option.label
                        else -> { ToastCenter.show("每题最多选择 3 项"); answer.selected }
                    }
                    onChange(answer.copy(selected = next))
                }.padding(12.dp), verticalAlignment = Alignment.CenterVertically) {
                    Box(Modifier.size(32.dp).clip(RoundedCornerShape(9.dp)).background(Theme.paper), contentAlignment = Alignment.Center) { Text(if (selected) "✓" else option.glyph, color = hexColor(0xBFD2FF), fontSize = 15.sp) }
                    Spacer(Modifier.width(10.dp)); Text(option.label, color = Theme.ink, fontSize = 13.sp, fontWeight = FontWeight.Medium)
                }
            }
        }
    }
}

@Composable
private fun RatingControl(label: String?, low: String, high: String, value: Int?, modifier: Modifier = Modifier, onSelect: (Int) -> Unit) {
    Column(modifier.fillMaxWidth().clip(RoundedCornerShape(16.dp)).background(Theme.raised).padding(14.dp)) {
        if (label != null) Text(label, color = Theme.ink, fontSize = 14.sp, fontWeight = FontWeight.SemiBold)
        Row(Modifier.fillMaxWidth().padding(top = if (label != null) 12.dp else 0.dp), horizontalArrangement = Arrangement.spacedBy(8.dp)) { (1..5).forEach { score ->
            Box(Modifier.weight(1f).clip(RoundedCornerShape(11.dp)).background(if (value == score) hexColor(0x5373FF, 0.24f) else Theme.paper).border(1.dp, if (value == score) hexColor(0x6FA5FF, 0.78f) else Theme.line, RoundedCornerShape(11.dp)).clickable { onSelect(score) }.padding(vertical = 12.dp), contentAlignment = Alignment.Center) { Text("$score", color = if (value == score) hexColor(0xBFD2FF) else Theme.sub, fontSize = 14.sp, fontWeight = FontWeight.Bold) }
        }}
        Row(Modifier.fillMaxWidth().padding(top = 9.dp), horizontalArrangement = Arrangement.SpaceBetween) { Text(low, color = Theme.sub, fontSize = 13.sp, fontWeight = FontWeight.Medium); Text(high, color = Theme.sub, fontSize = 13.sp, fontWeight = FontWeight.Medium, textAlign = TextAlign.End) }
    }
}

@Composable
private fun DiscoveryInsightBlock(title: String, items: List<DiscoveryInsight>, tint: Long, modifier: Modifier = Modifier) {
    Column(modifier.fillMaxWidth().clip(RoundedCornerShape(17.dp)).background(hexColor(tint, 0.09f)).border(1.dp, hexColor(tint, 0.24f), RoundedCornerShape(17.dp)).padding(16.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
        Text(title, color = Theme.ink, fontSize = 15.sp, fontWeight = FontWeight.Bold)
        items.forEach { item ->
            Column(verticalArrangement = Arrangement.spacedBy(4.dp)) {
                Text(item.label, color = hexColor(tint), fontSize = 13.5.sp, fontWeight = FontWeight.SemiBold)
                Text("${item.evidence} · ${item.reason}", color = Theme.sub, fontSize = 11.sp, lineHeight = 16.sp)
            }
        }
    }
}

@Composable
private fun BasicDiscoveryInsightBlock(title: String, items: List<DiscoveryInsight>, tint: Long, modifier: Modifier = Modifier) {
    Column(modifier.fillMaxWidth().clip(RoundedCornerShape(17.dp)).background(Theme.raised).padding(16.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
        Text(title, color = Theme.ink, fontSize = 15.sp, fontWeight = FontWeight.Bold)
        Column(verticalArrangement = Arrangement.spacedBy(7.dp)) {
            items.forEach { item ->
                Text(item.label, color = hexColor(tint), fontSize = 11.5.sp, fontWeight = FontWeight.SemiBold, modifier = Modifier.clip(CircleShape).background(hexColor(tint, 0.12f)).padding(horizontal = 11.dp, vertical = 7.dp))
            }
        }
        Text("这些结论来自重复出现的选择与自由回答；深入分析会解释具体证据与适合你的行动路径。", color = Theme.sub, fontSize = 11.sp, lineHeight = 16.sp)
    }
}

@Composable
private fun FreeDiscoveryProfile(result: SelfDiscoveryAnalysis, modifier: Modifier = Modifier) {
    val like = result.likes.firstOrNull()?.label ?: "持续好奇"
    val strength = result.strengths.firstOrNull()?.label ?: "解决问题"
    Column(modifier.fillMaxWidth().clip(RoundedCornerShape(17.dp)).background(hexColor(0x5373FF, 0.12f)).border(1.dp, hexColor(0x6FA5FF, 0.3f), RoundedCornerShape(17.dp)).padding(16.dp)) {
        Text("FREE PROFILE · 免费基础报告", color = hexColor(0xBFD2FF), fontSize = 10.sp, fontWeight = FontWeight.SemiBold, letterSpacing = 1.6.sp)
        Text("你的画像：${strength}型探索者", color = Theme.ink, fontSize = 18.sp, fontWeight = FontWeight.Bold, modifier = Modifier.padding(top = 6.dp))
        Text("你会被「$like」持续吸引，并自然用「$strength」把模糊的问题向前推进。先找同时需要这两件事的真实任务，比急着决定职业名称更重要。", color = Theme.sub, fontSize = 12.sp, lineHeight = 18.sp, modifier = Modifier.padding(top = 8.dp))
        Row(Modifier.fillMaxWidth().padding(top = 13.dp), horizontalArrangement = Arrangement.spacedBy(7.dp)) {
            FreeSignal("最佳组合", "$like × $strength", Modifier.weight(1f))
            FreeSignal("先探索", "职业 / 副业 / 兴趣", Modifier.weight(1f))
            FreeSignal("下一步", "一个真实小任务", Modifier.weight(1f))
        }
        Text("免费结论已回答：你被什么吸引、怎样解决问题、现在最值得从哪里开始。", color = hexColor(0xBFD2FF), fontSize = 10.5.sp, lineHeight = 15.sp, modifier = Modifier.padding(top = 12.dp))
    }
}

@Composable
private fun FreeSignal(label: String, value: String, modifier: Modifier = Modifier) {
    Column(modifier.clip(RoundedCornerShape(10.dp)).background(Color.Black.copy(alpha = 0.12f)).padding(9.dp).height(58.dp)) {
        Text(label, color = Theme.faint, fontSize = 9.5.sp)
        Text(value, color = Theme.ink, fontSize = 10.5.sp, fontWeight = FontWeight.SemiBold, lineHeight = 14.sp, modifier = Modifier.padding(top = 4.dp))
    }
}

@Composable
private fun FullCommercialDiscoveryReport(result: SelfDiscoveryAnalysis, answers: Map<String, DiscoveryAnswer>, modifier: Modifier = Modifier) {
    val likes = result.likes.map { it.label }
    val strengths = result.strengths.map { it.label }
    val allLikes = SelfDiscoveryData.rankedTags(DiscoveryAxis.LIKE, answers, 9).joinToString(" · ") { "${it.tag} ${it.count}" }
    val allStrengths = SelfDiscoveryData.rankedTags(DiscoveryAxis.SKILL, answers, 13).joinToString(" · ") { "${it.tag} ${it.count}" }
        val energy = SelfDiscoveryData.energySignals(answers).take(2).joinToString("、")
    val context = SelfDiscoveryData.environmentSignals(answers).take(2).joinToString("、")
    Column(modifier.fillMaxWidth(), verticalArrangement = Arrangement.spacedBy(12.dp)) {
        CommercialBlock("01 · 完整喜欢地图", "9 个兴趣主题的投入强度", allLikes)
        CommercialBlock("02 · 完整擅长地图", "13 个优势动作的自然优势", "$allStrengths\n深入报告将它们与喜欢度交叉，区分天赋热爱、兴趣潜力、熟练消耗和非优先区。")
        CommercialBlock("03 · 优势组合链", "你的天然解决问题路径", "${strengths.joinToString(" → ")}\n这不是单一技能，而是更容易形成差异化的解决问题路径。")
        CommercialBlock("04 · 能量与边界", "怎样才会持续发挥", "你更可能在「$energy」中被充电，并需要「$context」这样的环境。擅长不等于适合长期承担。")
        CommercialBlock("05 · 消耗模式", "能做，不等于该长期做", "「${strengths.drop(1).joinToString("、")}」是可靠能力；如果长期没有能量回流，更适合作为辅助能力，而不是职业唯一核心。")
        CommercialBlock("06 · 职业探索", "领域 × 角色 × 工作方式", careerSummary(likes.firstOrNull()))
        CommercialBlock("07 · 副业探索", "最低成本的商业化实验", "围绕「${likes.firstOrNull() ?: "兴趣主题"} × ${strengths.firstOrNull() ?: "优势动作"}」，连续 4 周输出 4 次可被别人使用的成果，观察想继续做、有人认可、能产生价值是否同时出现。")
        CommercialBlock("08 · 兴趣保留", "不必每一种喜欢都赚钱", "「${likes.drop(1).joinToString("、")}」可以先作为纯粹兴趣或低压力练习保留；先验证能量与持续性，再决定是否副业化。")
        Column(Modifier.fillMaxWidth().clip(RoundedCornerShape(17.dp)).background(Theme.card).padding(16.dp)) {
            Text("09 · 未来 30 天人生实验", color = hexColor(0xBFD2FF), fontSize = 10.sp, fontWeight = FontWeight.SemiBold, letterSpacing = 1.4.sp)
            Text("把结论变成新的证据", color = Theme.ink, fontSize = 15.sp, fontWeight = FontWeight.Bold, modifier = Modifier.padding(top = 4.dp))
            result.directions.forEachIndexed { index, direction ->
                Column(Modifier.fillMaxWidth().padding(top = 9.dp).clip(RoundedCornerShape(13.dp)).background(Theme.raised).padding(12.dp), verticalArrangement = Arrangement.spacedBy(5.dp)) {
                    Text(listOf("职业实验", "副业实验", "兴趣实验")[index], color = hexColor(0xBFD2FF), fontSize = 10.sp, fontWeight = FontWeight.SemiBold)
                    Text(direction.title, color = Theme.ink, fontSize = 13.sp, fontWeight = FontWeight.SemiBold)
                    Text(direction.why, color = Theme.sub, fontSize = 11.sp, lineHeight = 16.sp)
                    Text("本周第一步：${direction.firstStep}", color = hexColor(0xBFD2FF), fontSize = 11.sp, lineHeight = 16.sp)
                }
            }
            Text("一个月后回来看喜欢度、能量、能力与外部反馈的变化，再回写到动态画像和人生实验室。", color = Theme.sub, fontSize = 10.5.sp, lineHeight = 15.sp, modifier = Modifier.padding(top = 10.dp))
        }
    }
}

@Composable
private fun CommercialBlock(eyebrow: String, title: String, text: String) {
    Column(Modifier.fillMaxWidth().clip(RoundedCornerShape(17.dp)).background(Theme.card).padding(16.dp)) {
        Text(eyebrow, color = hexColor(0xBFD2FF), fontSize = 10.sp, fontWeight = FontWeight.SemiBold, letterSpacing = 1.4.sp)
        Text(title, color = Theme.ink, fontSize = 15.sp, fontWeight = FontWeight.Bold, modifier = Modifier.padding(top = 4.dp))
        Text(text, color = Theme.sub, fontSize = 11.5.sp, lineHeight = 16.sp, modifier = Modifier.padding(top = 7.dp))
    }
}

private fun careerSummary(like: String?): String = when (like) {
    "艺术与审美" -> "优先体验：体验／内容设计、品牌与创意策略、内容策划。重点验证表达是否能产生真实价值。"
    "知识与思想" -> "优先体验：用户／行业研究、产品策略、知识内容。重点验证研究与判断是否愿意长期投入。"
    "人与心理" -> "优先体验：用户研究、教育／咨询服务、社群体验运营。重点验证理解人是否让你持续有能量。"
    "商业与市场" -> "优先体验：商业策略、增长／用户运营、创业探索。重点验证价值判断是否愿意长期投入。"
    "科技与未来" -> "优先体验：AI 产品探索、科技内容、创新研究。重点验证新技术是否让你好奇又愿意行动。"
    "系统与优化" -> "优先体验：产品经理、运营策略、服务设计。重点验证复杂系统能否让你越做越清晰。"
    else -> "优先从真实问题、内容与研究、服务与体验三类任务中选择小项目，验证主题、优势与环境是否同时匹配。"
}

@Composable
private fun DiscoveryMap(result: SelfDiscoveryAnalysis, answers: Map<String, DiscoveryAnswer>, modifier: Modifier = Modifier) {
    val energy = SelfDiscoveryData.energySignals(answers)
    val context = SelfDiscoveryData.environmentSignals(answers)
    Column(modifier.fillMaxWidth().clip(RoundedCornerShape(17.dp)).background(Theme.raised).padding(16.dp)) {
        Text("LIFE MAP · 基础结论", color = hexColor(0x3ED9A4), fontSize = 10.sp, fontWeight = FontWeight.SemiBold, letterSpacing = 1.6.sp)
        Text("你的喜欢 × 擅长人生地图", color = Theme.ink, fontSize = 16.sp, fontWeight = FontWeight.Bold, modifier = Modifier.padding(top = 4.dp))
        Text("先看你该优先投入哪里，而不是急着把自己归类成某个职业。", color = Theme.sub, fontSize = 11.sp, lineHeight = 16.sp, modifier = Modifier.padding(top = 4.dp))
        Row(Modifier.fillMaxWidth().padding(top = 12.dp), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            MapCell("天赋热爱区 · 优先探索", "把「${result.likes.firstOrNull()?.label ?: "喜欢的主题"}」和「${result.strengths.firstOrNull()?.label ?: "擅长的方式"}」放进真实项目，最值得成为职业核心或长期副业。", 0x3ED9A4, Modifier.weight(1f))
            MapCell("兴趣潜力区 · 值得练习", "对「${result.likes.drop(1).joinToString("、") { it.label }}」先用低成本作品或体验验证。", 0x5E96FF, Modifier.weight(1f))
        }
        Row(Modifier.fillMaxWidth().padding(top = 8.dp), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            MapCell("熟练消耗区 · 需要边界", "即使擅长「${result.strengths.drop(1).joinToString("、") { it.label }}」，也要结合能量感判断。", 0xF0A949, Modifier.weight(1f))
            MapCell("发挥条件 · 选择环境", "你更可能在「${energy.take(2).joinToString("、")}」中被充电，并需要「${context.take(2).joinToString("、")}」。", 0x6E7B98, Modifier.weight(1f))
        }
    }
}

@Composable
private fun MapCell(title: String, text: String, tint: Long, modifier: Modifier = Modifier) {
    Column(modifier.clip(RoundedCornerShape(12.dp)).background(hexColor(tint, 0.08f)).padding(11.dp).height(128.dp)) {
        Text(title, color = hexColor(tint), fontSize = 10.5.sp, fontWeight = FontWeight.SemiBold, lineHeight = 14.sp)
        Text(text, color = Theme.sub, fontSize = 10.5.sp, lineHeight = 15.sp, modifier = Modifier.padding(top = 7.dp))
    }
}

@Composable
private fun DeepAnalysisGate(onUnlock: () -> Unit) {
    Column(
        Modifier.padding(top = 18.dp).fillMaxWidth().clip(RoundedCornerShape(17.dp))
            .background(hexColor(0x5373FF, 0.12f)).border(1.dp, hexColor(0x6FA5FF, 0.38f), RoundedCornerShape(17.dp)).padding(16.dp),
        verticalArrangement = Arrangement.spacedBy(9.dp),
    ) {
        Text("DEEPER VIEW", color = hexColor(0xBFD2FF), fontSize = 10.sp, fontWeight = FontWeight.SemiBold, letterSpacing = 2.sp)
        Text("从“我大概是谁”到“我该怎么选”", color = Theme.ink, fontSize = 16.sp, fontWeight = FontWeight.Bold)
        Text("完整报告将展示以下目录；个人分数、组合判断和推荐内容会在解锁后显示。", color = Theme.sub, fontSize = 12.sp, lineHeight = 18.sp)
        Column(Modifier.fillMaxWidth().clip(RoundedCornerShape(12.dp)).background(Theme.raised).padding(11.dp), verticalArrangement = Arrangement.spacedBy(6.dp)) {
            Text("01  9 项兴趣地图与核心／延展兴趣", color = hexColor(0xBFD2FF), fontSize = 10.5.sp)
            Text("02  13 项优势双评分与四象限位置", color = hexColor(0xBFD2FF), fontSize = 10.5.sp)
            Text("03  解题路径、能量边界与消耗提醒", color = hexColor(0xBFD2FF), fontSize = 10.5.sp)
            Text("04  职业／副业／兴趣建议与 30 天实验", color = hexColor(0xBFD2FF), fontSize = 10.5.sp)
        }
        DiscoveryButton("解锁完整深入报告 ¥9.9", true, Modifier.padding(top = 4.dp).fillMaxWidth(), onClick = onUnlock)
    }
}

@Composable
private fun DiscoveryButton(
    title: String,
    primary: Boolean,
    modifier: Modifier = Modifier,
    enabled: Boolean = true,
    onClick: () -> Unit,
) {
    Box(
        modifier.clip(CircleShape).background(if (primary) Theme.buttonGradient else SolidColor(Theme.raised))
            .then(if (enabled) Modifier.clickable(onClick = onClick) else Modifier).padding(vertical = 14.dp),
        contentAlignment = Alignment.Center,
    ) {
        Text(title, color = if (primary) Color.White else Theme.sub, fontSize = 13.5.sp, fontWeight = if (primary) FontWeight.SemiBold else FontWeight.Medium)
    }
}
