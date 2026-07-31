package app.possibility.android.features.auth

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.layout.offset
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.statusBarsPadding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.ModalBottomSheet
import androidx.compose.material3.Text
import androidx.compose.material3.rememberModalBottomSheetState
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.blur
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import app.possibility.android.core.theme.Theme

// 全屏登录墙（冷启动无会话）：品牌视觉 + 「登录 / 注册」按钮 → 弹 LoginSheet。
// 对应 ios/Possibility/Features/Auth/LoginSheet.swift 的 AuthWallView + .wall 头部。
// 全部 Edge Function 都强制校验 JWT，未登录时任何页面都只会换回 401，
// 所以冷启动直接拦在这里，而不是让用户进去看一屏报错。

/** 登录墙容器色，对应 iOS presentationBackground(0x10131C)。 */
private val SheetBackground = Color(0xFF10131C)

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun AuthWallView() {
    var showSheet by remember { mutableStateOf(false) }
    val sheetState = rememberModalBottomSheetState(skipPartiallyExpanded = true)

    Box(
        modifier = Modifier
            .fillMaxSize()
            .background(Theme.stage),
    ) {
        // 极光氛围球：右上角一枚模糊光斑立住品牌气质
        Box(
            modifier = Modifier
                .align(Alignment.TopEnd)
                .offset(x = 60.dp, y = (-40).dp)
                .size(260.dp)
                .blur(90.dp)
                .clip(RoundedCornerShape(999.dp))
                .background(Theme.aurora),
        )

        Column(
            modifier = Modifier
                .fillMaxSize()
                .statusBarsPadding()
                .navigationBarsPadding()
                .padding(horizontal = 26.dp)
                .padding(top = 72.dp, bottom = 32.dp),
        ) {
            // 头部：靠尺度对比与一道极光竖线立住品牌
            Row(horizontalArrangement = Arrangement.spacedBy(14.dp)) {
                Box(
                    modifier = Modifier
                        .width(3.dp)
                        .height(150.dp)
                        .clip(RoundedCornerShape(999.dp))
                        .background(Theme.aurora),
                )
                Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
                    Text(
                        "POSSIBILITY · 万花筒",
                        color = Theme.faint,
                        fontSize = 11.sp,
                        letterSpacing = 3.5.sp,
                    )
                    Text(
                        "认识你自己，\n推演你的人生可能性",
                        color = Theme.ink,
                        fontSize = 28.sp,
                        fontWeight = FontWeight.Bold,
                        lineHeight = 38.sp,
                    )
                    Text(
                        "画像、推演与社区都绑定在你的账号上。用邮箱注册一个可以找回的身份，换设备也能接着往下走。",
                        color = Theme.sub,
                        fontSize = 12.5.sp,
                        lineHeight = 20.sp,
                    )
                }
            }

            Spacer(Modifier.weight(1f))

            // 「登录 / 注册」CTA
            Box(
                modifier = Modifier
                    .fillMaxWidth()
                    .clip(RoundedCornerShape(999.dp))
                    .background(Theme.buttonGradient)
                    .clickable { showSheet = true }
                    .padding(vertical = 16.dp),
                contentAlignment = Alignment.Center,
            ) {
                Text(
                    "登录 / 注册",
                    color = Color.White,
                    fontSize = 15.sp,
                    fontWeight = FontWeight.SemiBold,
                )
            }

            Text(
                "邮箱注册，安全找回 · 支持换设备继续",
                color = Theme.faint,
                fontSize = 11.sp,
                modifier = Modifier
                    .padding(top = 12.dp)
                    .align(Alignment.CenterHorizontally),
            )
        }
    }

    if (showSheet) {
        ModalBottomSheet(
            onDismissRequest = { showSheet = false },
            sheetState = sheetState,
            containerColor = SheetBackground,
        ) {
            // 登录墙由 isAuthenticated 自动切走，成功后只需收起 sheet。
            LoginSheet(onDismiss = { showSheet = false })
        }
    }
}
