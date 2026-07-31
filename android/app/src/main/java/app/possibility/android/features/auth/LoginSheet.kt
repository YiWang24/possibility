package app.possibility.android.features.auth

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.BasicTextField
import androidx.compose.foundation.text.KeyboardActions
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.SolidColor
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.text.input.VisualTransformation
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import app.possibility.android.core.ToastCenter
import app.possibility.android.core.network.EmailConfirmationRequired
import app.possibility.android.core.network.SupabaseService
import app.possibility.android.core.theme.Theme
import kotlinx.coroutines.launch

// 登录 / 注册表单：邮箱 + 密码，登录 / 注册切 tab（字段完全一致）。
// 对应 ios/Possibility/Features/Auth/LoginSheet.swift 的表单部分。
// 承载在 ModalBottomSheet 中（登录墙 AuthWallView / 门控 AuthGateHost 各自弹出）。
// onDismiss —— 登录/注册成功后回调：登录墙由 isAuthenticated 自动切走，门控继续被拦截的动作。

private const val MIN_PASSWORD_LENGTH = 6

/**
 * 登录 / 注册表单。成功后调用 [onDismiss]（Apple 登录在 Android 不适用，已忽略；
 * 微信登录照 iOS 预留但默认禁用，wechatEnabled=false 时不显示）。
 */
@Composable
fun LoginSheet(onDismiss: () -> Unit) {
    val service = SupabaseService.shared
    val scope = rememberCoroutineScope()

    var signUp by remember { mutableStateOf(false) }
    var email by remember { mutableStateOf("") }
    var password by remember { mutableStateOf("") }
    var showPassword by remember { mutableStateOf(false) }
    var busy by remember { mutableStateOf(false) }
    var errorText by remember { mutableStateOf<String?>(null) }
    var noticeText by remember { mutableStateOf<String?>(null) }

    // 微信登录预留位：开放平台资质到位、wechat-login 函数上线后置 true
    val wechatEnabled = false

    val emailValid = isEmailValid(email)
    val passwordValid = password.length >= MIN_PASSWORD_LENGTH
    val canSubmit = emailValid && passwordValid && !busy

    fun submit() {
        if (!canSubmit) return
        val address = email.trim()
        busy = true
        errorText = null
        noticeText = null
        scope.launch {
            try {
                if (signUp) {
                    val sent = service.signUp(address, password)
                    // 注册即登录：本页随即随登录墙消失，提示交给根部 toast。
                    ToastCenter.show(
                        if (sent) "验证邮件已发送至 $address，稍后验证即可，不影响使用"
                        else "验证邮件发送失败，不影响使用，可稍后在「我」里重发",
                    )
                    busy = false
                    onDismiss()
                } else {
                    service.signIn(address, password)
                    busy = false
                    onDismiss()
                }
            } catch (e: EmailConfirmationRequired) {
                // 线上开了确认邮件才会走到：此时还没有会话，不能当成功继续
                busy = false
                signUp = false
                noticeText = e.message
            } catch (e: Exception) {
                busy = false
                // 邮箱已注册：直接把用户送到登录 tab
                if (signUp && isEmailExistsError(e)) signUp = false
                errorText = authErrorMessage(e)
            }
        }
    }

    Column(
        modifier = Modifier
            .fillMaxWidth()
            .verticalScroll(rememberScrollState())
            .padding(horizontal = 22.dp)
            .padding(top = 12.dp, bottom = 26.dp),
        verticalArrangement = Arrangement.spacedBy(16.dp),
    ) {
        // 头部
        Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
            Text(
                "登录 Possibility",
                color = Theme.ink,
                fontSize = 17.sp,
                fontWeight = FontWeight.Bold,
            )
            Text(
                "登录后画像、推演与社区都会绑定到你的账号，换设备也能接着往下走。",
                color = Theme.sub,
                fontSize = 11.5.sp,
                lineHeight = 17.sp,
            )
        }

        // 登录 / 注册切换
        Row(horizontalArrangement = Arrangement.spacedBy(7.dp), modifier = Modifier.fillMaxWidth()) {
            ModeTab(
                title = "登录",
                selected = !signUp,
                modifier = Modifier.weight(1f),
            ) {
                signUp = false
                errorText = null
                noticeText = null
            }
            ModeTab(
                title = "注册",
                selected = signUp,
                modifier = Modifier.weight(1f),
            ) {
                signUp = true
                errorText = null
                noticeText = null
            }
        }

        // 输入
        Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
            AuthField {
                BasicTextField(
                    value = email,
                    onValueChange = { email = it },
                    singleLine = true,
                    textStyle = TextStyle(color = Theme.ink, fontSize = 14.sp),
                    cursorBrush = SolidColor(Theme.blue),
                    keyboardOptions = KeyboardOptions(
                        keyboardType = KeyboardType.Email,
                        imeAction = ImeAction.Next,
                    ),
                    modifier = Modifier.weight(1f),
                    decorationBox = { inner ->
                        if (email.isEmpty()) {
                            Text("邮箱地址", color = Theme.faint, fontSize = 14.sp)
                        }
                        inner()
                    },
                )
            }
            AuthField {
                BasicTextField(
                    value = password,
                    onValueChange = { password = it },
                    singleLine = true,
                    textStyle = TextStyle(color = Theme.ink, fontSize = 14.sp),
                    cursorBrush = SolidColor(Theme.blue),
                    visualTransformation = if (showPassword) VisualTransformation.None
                    else PasswordVisualTransformation(),
                    keyboardOptions = KeyboardOptions(
                        keyboardType = KeyboardType.Password,
                        imeAction = ImeAction.Go,
                    ),
                    keyboardActions = KeyboardActions(onGo = { submit() }),
                    modifier = Modifier.weight(1f),
                    decorationBox = { inner ->
                        if (password.isEmpty()) {
                            Text(
                                "密码（至少 $MIN_PASSWORD_LENGTH 位）",
                                color = Theme.faint,
                                fontSize = 14.sp,
                            )
                        }
                        inner()
                    },
                )
                Text(
                    if (showPassword) "隐藏" else "显示",
                    color = Theme.sub,
                    fontSize = 11.5.sp,
                    modifier = Modifier
                        .clip(RoundedCornerShape(8.dp))
                        .clickable { showPassword = !showPassword }
                        .padding(horizontal = 6.dp, vertical = 2.dp),
                )
            }
        }

        errorText?.let { Text(it, color = Theme.orange, fontSize = 11.sp) }
        noticeText?.let { Text(it, color = Theme.blue, fontSize = 11.sp) }

        // 提交
        val submitTitle = when {
            busy && signUp -> "注册中…"
            busy -> "登录中…"
            signUp -> "注册并进入"
            else -> "登录"
        }
        Box(
            modifier = Modifier
                .fillMaxWidth()
                .clip(RoundedCornerShape(999.dp))
                .then(
                    if (canSubmit) Modifier.background(Theme.buttonGradient)
                    else Modifier.background(Theme.raised),
                )
                .clickable(enabled = canSubmit) { submit() }
                .padding(vertical = 14.dp),
            contentAlignment = Alignment.Center,
        ) {
            Text(
                submitTitle,
                color = if (canSubmit) androidx.compose.ui.graphics.Color.White else Theme.sub,
                fontSize = 14.sp,
                fontWeight = FontWeight.SemiBold,
            )
        }

        // 分隔线
        Row(
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(12.dp),
            modifier = Modifier.fillMaxWidth(),
        ) {
            Box(Modifier.weight(1f).height(1.dp).background(Theme.line))
            Text("或", color = Theme.faint, fontSize = 11.sp)
            Box(Modifier.weight(1f).height(1.dp).background(Theme.line))
        }

        // 微信登录（预留）：wechatEnabled=false 时按 iOS 行为不显示
        if (wechatEnabled) {
            Box(
                modifier = Modifier
                    .fillMaxWidth()
                    .clip(RoundedCornerShape(999.dp))
                    .background(androidx.compose.ui.graphics.Color(0xFF07C160))
                    .clickable { /* TODO(wechat-login): 微信开放平台资质到位后实现 */ }
                    .padding(vertical = 14.dp),
                contentAlignment = Alignment.Center,
            ) {
                Text(
                    "微信登录",
                    color = androidx.compose.ui.graphics.Color.White,
                    fontSize = 14.sp,
                    fontWeight = FontWeight.SemiBold,
                )
            }
        }

        Text(
            "继续即代表同意用户协议与隐私政策。",
            color = Theme.faint,
            fontSize = 10.5.sp,
            lineHeight = 15.sp,
        )
    }
}

@Composable
private fun ModeTab(
    title: String,
    selected: Boolean,
    modifier: Modifier = Modifier,
    onClick: () -> Unit,
) {
    Box(
        modifier = modifier
            .clip(RoundedCornerShape(999.dp))
            .then(
                if (selected) Modifier.background(Theme.buttonGradient)
                else Modifier.background(Theme.raised),
            )
            .clickable { onClick() }
            .padding(vertical = 9.dp),
        contentAlignment = Alignment.Center,
    ) {
        Text(
            title,
            color = if (selected) androidx.compose.ui.graphics.Color.White else Theme.sub,
            fontSize = 12.5.sp,
            fontWeight = if (selected) FontWeight.SemiBold else FontWeight.Normal,
        )
    }
}

@Composable
private fun AuthField(content: @Composable androidx.compose.foundation.layout.RowScope.() -> Unit) {
    Row(
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(10.dp),
        modifier = Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(13.dp))
            .background(Theme.raised)
            .border(1.dp, Theme.line, RoundedCornerShape(13.dp))
            .padding(horizontal = 14.dp, vertical = 13.dp),
        content = content,
    )
}

/** 邮箱格式校验，对应 iOS emailValid：含 @、域名非空且含点、不以点结尾。 */
private fun isEmailValid(raw: String): Boolean {
    val trimmed = raw.trim()
    val at = trimmed.indexOf('@')
    if (at <= 0) return false
    val domain = trimmed.substring(at + 1)
    return domain.isNotEmpty() && domain.contains('.') && !domain.endsWith(".") && !domain.contains('@')
}

/** 邮箱已被注册 —— 注册 tab 据此自动切到登录 tab。 */
private fun isEmailExistsError(e: Throwable): Boolean {
    val m = e.message?.lowercase().orEmpty()
    return m.contains("already registered") || m.contains("user_already_exists") ||
        m.contains("email_exists") || m.contains("already been registered") ||
        (m.contains("already") && m.contains("exist"))
}

/** Auth 错误 → 用户可读中文提示（对应 iOS authErrorMessage；未收录回落原始描述）。 */
private fun authErrorMessage(e: Throwable): String {
    val m = e.message?.lowercase().orEmpty()
    return when {
        isEmailExistsError(e) -> "该邮箱已注册，请直接登录"
        m.contains("invalid") && (m.contains("credential") || m.contains("login") || m.contains("password")) ->
            "邮箱或密码不正确"
        m.contains("weak") && m.contains("password") -> "密码至少需要 6 位"
        m.contains("email_not_confirmed") || m.contains("not confirmed") -> "邮箱尚未验证，请查收确认邮件"
        m.contains("rate limit") || m.contains("too many") -> "操作过于频繁，请稍后再试"
        m.contains("validation") -> "邮箱格式不正确"
        e.message.isNullOrBlank() -> "登录失败，请稍后重试"
        else -> e.message!!
    }
}
