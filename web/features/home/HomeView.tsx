"use client";
/* 首页「认识你自己」—— 移植 iOS HomeView。
   问候 · 语音日记 · AI 发问 · 人生卡牌入口 · 动态画像。移动端单列，md 起画像五维双栏。 */

import { useEffect } from "react";
import { PageShell } from "@/components/shell/PageShell";
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
    <PageShell
      header={
        /* 问候 */
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
      }
    >
      {/* 首屏区块。DOM 顺序 = 手机顺序 = iOS 顺序：语音日记 → 发问 → 卡牌。
          三张卡的内容体量差得很远（发问约 330px / 日记约 130px / 卡牌约 87px），
          等宽三列配 items-stretch 会把三者拉平、卡内各空一大片；两栏 +
          items-start 才贴着内容走。grid-rows 的 auto 档同样关键：默认 auto 行会把
          发问卡跨行的富余高度均摊给两行，日记与卡牌之间会浮出约 70px。 */}
      <div className="mt-5 grid grid-cols-1 items-start gap-[18px] lg:mt-7 lg:grid-cols-2 lg:grid-rows-[auto_auto] lg:gap-5 xl:gap-6">
        <div className="lg:col-start-1 lg:row-start-1">
          <DiaryCard />
        </div>
        <div className="lg:col-start-2 lg:row-span-2 lg:row-start-1">
          <AskCard />
        </div>
        <div className="lg:col-start-1 lg:row-start-2">
          <LifeEntryButton />
        </div>
      </div>

      {/* 画像维度通栏 —— 六维行需要宽度，塞进侧轨会挤成两列窄条 */}
      <div className="mt-8 lg:mt-14">
        <PortraitSection />
      </div>
    </PageShell>
  );
}
