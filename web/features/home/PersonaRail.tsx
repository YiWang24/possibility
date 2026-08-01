"use client";
/* 画像伴随轨 —— 桌面专属，iOS 上不存在的布局元素。

   为什么有它：把对话页从 768px 拉宽到 1600px 只会让行宽变烂，桌面的问题从来
   不是「内容不够宽」，而是横向空间里没有值得放的东西。这个产品恰好有一个
   天然该放在那里的东西 —— 动态画像。它被对话 / 日记 / 卡牌 / 测评持续喂养，
   也是社区匹配的依据。iOS 一次只能显示一屏，被迫把画像和对话拆开；
   桌面可以让它常驻，用户于是能边对话边看见自己的画像正在被改写。

   关于依赖方向：这是全站第一个跨 feature 复用的组件（chat / lab / community /
   diary 都会引它）。画像本就是横贯全站的资产而不是首页的私有物，所以放在
   features/home 下由各页 import，而不是把 useHome 反向塞进 components/。 */

import { useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { DIMENSIONS, DIMENSION_KEYS, type DimensionKey } from "@/lib/dimensions";
import { useData } from "@/stores/data";
import { useHome } from "./store";
import { PersonaStage } from "./PersonaStage";

const USER_NAME = "老己";

interface PersonaRailProps {
  /** 本次交互点亮的维度 —— 让用户看见「刚才那段对话改写了我哪一块」 */
  highlight?: DimensionKey[];
  /** 轨底部的页面专属补充（如实验室的「推演依据」） */
  footer?: React.ReactNode;
  /** 轨顶部的一句话，说明画像在当前页面里扮演什么角色 */
  caption?: string;
}

export function PersonaRail({ highlight = [], footer, caption }: PersonaRailProps) {
  const router = useRouter();
  const filledDims = useHome((s) => s.filledDims);
  const remotePersona = useHome((s) => s.remotePersona);
  const loadPortrait = useHome((s) => s.loadPortrait);
  const cardGames = useData((s) => s.profile?.card_games);

  /* 轨会出现在非首页，那些页面不会自己拉画像 —— 这里兜底。store 内部幂等 */
  useEffect(() => {
    void loadPortrait();
  }, [loadPortrait]);

  /* 与首页 hero 同理：这些是 store 的派生方法，getState() 不产生订阅关系，
     依赖的源必须显式订阅，否则轨里的形象与完成度不会跟着更新。 */
  const model = useMemo(
    () => useHome.getState().personaModel(),
    [filledDims, remotePersona, cardGames],
  );
  const completion = useMemo(() => useHome.getState().completion(), [filledDims]);
  const hasLifeCards = useMemo(
    () => useHome.getState().lifeSignatureCards().length >= 3,
    [cardGames],
  );
  const lit = new Set(highlight);

  return (
    <div className="flex flex-col gap-3">
      <div className="kaleido-card">
        <PersonaStage
          model={model}
          userName={USER_NAME}
          summary={remotePersona?.summary}
          hasLifeCards={hasLifeCards}
          size="rail"
        />

        <div className="flex flex-col gap-3 px-4 pb-4 pt-3.5">
          {caption ? <p className="text-[11.5px] leading-[1.7] text-sub">{caption}</p> : null}

          {/* 完成度 */}
          <div className="flex items-center gap-2.5">
            <div className="h-[5px] flex-1 overflow-hidden rounded-chip bg-raised">
              <div
                className="h-full rounded-chip bg-aurora transition-all duration-500"
                style={{ width: `${completion.percent}%` }}
              />
            </div>
            <span className="text-[11px] tabular-nums text-sub">
              {completion.completed}/{completion.total}
            </span>
          </div>

          {/* 六维紧凑列表 —— 轨里放不下首页那种双行卡片，收成单行 */}
          <ul className="flex flex-col gap-1">
            {DIMENSION_KEYS.map((key) => {
              const cfg = DIMENSIONS[key];
              const value = filledDims[key];
              const isLit = lit.has(key);
              return (
                <li key={key}>
                  <button
                    onClick={() => router.push("/studio")}
                    className={`flex w-full items-center gap-2.5 rounded-[12px] px-2.5 py-2 text-left transition ${
                      isLit ? "bg-brand/12 ring-1 ring-brand/35" : "hover:bg-white/[0.035]"
                    }`}
                  >
                    <span
                      className="grid size-[22px] shrink-0 place-items-center rounded-[8px] text-[11px]"
                      style={{ background: `${cfg.tint}26`, color: cfg.tint }}
                    >
                      {cfg.icon}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-[12px] font-medium text-ink">{cfg.title}</span>
                      <span
                        className={`block truncate text-[10.5px] ${
                          value ? "text-faint" : "text-brand"
                        }`}
                      >
                        {value ?? "尚未填写"}
                      </span>
                    </span>
                    {isLit ? (
                      <span className="shrink-0 rounded-chip bg-brand/22 px-1.5 py-0.5 text-[9px] font-semibold tracking-[0.06em] text-[#BBD2FF]">
                        刚点亮
                      </span>
                    ) : null}
                  </button>
                </li>
              );
            })}
          </ul>

          <button
            onClick={() => router.push("/studio")}
            className="mt-0.5 self-start text-[11.5px] font-medium text-brand transition hover:text-[#8FB6FF]"
          >
            补全画像 ›
          </button>
        </div>
      </div>

      {footer}
    </div>
  );
}
