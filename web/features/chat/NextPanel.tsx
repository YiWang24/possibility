"use client";
/* 下一步面板 —— 移植自 iOS ChatSummaryView.ChatNextPanel / ChatTravelerCard
 *
 * 回答完成后给出塔罗预测分析 / 人生实验室两个行动入口；
 * 相似经验直接用下方的用户卡片呈现，不再重复放一张功能卡。 */

import Link from "next/link";
import { TravelerAvatar } from "@/components/ui/Avatar";
import { hue, mockAvatarById } from "@/lib/theme";
import type { Traveler } from "@/lib/models";
import type { RecommendedNextStep } from "./store";

function PathCell({
  icon,
  title,
  note,
  className,
  onClick,
  href,
}: {
  icon: string;
  title: string;
  note: string;
  className?: string;
  onClick?: () => void;
  href?: string;
}) {
  const content = (
    <>
      <span className="text-lead text-ink">{icon}</span>
      <span className="text-caption font-semibold text-ink mt-[7px]">{title}</span>
      <span className="text-micro leading-[1.5] text-faint mt-[3px]">{note}</span>
    </>
  );
  const classes = `flex-1 flex flex-col items-start p-[11px] rounded-tile text-left transition active:scale-[0.97] ${className ?? ""}`;
  if (href) return <Link href={href} onClick={onClick} className={classes}>{content}</Link>;
  return <button onClick={onClick} className={classes}>{content}</button>;
}

function ChatTravelerCard({ traveler, reason }: { traveler: Traveler; reason?: string }) {
  const h = hue(traveler.hue);
  return (
    <div
      className="relative w-[136px] h-[136px] p-3 rounded-tile bg-card overflow-hidden flex flex-col items-start text-left"
      style={{ border: `1px solid ${h.accent}52` }}
    >
      <div
        className="absolute w-[88px] h-[88px] rounded-full pointer-events-none"
        style={{ background: h.accent, opacity: 0.22, filter: "blur(22px)", right: -14, top: -30 }}
      />
      <div className="relative z-10 flex items-center gap-2 w-full">
        <TravelerAvatar
          initial={traveler.initial}
          hueIndex={traveler.hue}
          size={32}
          imageSrc={traveler.id > 0 ? mockAvatarById(traveler.id) : null}
        />
        <span className="text-footnote font-semibold text-ink truncate">{traveler.name}</span>
      </div>
      <p className="relative z-10 text-micro leading-[1.5] text-sub mt-2.5 line-clamp-3">{reason ?? traveler.quote}</p>
      <div className="flex-1" />
      {traveler.tags[0] ? (
        <span className="relative z-10 text-micro text-brand-lite truncate">{traveler.tags[0]}</span>
      ) : null}
    </div>
  );
}

export function ChatNextPanel({
  preferredPath,
  matchedTravelers,
  matchReasons,
  onGoLab,
  onGoSimilar,
  onTarot,
  showTarot = true,
  labHref,
}: {
  preferredPath: RecommendedNextStep | null;
  matchedTravelers: Traveler[];
  matchReasons: Record<number, string>;
  onGoLab: () => void;
  onGoSimilar: () => void;
  onTarot: () => void;
  showTarot?: boolean;
  labHref: string;
}) {
  const recommendedLabel = preferredPath === "match" ? "优先看相似经验" : preferredPath === "lab" ? "优先放进实验室" : null;

  return (
    <div
      className="rounded-card p-3.5 flex flex-col"
      style={{
        background: "linear-gradient(135deg,rgba(94,150,255,0.11),rgba(143,123,255,0.055))",
        border: "1px solid rgba(111,165,255,0.2)",
      }}
    >
      <span className="text-body font-semibold text-ink">用不同方式继续看这个问题</span>
      {recommendedLabel ? <span className="mt-1 text-micro text-faint">基于这轮回答，{recommendedLabel}</span> : null}

      <div className={`mt-[11px] grid gap-2 ${showTarot ? "sm:grid-cols-2" : "grid-cols-1"}`}>
        {showTarot ? (
          <PathCell
            icon="✦"
            title="塔罗预测分析"
            note="抽 3 张牌，换一个象征视角"
            className="border border-brand-bright/35 bg-brand/15"
            onClick={onTarot}
          />
        ) : null}
        <PathCell
          icon="◉"
          title="带入人生实验室"
          note="推演不同选择与现实代价"
          className="border border-line bg-white/[0.045]"
          onClick={onGoLab}
          href={labHref}
        />
      </div>

      {matchedTravelers.length === 0 && preferredPath === "match" ? (
        <div className="mt-[11px] flex items-center gap-[9px] rounded-tile border border-line bg-white/[0.045] p-[13px]">
          <span className="h-4 w-4 shrink-0 animate-spin rounded-full border-2 border-brand-lite border-t-transparent" />
          <span className="text-caption text-sub">正在为你找走过相似处境的人…</span>
        </div>
      ) : null}

      {matchedTravelers.length > 0 ? (
        <>
          <span className="mt-[13px] text-micro tracking-[1.6px] text-brand-lite">与你当前处境接近的经验</span>
          <div className="mt-[9px] flex gap-2.5 overflow-x-auto pb-1">
            {matchedTravelers.slice(0, 2).map((t) =>
              t.id > 0 ? (
                <Link key={t.id} href={`/traveler/${t.id}`} className="shrink-0 transition active:scale-[0.97]">
                  <ChatTravelerCard traveler={t} reason={matchReasons[t.id]} />
                </Link>
              ) : (
                <button key={t.id} onClick={onGoSimilar} className="shrink-0 transition active:scale-[0.97]">
                  <ChatTravelerCard traveler={t} reason={matchReasons[t.id]} />
                </button>
              ),
            )}
          </div>
        </>
      ) : null}

    </div>
  );
}
