"use client";
/* 首页「认识你自己」—— 移植 iOS HomeView。
   问候 · 语音日记 · AI 发问 · 人生卡牌入口 · 动态画像。移动端单列，md 起画像五维双栏。 */

import { useEffect } from "react";
import { PageContainer } from "@/components/shell/PageContainer";
import { useHome } from "./store";
import { DiaryCard } from "./DiaryCard";
import { AskCard } from "./AskCard";
import { LifeEntryButton } from "./LifeEntryButton";
import { PortraitSection } from "./PortraitSection";

const USER_NAME = "老己";

function todayText(): string {
  const d = new Date();
  const weekday = ["星期日", "星期一", "星期二", "星期三", "星期四", "星期五", "星期六"][d.getDay()];
  return `${d.getMonth() + 1}月${d.getDate()}日 · ${weekday}`;
}

/** 按当前小时问候（对齐原型问候语气） */
function greeting(): string {
  const h = new Date().getHours();
  if (h < 6) return "凌晨好";
  if (h < 12) return "早上好";
  if (h < 14) return "中午好";
  if (h < 18) return "下午好";
  return "晚上好";
}

export function HomeView() {
  const loadPortrait = useHome((s) => s.loadPortrait);
  const loadDiaryOverview = useHome((s) => s.loadDiaryOverview);
  const exploredDays = useHome((s) => s.exploredDays);

  useEffect(() => {
    void loadPortrait();
    void loadDiaryOverview();
  }, [loadPortrait, loadDiaryOverview]);

  return (
    <PageContainer>
      {/* 问候 */}
      <header className="flex items-end justify-between gap-6">
        <div className="flex flex-col gap-1.5">
          <span className="text-eyebrow text-faint">{todayText()}</span>
          <h1 className="text-display font-bold text-ink">
            {greeting()}，{USER_NAME}
          </h1>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-0.5">
          <span className="text-footnote text-sub">已探索</span>
          <span className="text-aurora text-subtitle font-bold xl:text-[19px]">
            第 {exploredDays} 天
          </span>
        </div>
      </header>

      {/* 每日三件事：手机保持 日记 → 发问 → 卡牌 的纵向顺序（与 iOS 一致），
          桌面用显式栅格定位改成「左列 日记 + 卡牌 / 右列 发问」两栏。
          用 col-start/row-start 而不是套一层 flex 容器，DOM 顺序才不会被布局绑架。 */}
      <div className="mt-[18px] grid grid-cols-1 items-start gap-[18px] lg:mt-8 lg:grid-cols-2 lg:gap-6 xl:gap-8">
        <div className="lg:col-start-1 lg:row-start-1">
          <DiaryCard />
        </div>
        <div className="lg:col-start-2 lg:row-span-2 lg:row-start-1">
          <AskCard />
        </div>
        {/* 发问卡跨两行会把行高撑开，self-end 让卡牌入口底边与它对齐，
            富余空间收成一条刻意的基线而不是一块散着的空白 */}
        <div className="lg:col-start-1 lg:row-start-2 lg:self-end">
          <LifeEntryButton />
        </div>
      </div>

      {/* 画像通栏 —— 六维行需要宽度，塞进右轨会挤成两列窄条 */}
      <div className="mt-6 lg:mt-12">
        <PortraitSection />
      </div>
    </PageContainer>
  );
}
