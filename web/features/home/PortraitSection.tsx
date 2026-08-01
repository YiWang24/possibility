"use client";
/* 动态画像区 —— 分区标题（探索更多画像 → /studio）+ 尼采引文 + 底牌 + 六维行。
   数字形象舞台与完成度已上移到首页 hero（PersonaHero）：一张卡不该同时
   承担「展示形象 / 列底牌 / 报完成度 / 排六维」四件事，桌面上那正是
   「信息层级分散」的来源 —— 用户看不出这块的主角是谁。 */

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { SectionHeader } from "@/components/ui/page-header";
import { hue } from "@/lib/theme";
import { DIMENSIONS, DIMENSION_KEYS, type DimensionKey } from "@/lib/dimensions";
import { useData } from "@/stores/data";
import { useHome } from "./store";
import { DimensionSheet } from "./DimensionSheet";

interface PortraitDim {
  id: string;
  icon: string;
  tint: string;
  label: string;
  value?: string;
  key: DimensionKey | null;
}

export function PortraitSection() {
  const router = useRouter();
  const filledDims = useHome((s) => s.filledDims);
  const cardGames = useData((s) => s.profile?.card_games);
  const selectedKeywords = useHome((s) => s.selectedKeywords);
  const saveDimension = useHome((s) => s.saveDimension);

  const signatureCards = useMemo(
    () => useHome.getState().lifeSignatureCards(),
    [cardGames],
  );

  const [activeDim, setActiveDim] = useState<DimensionKey | null>(null);

  const dims: PortraitDim[] = [
    { id: "personality", icon: "◎", tint: "#5968D9", label: "人格底色", value: filledDims.personality, key: null },
    ...DIMENSION_KEYS.map((k) => {
      const c = DIMENSIONS[k];
      return { id: k, icon: c.icon, tint: c.tint, label: c.title, value: filledDims[k], key: k };
    }),
  ];

  const handleTap = (dim: PortraitDim) => {
    if (dim.key) {
      setActiveDim(dim.key);
    } else {
      // 人格底色 → 大五人格测评
      router.push("/assessment/bigfive");
    }
  };

  return (
    <section className="flex flex-col gap-3">
      <SectionHeader
        title="我的动态画像"
        trailing="探索更多画像 ›"
        isLink
        onTrailing={() => router.push("/studio")}
      />

      {/* 尼采引文 */}
      <div className="relative border-l border-sub/30 pl-3.5 pt-1 xl:max-w-[68ch]">
        <p className="font-serif text-footnote leading-[1.9] text-sub xl:text-body">
          我们无可避免跟自己保持陌生，我们不明白自己，我们搞不清楚自己，我们的永恒判词是：“离每个人最远的，就是他自己。”——对于我们自己，我们不是“知者”……
        </p>
        <p className="mt-1 text-right text-caption text-faint">——尼采《道德的系谱》</p>
      </div>

      {/* 画像卡 */}
      <div className="kaleido-card px-5 py-5 xl:px-8 xl:py-7">
        {/* 人生底牌签名 */}
        {signatureCards.length > 0 && (
          <div className="rounded-tile border border-line bg-raised p-3.5">
            <div className="flex items-center justify-between">
              <span className="text-body font-semibold text-ink">我的人生底牌</span>
              <span className="text-micro text-faint">已参与数字形象生成</span>
            </div>
            <div className="mt-2.5 flex gap-2">
              {signatureCards.map((card) => (
                <div
                  key={card.name}
                  className="flex flex-1 items-center justify-center gap-1.5 rounded-field border border-[#AEAEFF]/25 py-3 text-white"
                  style={{ background: hue(0).gradient, opacity: 0.9 }}
                >
                  <span className="text-body">{card.glyph}</span>
                  <span className="truncate text-footnote font-medium">{card.name}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 六维行 —— 桌面 3 列正好两行满栅格，不留豁口 */}
        <div className="flex flex-col gap-2.5 md:mt-4 md:grid md:grid-cols-2 md:gap-2.5 xl:grid-cols-3 xl:gap-3">
          {dims.map((dim) => {
            const isTodo = !dim.value;
            return (
              <button
                key={dim.id}
                onClick={() => handleTap(dim)}
                className="flex items-center gap-3 rounded-tile border px-4 py-3.5 text-left transition active:scale-[0.98]"
                style={{
                  background: isTodo ? "rgba(94,150,255,0.06)" : "var(--color-raised)",
                  borderColor: isTodo ? "rgba(94,150,255,0.4)" : "var(--color-line)",
                  borderStyle: isTodo ? "dashed" : "solid",
                }}
              >
                <span
                  className="flex h-[34px] w-[34px] shrink-0 items-center justify-center rounded-field text-lead"
                  style={{ background: `${dim.tint}26`, color: dim.tint }}
                >
                  {dim.icon}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="text-body font-semibold text-ink">{dim.label}</div>
                  <div
                    className={`truncate text-caption ${isTodo ? "text-brand" : "text-sub"}`}
                  >
                    {dim.value ?? "尚未填写"}
                  </div>
                </div>
                <span className="text-callout text-faint">›</span>
              </button>
            );
          })}
        </div>
      </div>

      <DimensionSheet
        dimKey={activeDim}
        initialSelected={activeDim ? selectedKeywords(activeDim) : []}
        onClose={() => setActiveDim(null)}
        onSave={(keywords) => {
          if (activeDim) saveDimension(activeDim, keywords);
        }}
      />
    </section>
  );
}
