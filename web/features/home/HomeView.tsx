"use client";
/* 首页「认识你自己」—— 移植 iOS HomeView。
   问候 · 语音日记 · AI 发问 · 人生卡牌入口 · 动态画像。移动端单列，md 起画像五维双栏。 */

import { useEffect, useMemo } from "react";
import { PageShell } from "@/components/shell/PageShell";
import { useData } from "@/stores/data";
import { useHome } from "./store";
import { DiaryCard } from "./DiaryCard";
import { AskCard } from "./AskCard";
import { LifeEntryButton } from "./LifeEntryButton";
import { PortraitSection } from "./PortraitSection";
import { PersonaHero } from "./PersonaHero";

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

  /* personaModel / completion 是 store 的派生方法，getState() 读不出订阅关系。
     必须显式订阅它们依赖的两个源（填写的维度 + 远端画像），
     否则填完一个维度后 hero 的形象与完成度不会跟着变。
     卡牌来自 useData，由 lifeSignatureCards 内部读取，这里一并订阅。 */
  const filledDims = useHome((s) => s.filledDims);
  const remotePersona = useHome((s) => s.remotePersona);
  const cardGames = useData((s) => s.profile?.card_games);

  const model = useMemo(
    () => useHome.getState().personaModel(),
    [filledDims, remotePersona, cardGames],
  );
  const completion = useMemo(() => useHome.getState().completion(), [filledDims]);
  const hasLifeCards = useMemo(
    () => useHome.getState().lifeSignatureCards().length >= 3,
    [cardGames],
  );

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
      {/* 首页是画像主场：数字形象撑第一屏，其余页面里它退居右轨伴随。
          原来它排在页面最后、被压成扁条，产品最核心的资产要滚一屏才看得见。 */}
      <PersonaHero
        model={model}
        userName={USER_NAME}
        summary={remotePersona?.summary}
        hasLifeCards={hasLifeCards}
        completion={completion}
      />

      {/* 每日三件事。三张卡的内容体量差得很远：发问卡有标题+输入框+话题 chip
          （约 330px），日记卡只有一行周历（约 180px），卡牌入口就一行（约 90px）。
          等宽三列配 items-stretch 会把三者拉成同高，日记与卡牌于是各空出一大片 ——
          线上实测确认了这一点。改回两栏：左列纵向摞日记+卡牌，右列发问跨两行，
          栅格高度因此贴着内容走。
          手机保持 日记 → 发问 → 卡牌 的纵向顺序（与 iOS 一致），所以用显式
          col-start/row-start 定位而不是靠 DOM 顺序，也不用 order 兜底。
          items-start 是关键：之前那版用 self-end 把卡牌压到行底，才在日记
          下面顶出一道刻意的缝。
          grid-rows-[auto_1fr] 同样关键：默认 auto 行会把发问卡跨行的富余高度
          均摊给两行，日记与卡牌之间又会浮出约 70px；显式让第一行贴合日记、
          富余全部落到第二行，卡牌就紧跟在日记下面。 */}
      <div className="mt-5 grid grid-cols-1 items-start gap-[18px] lg:mt-7 lg:grid-cols-2 lg:grid-rows-[auto_1fr] lg:gap-5 xl:gap-6">
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
