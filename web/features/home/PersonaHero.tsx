"use client";
/* 首页主视觉 —— 动态数字形象撑起第一屏。

   原来它排在首页最后，被压成 1030×200 的扁条，落在折叠线以下：
   产品最核心的资产（一个持续生长、由你的对话与日记喂养出来的形象）
   在桌面上要滚一屏才看得见，第一屏留给了问候语和两张工具卡。

   这里把它提到第一屏并拆成两栏：左边讲「这是谁、长到哪一步」，
   右边是形象本体。横向空间因此有了内容，而不是靠拉宽卡片来填。 */

import { useRouter } from "next/navigation";
import { PersonaStage } from "./PersonaStage";
import type { PersonaModel } from "./persona";

export function PersonaHero({
  model,
  userName,
  summary,
  hasLifeCards,
  completion,
  paused = false,
}: {
  model: PersonaModel;
  userName: string;
  summary?: string | null;
  hasLifeCards: boolean;
  completion: { completed: number; total: number; percent: number };
  paused?: boolean;
}) {
  const router = useRouter();
  const started = completion.completed > 0;

  return (
    <section className="kaleido-card grid grid-cols-1 items-stretch overflow-hidden lg:min-h-[380px] lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)] xl:min-h-[440px]">
      {/* 左：身份与进度 */}
      <div className="flex flex-col justify-center gap-5 px-6 py-7 xl:px-9 xl:py-10">
        <div className="flex flex-col gap-2.5">
          <span className="text-eyebrow text-faint">MY LIVE PORTRAIT</span>
          <h2 className="text-display font-bold text-ink">
            {userName}的
            <span className="text-aurora">{model.shapeName}</span>
          </h2>
          <p className="max-w-[46ch] text-[13px] leading-[1.9] text-sub xl:text-[14px]">
            {summary && summary.length > 0
              ? summary
              : started
                ? "它由你已经填下的画像维度生成，每多说一点就会长一点。"
                : "它现在还很模糊 —— 说说你自己，看它一点点长成你的样子。"}
          </p>
        </div>

        {/* 完成度 */}
        <div className="flex flex-col gap-2">
          <div className="flex items-baseline justify-between">
            <span className="text-[11.5px] text-faint">画像完成度</span>
            <span className="text-[12px] tabular-nums text-sub">
              {completion.completed}/{completion.total} · {completion.percent}%
            </span>
          </div>
          <div className="h-[6px] overflow-hidden rounded-chip bg-raised">
            <div
              className="h-full rounded-chip bg-aurora transition-all duration-500"
              style={{ width: `${completion.percent}%` }}
            />
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            onClick={() => router.push("/studio")}
            className="rounded-chip bg-btn-g px-[22px] py-3 text-[13px] font-semibold text-white transition active:scale-[0.97]"
          >
            {started ? "继续雕刻画像" : "开始塑造画像"}
          </button>
          <button
            onClick={() => router.push("/lab")}
            className="rounded-chip border border-line px-[18px] py-3 text-[13px] font-medium text-sub transition hover:border-brand/45 hover:text-ink"
          >
            拿它去推演一次 ›
          </button>
        </div>
      </div>

      {/* 右：形象本体。舞台自带背景，出血到卡片边沿 */}
      <div className="min-h-[300px] border-t border-line lg:min-h-0 lg:border-l lg:border-t-0">
        <PersonaStage
          model={model}
          userName={userName}
          summary={summary}
          hasLifeCards={hasLifeCards}
          paused={paused}
          size="fill"
        />
      </div>
    </section>
  );
}
