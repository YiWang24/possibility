"use client";
/* 探索总结页 —— 移植自 iOS ChatSummaryView（原型 chatSummaryPage）
 * 移动端全屏抽屉，md 起居中卡片。 */

import { PrimaryButton } from "@/components/ui/Basics";
import { ChatNextPanel } from "./NextPanel";
import { BackButton } from "./ChatChrome";
import type { ChatModel } from "./store";

function SummaryCard({
  eyebrow,
  title,
  body,
  accent,
}: {
  eyebrow: string;
  title: string;
  body: string;
  accent?: string;
}) {
  return (
    <div
      className="rounded-[20px] bg-card p-[18px]"
      style={{ border: `1px solid ${accent ?? "var(--color-line)"}` }}
    >
      <div className="text-[10px] tracking-[1.8px] text-[#91B1FF]">{eyebrow}</div>
      <div className="text-[15px] font-semibold leading-[1.4] text-ink mt-2">{title}</div>
      <p className="text-[13px] leading-[1.7] text-[#C6CDDE] mt-2">{body}</p>
    </div>
  );
}

export function ChatSummaryView({
  model,
  onGoLab,
  onGoSimilar,
  onFinish,
  onClose,
}: {
  model: ChatModel;
  onGoLab: () => void;
  onGoSimilar: () => void;
  onFinish: () => void;
  onClose: () => void;
}) {
  const answer = (index: number, fallback: string) =>
    model.answers.length > index ? model.answers[index] : fallback;

  return (
    <div className="fixed inset-0 z-[80] flex md:items-center md:justify-center">
      <button
        aria-label="关闭"
        onClick={onClose}
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
      />
      <div className="relative z-10 flex h-dvh w-full flex-col screen-bg md:h-[90dvh] md:max-w-[640px] md:rounded-sheet md:border md:border-line md:overflow-hidden">
        <div className="flex items-center gap-3 px-[22px] pt-4 pb-3">
          <BackButton onClick={onClose} />
          <div className="flex flex-col gap-0.5">
            <span className="text-[16px] font-semibold tracking-[0.8px] text-ink">本次探索总结</span>
            <span className="text-[11px] text-faint">不是定论，是此刻更清楚的你</span>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto no-scrollbar px-5 pt-2 pb-5">
          <div className="flex flex-col gap-3">
            {/* hero */}
            <div
              className="rounded-[24px] p-[22px]"
              style={{
                background: "linear-gradient(135deg,rgba(64,101,203,0.24),rgba(113,73,170,0.12))",
                border: "1px solid rgba(111,165,255,0.25)",
              }}
            >
              <div className="text-[10px] tracking-[2px] text-[#91B1FF]">
                {(model.displayTopic ?? "此刻的选择") + " · EXPLORATION NOTE"}
              </div>
              <div className="text-[22px] font-bold leading-[1.35] text-ink mt-2.5">{model.displayQuestion}</div>
              <p className="text-[12px] leading-[1.6] text-sub mt-2">
                这份总结来自刚才的对话，只记录你此刻认可的理解，不替你下结论。
              </p>
            </div>

            <SummaryCard
              eyebrow="你真正想解决的"
              title="不是选出标准答案，而是确认什么值得你承担代价"
              body="你的犹豫并不等于没有方向。它提醒你：愿望与代价需要被分开看见。"
            />
            <SummaryCard
              eyebrow="此刻的两股拉力"
              title="想靠近的，和想保护的"
              body={`一边是「${answer(0, "你真正想靠近的生活")}」；另一边是「${answer(1, "你暂时还不能轻易放下的部分")}」。两边都是真的，不必把其中一边解释成软弱。`}
              accent="rgba(169,125,255,0.25)"
            />
            <SummaryCard
              eyebrow="已经比较清楚的"
              title="你的原话比标签更重要"
              body={model.answers[model.answers.length - 1] ?? "你愿意先理解自己的真实需要，再做决定。"}
            />
            <SummaryCard
              eyebrow="下一步的小验证"
              title="先收集一个真实证据"
              body={"未来 7 天，做一次成本很低、可以撤回的小尝试。记录行动前后的期待、精力和抗拒，再判断你是“不想要”，还是“暂时承担不起”。"}
              accent="rgba(62,217,164,0.25)"
            />

            <div className="mt-0.5">
              <ChatNextPanel
                showSummaryLink={false}
                preferredPath={model.recommendedNextStep}
                matchedTravelers={model.matchedTravelers}
                matchReasons={model.matchReasons}
                onGoLab={onGoLab}
                onGoSimilar={onGoSimilar}
                shareText={model.shareText}
              />
            </div>
          </div>
        </div>

        <div className="px-5 pt-2.5 pb-3">
          <PrimaryButton title="完成本次探索" onClick={onFinish} />
        </div>
      </div>
    </div>
  );
}
