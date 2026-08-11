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
  "用${strength?.tag ?? \"你的优势\"}，去探索${like.tag}",
  "结果页必须把喜欢与擅长组合为可验证方向",
);
requireText(
  "features/studio/WantToDoView.tsx",
  '"analyze-self-discovery"',
  "完整探索必须调用服务端 AI 分析",
);
requireText(
  "features/studio/WantToDoView.tsx",
  "写下真实答案，按回车添加",
  "每个探索问题必须支持用户自由输入",
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
  requireText(discoveryPath, discoveryMarker, `${discoveryPath} 必须同步喜欢 × 擅长完整探索`);
  requireText(discoveryPath, "value-contribution", `${discoveryPath} 必须保留全部 12 题的最后一题`);
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
  'value.responses.length !== 12',
  "完整探索必须覆盖全部 12 个原创证据问题",
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

console.log("✅ 手机端 iOS 布局结构检查通过。");
