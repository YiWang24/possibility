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
      <div className="flex items-end justify-between">
        <div className="flex flex-col gap-1.5">
          <span className="text-[11px] tracking-[3px] text-faint">{todayText()}</span>
          <h1 className="text-[27px] font-bold tracking-[0.8px] text-ink">
            {greeting()}，{USER_NAME}
          </h1>
        </div>
        <div className="flex flex-col items-end gap-0.5">
          <span className="text-[12px] text-sub">已探索</span>
          <span className="text-aurora text-[16px] font-bold">第 {exploredDays} 天</span>
        </div>
      </div>

      <div className="mt-[18px]">
        <DiaryCard />
      </div>
      <div className="mt-[22px]">
        <AskCard />
      </div>
      <div className="mt-3.5">
        <LifeEntryButton />
      </div>
      <div className="mt-6">
        <PortraitSection />
      </div>
    </PageContainer>
  );
}
