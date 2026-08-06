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
    @SerialName("value") VALUE,
}

data class DiscoveryOption(val label: String, val tag: String, val glyph: String)
data class DiscoveryQuestion(
    val id: String,
    val axis: DiscoveryAxis,
    val eyebrow: String,
    val title: String,
    val hint: String,
    val options: List<DiscoveryOption>,
)

@Serializable
data class DiscoveryAnswer(val selected: List<String> = emptyList(), val custom: List<String> = emptyList())

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
        val question: String,
        val selected: List<String>,
        val custom: List<String>,
    )

    @Serializable
    data class Evidence(
        val likes: List<RankedDiscoveryTag>,
        val strengths: List<RankedDiscoveryTag>,
        val values: List<RankedDiscoveryTag>,
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

    val questions = listOf(
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
    )

    fun rankedTags(axis: DiscoveryAxis, answers: Map<String, DiscoveryAnswer>): List<RankedDiscoveryTag> {
        val counts = linkedMapOf<String, Int>()
        questions.filter { it.axis == axis }.forEach { question ->
            answers[question.id]?.selected.orEmpty().forEach { label ->
                val tag = question.options.firstOrNull { it.label == label }?.tag ?: return@forEach
                counts[tag] = (counts[tag] ?: 0) + 1
            }
        }
        return counts.entries.sortedByDescending { it.value }.take(3).map { RankedDiscoveryTag(it.key, it.value) }
    }

    private fun rankedWithCustom(axis: DiscoveryAxis, answers: Map<String, DiscoveryAnswer>): List<RankedDiscoveryTag> {
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
            DiscoveryAxis.VALUE -> listOf("继续澄清价值排序", "记录重要选择", "观察不愿妥协之处")
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
            "这是基于选择频次生成的初步假设；继续记录真实行动中的投入感和反馈，结论会更准确。",
        )
    }

    fun request(answers: Map<String, DiscoveryAnswer>) = SelfDiscoveryRequest(
        responses = questions.map { question ->
            val answer = answers[question.id] ?: DiscoveryAnswer()
            SelfDiscoveryRequest.Response(question.id, question.axis, question.title, answer.selected, answer.custom)
        },
        evidence = SelfDiscoveryRequest.Evidence(
            rankedTags(DiscoveryAxis.LIKE, answers),
            rankedTags(DiscoveryAxis.SKILL, answers),
            rankedTags(DiscoveryAxis.VALUE, answers),
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
    var customDraft by remember { mutableStateOf("") }
    var analysis by remember { mutableStateOf<SelfDiscoveryAnalysis?>(null) }
    var usedAi by remember { mutableStateOf(false) }
    var saved by remember { mutableStateOf(false) }
    val question = SelfDiscoveryData.questions[index]
    val current = answers[question.id] ?: DiscoveryAnswer()
    val canAdvance = current.selected.isNotEmpty() || current.custom.isNotEmpty() || customDraft.trim().isNotEmpty()

    fun back() {
        customDraft = ""
        when (phase) {
            DiscoveryPhase.INTRO -> onDismiss()
            DiscoveryPhase.QUESTIONS -> if (index > 0) index-- else phase = DiscoveryPhase.INTRO
            DiscoveryPhase.ANALYZING -> Unit
            DiscoveryPhase.RESULT -> { phase = DiscoveryPhase.QUESTIONS; index = SelfDiscoveryData.questions.lastIndex }
        }
    }

    fun advance() {
        if (!canAdvance) return
        val pending = customDraft.trim()
        if (pending.isNotEmpty() && current.custom.size < 2) {
            answers[question.id] = current.copy(custom = (current.custom + pending).distinct())
        }
        customDraft = ""
        if (index < SelfDiscoveryData.questions.lastIndex) { index++; return }
        phase = DiscoveryPhase.ANALYZING
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
                Column(Modifier.padding(top = 18.dp), verticalArrangement = Arrangement.spacedBy(9.dp)) {
                    question.options.forEach { option ->
                        val isSelected = option.label in current.selected
                        Row(
                            Modifier.fillMaxWidth().clip(RoundedCornerShape(15.dp))
                                .background(if (isSelected) hexColor(0x5373FF, 0.18f) else Theme.raised)
                                .border(1.dp, if (isSelected) hexColor(0x6FA5FF, 0.72f) else Theme.line, RoundedCornerShape(15.dp))
                                .clickable {
                                    val next = current.selected.toMutableList()
                                    if (isSelected) next.remove(option.label)
                                    else if (next.size < 3) next += option.label
                                    else ToastCenter.show("每题最多选择 3 项，也可以补充自己的答案")
                                    answers[question.id] = current.copy(selected = next)
                                }.padding(12.dp),
                            verticalAlignment = Alignment.CenterVertically,
                        ) {
                            Box(Modifier.size(32.dp).clip(RoundedCornerShape(9.dp)).background(Theme.paper), contentAlignment = Alignment.Center) {
                                Text(if (isSelected) "✓" else option.glyph, color = hexColor(0xBFD2FF), fontSize = 15.sp)
                            }
                            Spacer(Modifier.width(10.dp))
                            Text(option.label, color = Theme.ink, fontSize = 13.sp, fontWeight = FontWeight.Medium)
                        }
                    }
                }
                Column(
                    Modifier.padding(top = 14.dp).fillMaxWidth().clip(RoundedCornerShape(16.dp)).background(Theme.raised).padding(14.dp),
                    verticalArrangement = Arrangement.spacedBy(10.dp),
                ) {
                    Text("选项里没有我的答案", color = Theme.ink, fontSize = 12.5.sp, fontWeight = FontWeight.SemiBold)
                    Box(Modifier.fillMaxWidth().clip(RoundedCornerShape(12.dp)).background(Theme.paper).border(1.dp, Theme.line, RoundedCornerShape(12.dp)).padding(horizontal = 13.dp, vertical = 12.dp)) {
                        if (customDraft.isEmpty()) Text("写下真实答案", color = Theme.faint, fontSize = 13.sp)
                        BasicTextField(customDraft, { customDraft = it }, singleLine = true, textStyle = TextStyle(color = Theme.ink, fontSize = 13.sp), cursorBrush = SolidColor(Theme.blue))
                    }
                    if (current.custom.isNotEmpty()) {
                        current.custom.forEach { value ->
                            Text("$value  ×", color = hexColor(0xBFD2FF), fontSize = 11.5.sp, modifier = Modifier.clickable {
                                answers[question.id] = current.copy(custom = current.custom - value)
                            })
                        }
                    }
                    if (customDraft.isNotBlank()) Text("按继续即可添加", color = Theme.faint, fontSize = 10.sp)
                }
                Row(Modifier.padding(top = 22.dp), horizontalArrangement = Arrangement.spacedBy(11.dp)) {
                    DiscoveryButton("返回", false, Modifier.weight(1f), ::back)
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
                    Text("你反复出现的两组线索", color = Theme.ink, fontSize = 25.sp, fontWeight = FontWeight.Bold, modifier = Modifier.padding(top = 8.dp))
                    Text(result.summary, color = Theme.sub, fontSize = 13.sp, lineHeight = 20.sp, modifier = Modifier.padding(top = 9.dp))
                    DiscoveryInsightBlock("我喜欢的事", result.likes, 0xE35CC1, Modifier.padding(top = 20.dp))
                    DiscoveryInsightBlock("我擅长的事", result.strengths, 0x5E96FF, Modifier.padding(top = 12.dp))
                    Text("可以开始验证的方向", color = Theme.ink, fontSize = 14.sp, fontWeight = FontWeight.Bold, modifier = Modifier.padding(top = 22.dp))
                    result.directions.forEach { direction ->
                        Column(Modifier.padding(top = 9.dp).fillMaxWidth().clip(RoundedCornerShape(15.dp)).background(Theme.raised).padding(14.dp), verticalArrangement = Arrangement.spacedBy(7.dp)) {
                            Text(direction.title, color = Theme.ink, fontSize = 14.sp, fontWeight = FontWeight.SemiBold)
                            Text(direction.why, color = Theme.sub, fontSize = 11.5.sp, lineHeight = 17.sp)
                            Text("第一步：${direction.firstStep}", color = hexColor(0xBFD2FF), fontSize = 11.5.sp, lineHeight = 17.sp)
                        }
                    }
                    Text(result.confidenceNote, color = Theme.faint, fontSize = 10.5.sp, lineHeight = 16.sp, modifier = Modifier.padding(top = 15.dp))
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
        Text("沿用“喜欢 × 擅长 × 价值观”的方法结构，通过 12 个原创情境寻找你的注意力、投入、他人反馈与成功模式，最后交给 AI 综合分析。", color = Theme.sub, fontSize = 14.sp, lineHeight = 22.sp, modifier = Modifier.padding(top = 16.dp))
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
