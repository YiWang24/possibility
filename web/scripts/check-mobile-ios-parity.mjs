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
  ["<DiaryCard", "<AskCard", "<LifeEntryButton", "<PersonaHero"],
  "手机首页 DOM 顺序必须保持日记、发问、卡牌、画像",
);
requireText(
  "features/home/HomeView.tsx",
  "lg:row-start-1",
  "桌面可以提升画像 hero，但不得改变手机 DOM 顺序",
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
