"use client";
/* 下一步面板 —— 移植自 iOS ChatSummaryView.ChatNextPanel / ChatTravelerCard
 *
 * 「信息已经足够 · 选择下一步」：去人生实验室 / 看走过这条路的人（/match 命中 2 张方形旅人卡）/ 分享 + 可选完整总结链接。 */

import Link from "next/link";
import { TravelerAvatar } from "@/components/ui/Avatar";
import { hue, mockAvatarById } from "@/lib/theme";
import { useToast } from "@/components/ui/Toast";
import type { Traveler } from "@/lib/models";
import type { RecommendedNextStep } from "./store";

function copyShare(shareText: string) {
  if (typeof navigator !== "undefined" && navigator.share) {
    void navigator.share({ text: shareText }).catch(() => {});
    return;
  }
  if (typeof navigator !== "undefined" && navigator.clipboard) {
    void navigator.clipboard.writeText(shareText);
  }
  useToast.getState().show("已复制探索文案，去分享给信任的人");
}

function PathCell({
  icon,
  title,
  note,
  className,
  onClick,
}: {
  icon: string;
  title: string;
  note: string;
  className?: string;
  onClick?: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex-1 flex flex-col items-start p-[11px] rounded-tile text-left transition active:scale-[0.97] ${className ?? ""}`}
    >
      <span className="text-lead text-ink">{icon}</span>
      <span className="text-caption font-semibold text-ink mt-[7px]">{title}</span>
      <span className="text-micro leading-[1.5] text-faint mt-[3px]">{note}</span>
    </button>
  );
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
  showSummaryLink,
  preferredPath,
  matchedTravelers,
  matchReasons,
  onGoLab,
  onGoSimilar,
  shareText,
  onOpenSummary,
}: {
  showSummaryLink: boolean;
  preferredPath: RecommendedNextStep | null;
  matchedTravelers: Traveler[];
  matchReasons: Record<number, string>;
  onGoLab: () => void;
  onGoSimilar: () => void;
  shareText: string;
  onOpenSummary?: () => void;
}) {
  const eyebrow = preferredPath == null ? "信息已经足够 · 选择下一步" : "这轮探索先到这里 · 为你推荐";
  const title =
    preferredPath === "match"
      ? "看看走过相似处境的人"
      : preferredPath === "lab"
        ? "把现在的判断放进现实里推演"
        : "把刚才的理解带去哪里？";

  const shareCell = (
    <PathCell
      icon="↗"
      title="分享这次探索"
      note="发给一个你信任的人"
      className="bg-white/[0.045] border border-line"
      onClick={() => copyShare(shareText)}
    />
  );

  return (
    <div
      className="rounded-card p-3.5 flex flex-col"
      style={{
        background: "linear-gradient(135deg,rgba(94,150,255,0.11),rgba(143,123,255,0.055))",
        border: "1px solid rgba(111,165,255,0.2)",
      }}
    >
      <span className="text-micro tracking-[1.6px] text-brand-lite">{eyebrow}</span>
      <span className="text-body font-semibold text-ink mt-[5px]">{title}</span>

      {preferredPath !== "match" ? (
        <button
          onClick={onGoLab}
          className="mt-[11px] text-left p-[11px] rounded-tile transition active:scale-[0.98]"
          style={{
            background: "linear-gradient(135deg,rgba(62,112,232,0.28),rgba(107,85,211,0.18))",
            border: "1px solid rgba(111,165,255,0.34)",
          }}
        >
          <span className="text-lead text-ink block">◉</span>
          <span className="text-caption font-semibold text-ink mt-[7px] block">去人生实验室</span>
          <span className="text-micro leading-[1.5] text-faint mt-[3px] block">带着当前问题，推演几种可能</span>
        </button>
      ) : null}

      {preferredPath === "lab" ? (
        <div className="mt-2 flex gap-2">{shareCell}</div>
      ) : matchedTravelers.length === 0 && preferredPath === "match" ? (
        <div className="mt-[11px] flex items-center gap-2.5 p-[13px] rounded-tile bg-white/[0.045] border border-line">
          <span className="w-3.5 h-3.5 rounded-full border-2 border-brand-lite border-t-transparent animate-spin" />
          <span className="text-caption text-sub">正在为你找走过相似处境的人…</span>
        </div>
      ) : matchedTravelers.length === 0 ? (
        <div className="mt-2 flex gap-2">
          <PathCell
            icon="⌁"
            title="看相似经历"
            note="去社区找走过这段路的人"
            className="bg-white/[0.045] border border-line"
            onClick={onGoSimilar}
          />
          {shareCell}
        </div>
      ) : (
        <>
          <span className="text-micro tracking-[1.6px] text-brand-lite mt-[13px]">看看走过这条路的人</span>
          <div className="flex gap-2.5 mt-[9px]">
            {matchedTravelers.slice(0, 2).map((t) =>
              t.id > 0 ? (
                <Link key={t.id} href={`/traveler/${t.id}`} className="transition active:scale-[0.97]">
                  <ChatTravelerCard traveler={t} reason={matchReasons[t.id]} />
                </Link>
              ) : (
                <button key={t.id} onClick={onGoSimilar} className="transition active:scale-[0.97]">
                  <ChatTravelerCard traveler={t} reason={matchReasons[t.id]} />
                </button>
              ),
            )}
          </div>
          <div className="mt-2 flex gap-2">{shareCell}</div>
        </>
      )}

      {showSummaryLink ? (
        <button onClick={onOpenSummary} className="mt-[11px] text-micro text-brand-lite self-center">
          先查看完整总结 →
        </button>
      ) : null}
    </div>
  );
}
