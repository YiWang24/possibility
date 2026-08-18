import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");

function source(path) {
  return readFileSync(resolve(root, path), "utf8");
}

function requireText(path, text, reason) {
  if (!source(path).includes(text)) {
    throw new Error(`${path}: ${reason}`);
  }
}

function forbidText(path, text, reason) {
  if (source(path).includes(text)) {
    throw new Error(`${path}: ${reason}`);
  }
}

function requireOrder(path, texts, reason) {
  const content = source(path);
  const positions = texts.map((text) => content.indexOf(text));
  if (positions.some((position) => position < 0)) {
    throw new Error(`${path}: ${reason}（缺少目标节点）`);
  }
  if (positions.some((position, index) => index > 0 && position <= positions[index - 1])) {
    throw new Error(`${path}: ${reason}`);
  }
}

requireText(
  "app/layout.tsx",
  'viewportFit: "cover"',
  "iPhone safe-area 样式需要 viewport-fit=cover 才能覆盖刘海与底部手势区",
);
requireText(
  "components/shell/MobileDetailHeader.tsx",
  "pt-[calc(env(safe-area-inset-top)+12px)]",
  "手机详情栏必须避开 iOS safe area",
);
requireText(
  "components/shell/MobileDetailHeader.tsx",
  "md:hidden",
  "iOS 风格详情栏只能出现在手机断点",
);
requireText(
  "components/shell/PageShell.tsx",
  "pt-[calc(env(safe-area-inset-top)+20px)]",
  "一级页面必须保留 iOS 的 safe-area 后 20px 顶部留白",
);
requireOrder(
  "features/home/HomeView.tsx",
  ["<DiaryCard", "<AskCard", "<LifeEntryButton", "<PortraitSection"],
  "手机首页 DOM 顺序必须保持日记、发问、卡牌、画像",
);
requireOrder(
  "features/home/PortraitSection.tsx",
  ['title="我的动态画像"', "尼采《道德的系谱》", "<PersonaStage", "{/* 画像卡 */}"],
  "动态数字形象必须位于画像引文之后、画像维度之前",
);
requireText(
  "lib/dimensions.ts",
  'href: "/assessment/want-to-do"',
  "我喜欢与我擅长必须保留“喜欢 × 擅长”探索入口",
);
requireText(
  "features/studio/WantToDoView.tsx",
  'saveDimension("like"',
  "方法论结果必须写回“我喜欢”维度",
);
requireText(
  "features/studio/WantToDoView.tsx",
  'saveDimension("skill"',
  "方法论结果必须写回“我擅长”维度",
);
requireText(
  "features/studio/self-discovery.ts",
  "实验：用${strength}探索${like.tag}",
  "结果页必须把喜欢与擅长组合为可验证方向",
);
requireText(
  "features/studio/WantToDoView.tsx",
  '"analyze-self-discovery"',
  "完整探索必须调用服务端 AI 分析",
);
requireText(
  "features/studio/WantToDoView.tsx",
  "写下 1–3 句真实经历",
  "开放叙事题必须支持用户自由输入真实经历",
);
requireText(
  "features/home/PortraitSection.tsx",
  'label: "我喜欢 × 我擅长"',
  "动态画像首卡必须直达喜欢与擅长的完整探索",
);
requireText(
  "features/studio/WantToDoView.tsx",
  "解锁完整深入报告 ¥9.9",
  "完整探索必须先展示免费基本结论，再提供 ¥9.9 完整行动报告",
);
requireText(
  "features/home/DimensionSheet.tsx",
  "中文专业测评 · 跳转官方",
  "动态画像工具必须区分站内探索与第三方官方测评",
);
requireText(
  "lib/dimensions.ts",
  "https://www.viacharacter.org/pro/xuan/account/register",
  "我擅长必须保留可选择中文的 VIA 官方优势测评入口",
);
forbidText(
  "lib/dimensions.ts",
  "https://onetinterestprofiler.org/",
  "不得加入仅提供英文作答的 O*NET 外部入口",
);
forbidText(
  "lib/dimensions.ts",
  "labs.psychology.illinois.edu",
  "不得加入仅提供英文说明的 ECR-RS 外部入口",
);
requireText(
  "features/studio/assessment/data.ts",
  'kind: "social"',
  "人际关系维度必须提供可写回画像的站内测评",
);
for (const [path, socialKind, discoveryMarker] of [
  ["../ios/Possibility/Core/Models/AssessmentData.swift", "case holland, bigfive, strength, love, family, social", "enum SelfDiscoveryData"],
  ["../android/app/src/main/java/app/possibility/android/features/studio/AssessmentData.kt", 'SOCIAL("social")', "object SelfDiscoveryData"],
]) {
  requireText(path, socialKind, `${path} 必须同步中文人际测评类型`);
  const discoveryPath = path.includes("android")
    ? "../android/app/src/main/java/app/possibility/android/features/studio/SelfDiscoveryScreen.kt"
    : path;
  const deepAnalysisPath = path.includes("android")
    ? "../android/app/src/main/java/app/possibility/android/features/studio/SelfDiscoveryScreen.kt"
    : "../ios/Possibility/Features/Studio/AssessmentView.swift";
  requireText(discoveryPath, discoveryMarker, `${discoveryPath} 必须同步喜欢 × 擅长完整探索`);
  // 71 题量表由「兴趣主题 09 + 优势动作 13 + 证据 + 环境 10 + 取舍 06 + 价值 + 叙事 05」生成，
  // 锁生成器的题组标签而非某道题的 id：题干可改写，题组结构不能少。
  for (const marker of ["兴趣主题 · ", "优势动作 · ", "外部证据 · E", "发挥环境 · ", "取舍判断 · ", "真实叙事 · "]) {
    requireText(discoveryPath, marker, `${discoveryPath} 必须保留完整的 71 题探索结构（缺少「${marker.trim()}」题组）`);
  }
  requireText(deepAnalysisPath, "解锁完整深入报告 ¥9.9", `${deepAnalysisPath} 必须同步完整行动报告 ¥9.9 入口`);
}
for (const path of [
  "../ios/Possibility/Core/Models/DimensionData.swift",
  "../android/app/src/main/java/app/possibility/android/features/home/DimensionData.kt",
]) {
  requireText(path, "https://www.viacharacter.org/pro/xuan/account/register", `${path} 必须保留中文 VIA 官方入口`);
  forbidText(path, "labs.psychology.illinois.edu", `${path} 不得加入仅提供英文说明的 ECR-RS 外部入口`);
}
requireText(
  "../supabase/functions/analyze-self-discovery/index.ts",
  'value.responses.length !== 71',
  "完整探索必须覆盖全部 71 个原创证据问题",
);
requireText(
  "features/community/CommunityView.tsx",
  "splitAlternating",
  "手机社区必须保持 iOS 交替双列瀑布流",
);
requireText(
  "features/community/CommunityView.tsx",
  "grid grid-cols-2 items-start gap-3 lg:hidden",
  "手机社区双列不得被桌面网格覆盖",
);

const detailPages = [
  "features/card-game/HubView.tsx",
  "features/chat/ChatView.tsx",
  "features/community/BountyDetail.tsx",
  "features/diary/DiaryDetail.tsx",
  "features/profile/ProfileView.tsx",
  "features/studio/StudioView.tsx",
];

for (const path of detailPages) {
  requireText(path, "<MobileDetailHeader", "手机详情页必须保留 iOS 返回栏");
  requireText(path, "compactMobile", "手机详情内容必须使用紧凑 iOS inset");
  requireText(path, "headerOnMobile={false}", "桌面 PageHeading 不得泄漏到手机断点");
}

for (const path of ["features/chat/ChatView.tsx", "features/diary/DiaryDetail.tsx"]) {
  requireText(path, "railOnMobile={false}", "桌面画像伴随轨不得堆到手机详情页下方");
}

for (const path of [
  "features/card-game/ui.tsx",
  "features/chat/InputBar.tsx",
  "features/community/BountyDetail.tsx",
  "features/profile/ProfileView.tsx",
]) {
  requireText(path, "env(safe-area-inset-bottom)", "底部固定操作不得被 iPhone 手势区遮挡");
}

// ==================== 塔罗 / 额度 / 付费墙 / 咨询（2026-08 审计补） ====================

// 每日基础额度三端同值
requireText("features/chat/tarot.ts", "DAILY_TAROT_LIMIT = 3", "web 塔罗每日基础次数必须为 3");
requireText("../ios/Possibility/Features/Chat/TarotModels.swift", "dailyLimit = 3", "iOS 塔罗每日基础次数必须为 3");
requireText(
  "../android/app/src/main/java/app/possibility/android/features/chat/TarotModels.kt",
  "DAILY_LIMIT = 3",
  "Android 塔罗每日基础次数必须为 3",
);

// 额度权威在服务端：三端都必须接 tarot-quota（本地缓存只作离线兜底）
requireText("features/chat/tarot.ts", '"tarot-quota"', "web 必须调用 tarot-quota 对账额度");
requireText("../ios/Possibility/Core/Network/SupabaseService.swift", '"tarot-quota"', "iOS 必须调用 tarot-quota 对账额度");
requireText(
  "../android/app/src/main/java/app/possibility/android/core/network/SupabaseService.kt",
  '"tarot-quota"',
  "Android 必须调用 tarot-quota 对账额度",
);

// 分享奖励只能在用户真的完成分享后发放
requireText(
  "../ios/Possibility/Features/Chat/TarotPanel.swift",
  "guard completed else",
  "iOS 分享奖励必须以 completionWithItemsHandler 的 completed 为准",
);
requireText(
  "../android/app/src/main/java/app/possibility/android/features/chat/TarotPanel.kt",
  "TAROT_SHARE_CHOSEN",
  "Android 分享奖励必须等 chooser 的选中回调，不得在打开分享面板时就发放",
);

// 付费墙：单商品结账（iOS ProfileModel.Checkout 结构）+ 关键动作登录门控
requireText("features/profile/PaywallView.tsx", "ProfileCheckout", "web 付费墙必须按 iOS Checkout 结算单一商品");
requireText(
  "../android/app/src/main/java/app/possibility/android/features/profile/PaywallView.kt",
  "ProfileCheckout",
  "Android 付费墙必须按 iOS Checkout 结算单一商品",
);
requireText(
  "../android/app/src/main/java/app/possibility/android/features/profile/PaywallView.kt",
  'AuthGateCenter.require("paywall")',
  "Android 付费前必须过登录门控（iOS trigger .paywall）",
);
requireText(
  "../android/app/src/main/java/app/possibility/android/features/me/MeScreen.kt",
  'AuthGateCenter.require("profile_edit")',
  "Android 编辑公开主页必须过登录门控（iOS trigger .profileEdit）",
);

// 服务卡 CTA 与咨询文案跟随 iOS
requireText("features/profile/ProfilePanels.tsx", "向 TA 咨询", "服务卡咨询 CTA 必须与 iOS 一致");
forbidText("features/profile/ProfilePanels.tsx", "选择这项服务", "不得改写 iOS 的服务卡 CTA 文案");
requireText("features/profile/ConsultChatSheet.tsx", "1 对 1 咨询", "咨询类型标签必须与 iOS 一致");
forbidText("features/profile/ConsultChatSheet.tsx", "深度咨询", "不得改写 iOS 的咨询类型标签");

// 语音日记诚实性：识别失败必须报错，不得伪造转写写库
forbidText(
  "../ios/Possibility/Features/Home/HomeModel.swift",
  "sampleTranscript",
  "iOS 不得在 ASR 失败时伪造日记转写提交 analyze-diary",
);
requireText(
  "../ios/Possibility/Features/Home/HomeModel.swift",
  "没有识别到足够的内容",
  "iOS ASR 失败必须与 Android 同款报错引导重录",
);
forbidText(
  "../ios/Possibility/Features/Home/HomeModel.swift",
  "exploredDays = 47",
  "已探索天数不得预置演示值，起点与 Android/web 一致为 1",
);

console.log("✅ 手机端 iOS 布局结构检查通过。");
