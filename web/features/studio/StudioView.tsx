"use client";
/* 画像工坊 —— 移植 iOS ProfileStudioView.swift。
   大五人格主卡（含 MBTI 倾向）+ 生活画像五维（关键词浮层）+ MBTI 轴向展示。全屏页。 */

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { PageShell } from "@/components/shell/PageShell";
import { BackButton } from "@/features/card-game/ui";
import { SectionHeader } from "@/components/ui/Basics";
import { DIMENSIONS, DIMENSION_KEYS, type DimensionKey } from "@/lib/dimensions";
import { useHome } from "@/features/home/store";
import { DimensionSheet } from "@/features/home/DimensionSheet";
import { assessmentConfig } from "@/features/studio/assessment/data";
import { hydrateDims, loadResult, type AssessmentResult, type DimScore } from "@/features/studio/assessment/engine";

/** MBTI 四轴的中文说明（由大五推导时展示） */
const MBTI_AXES: { letters: [string, string]; from: string; hi: string; lo: string }[] = [
  { letters: ["E", "I"], from: "外向", hi: "外向 · 主动联结", lo: "内向 · 安静蓄能" },
  { letters: ["N", "S"], from: "开放", hi: "直觉 · 关注可能", lo: "实感 · 关注当下" },
  { letters: ["F", "T"], from: "宜人", hi: "情感 · 重视和谐", lo: "思考 · 重视逻辑" },
  { letters: ["J", "P"], from: "尽责", hi: "判断 · 计划有序", lo: "感知 · 灵活随性" },
];

export function StudioView() {
  const router = useRouter();
  const loadPortrait = useHome((s) => s.loadPortrait);
  const filledDims = useHome((s) => s.filledDims);
  const selectedKeywords = useHome((s) => s.selectedKeywords);
  const saveDimension = useHome((s) => s.saveDimension);

  const [bigfive, setBigfive] = useState<AssessmentResult | null>(null);
  const [assessedDims, setAssessedDims] = useState<Record<string, boolean>>({});
  const [activeDim, setActiveDim] = useState<DimensionKey | null>(null);

  useEffect(() => {
    void loadPortrait();
    setBigfive(loadResult("bigfive"));
    // 各维度关联测评是否已完成（本地结果存在）
    const done: Record<string, boolean> = {};
    for (const key of DIMENSION_KEYS) {
      const kind = DIMENSIONS[key].tools.find((t) => t.assessment)?.assessment;
      if (kind && loadResult(kind)) done[key] = true;
    }
    setAssessedDims(done);
  }, [loadPortrait]);

  const bfCfg = assessmentConfig("bigfive");
  const bfDims: DimScore[] | null = bigfive ? hydrateDims("bigfive", bigfive.dims) : null;

  return (
    <div className="screen-bg">
      {/* 页头不再是第二条 sticky 栏 —— 全站已有顶栏，再钉一条只会和它抢层级 */}
      <PageShell
        header={
          <div className="flex items-center gap-[13px]">
            <BackButton onClick={() => router.back()} />
            <div className="min-w-0 flex-1">
              <div className="text-[16px] font-semibold tracking-[0.8px] text-ink xl:text-[19px]">画像工坊</div>
              <div className="text-[11px] text-faint">用测评与关键词，持续雕刻更立体的自己</div>
            </div>
          </div>
        }
      >
        <div className="flex w-full flex-col gap-6">
        {/* ============ 大五人格主卡 ============ */}
        <section className="flex flex-col gap-3">
          <SectionHeader title="人格底色 · 大五人格" trailing={bigfive ? "重新测评 ›" : undefined} isLink onTrailing={() => router.push("/assessment/bigfive")} />
          {bfDims ? (
            <div className="kaleido-card flex flex-col gap-3.5 p-5">
              <div className="flex items-end justify-between">
                <div>
                  <div className="text-[11px] text-faint">你的五维连续分数</div>
                  <div className="mt-1 text-[15px] font-semibold text-ink">五个维度都是光谱，没有好坏</div>
                </div>
                {bigfive?.mbti && (
                  <div className="flex flex-col items-end">
                    <span className="text-[10px] text-faint">MBTI 倾向</span>
                    <span className="text-aurora text-[22px] font-extrabold tracking-[3px]">
                      {bigfive.mbti}
                    </span>
                  </div>
                )}
              </div>
              <div className="flex flex-col gap-2.5">
                {bfDims.map((d) => {
                  const pct = Math.round(d.percent * 100);
                  return (
                    <div key={d.key} className="flex items-center gap-3">
                      <span className="w-[70px] shrink-0 text-[12px] text-sub">{d.name}</span>
                      <div className="h-[6px] flex-1 overflow-hidden rounded-chip bg-raised">
                        <div
                          className="h-full rounded-chip transition-all duration-500"
                          style={{ width: `${pct}%`, background: d.color }}
                        />
                      </div>
                      <span
                        className="w-8 shrink-0 text-right text-[12px] font-bold tabular-nums"
                        style={{ color: d.color }}
                      >
                        {pct}
                      </span>
                    </div>
                  );
                })}
              </div>
              <button
                onClick={() => router.push("/assessment/bigfive")}
                className="self-start text-[12px] text-brand"
              >
                查看完整结果与 30 个面向 ›
              </button>
            </div>
          ) : (
            <button
              onClick={() => router.push("/assessment/bigfive")}
              className="flex flex-col items-start gap-2 rounded-card border border-dashed border-[#8F7BFF]/45 bg-[#8F7BFF]/6 p-5 text-left transition active:scale-[0.98]"
            >
              <span className="text-[9.5px] font-semibold tracking-[2px] text-brand">
                {bfCfg.kicker}
              </span>
              <span className="text-[16px] font-bold text-ink">还没有测过大五人格</span>
              <span className="text-[12px] leading-[1.7] text-sub">
                {bfCfg.notices[0]}。完成后可看到五个主维度、三十个细分面向，并推导 MBTI 倾向。
              </span>
              <span className="mt-1 rounded-chip bg-btn-g px-4 py-2 text-[12.5px] font-semibold text-white">
                开始大五人格测评
              </span>
            </button>
          )}
        </section>

        {/* ============ MBTI 展示 ============ */}
        {bfDims && bigfive?.mbti && (
          <section className="flex flex-col gap-3">
            <SectionHeader title="MBTI 类型倾向" trailing="由大五推导" />
            <div className="kaleido-card flex flex-col gap-3 p-5">
              <div className="text-center">
                <div className="text-aurora text-[38px] font-extrabold tracking-[8px]">
                  {bigfive.mbti}
                </div>
              </div>
              <div className="flex flex-col gap-2.5">
                {MBTI_AXES.map((axis, i) => {
                  const letter = bigfive.mbti![i];
                  const isHi = letter === axis.letters[0];
                  return (
                    <div
                      key={i}
                      className="flex items-center justify-between rounded-[12px] border border-line bg-raised px-3.5 py-2.5"
                    >
                      <span className="text-[12.5px] text-sub">
                        {isHi ? axis.hi : axis.lo}
                      </span>
                      <span className="text-aurora text-[16px] font-bold">{letter}</span>
                    </div>
                  );
                })}
              </div>
              <p className="text-[10.5px] leading-[1.7] text-faint">
                该类型由五维连续分数推导，仅供自我探索参考，不等同于正式 MBTI 测验结果。
              </p>
            </div>
          </section>
        )}

        {/* ============ 生活画像五维 ============ */}
        <section className="flex flex-col gap-3">
          <SectionHeader title="生活画像 · 五个维度" trailing="点开填写关键词或做测评" />
          <div className="flex flex-col gap-2.5 md:grid md:grid-cols-2 md:gap-2.5">
            {DIMENSION_KEYS.map((key) => {
              const cfg = DIMENSIONS[key];
              const value = filledDims[key];
              const done = !!value;
              const assessed = assessedDims[key];
              return (
                <button
                  key={key}
                  onClick={() => setActiveDim(key)}
                  className="flex items-start gap-3 rounded-[16px] border px-4 py-3.5 text-left transition active:scale-[0.98]"
                  style={{
                    background: done ? "var(--color-raised)" : "rgba(94,150,255,0.06)",
                    borderColor: done ? "var(--color-line)" : "rgba(94,150,255,0.4)",
                    borderStyle: done ? "solid" : "dashed",
                  }}
                >
                  <span
                    className="mt-0.5 flex h-[34px] w-[34px] shrink-0 items-center justify-center rounded-[12px] text-[15px]"
                    style={{ background: `${cfg.tint}26`, color: cfg.tint }}
                  >
                    {cfg.icon}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-[13.5px] font-semibold text-ink">{cfg.title}</span>
                      {assessed && (
                        <span className="rounded-chip bg-lime/20 px-1.5 py-0.5 text-[9px] text-lime">
                          已测评
                        </span>
                      )}
                    </div>
                    <div className={`mt-0.5 text-[11.5px] leading-[1.6] ${done ? "text-sub" : "text-brand"}`}>
                      {value ?? "尚未填写 · 点开探索"}
                    </div>
                  </div>
                  <span className="text-[14px] text-faint">›</span>
                </button>
              );
            })}
          </div>
        </section>
        </div>
      </PageShell>

      <DimensionSheet
        dimKey={activeDim}
        initialSelected={activeDim ? selectedKeywords(activeDim) : []}
        onClose={() => setActiveDim(null)}
        onSave={(keywords) => {
          if (activeDim) saveDimension(activeDim, keywords);
        }}
      />
    </div>
  );
}
