"use client";
/* 旅人主页（全屏页）—— 移植 iOS ProfileView.swift / ProfileModel.swift。
   顶栏（返回 / 姓名 / 真实经历已验证 / 更多）+ Hero（头像·姓名·转型标签条）
   + 四子 tab（她的故事 / 时间线 / 经验与建议 / 可提供服务）+ 底部咨询付费栏。
   数据优先 useData.loadTravelerDetail/loadServices，失败回退 demo 兜底。
   未解锁时深度内容打码，任一付费入口打开 PaywallView 三档权益卡。 */
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence } from "framer-motion";
import { BackButton } from "@/features/card-game/ui";
import { TravelerAvatar } from "@/components/ui/Avatar";
import { OrbView } from "@/components/ui/OrbView";
import { useToast } from "@/components/ui/Toast";
import { mockAvatarById } from "@/lib/theme";
import { useData } from "@/stores/data";
import { DEMO_TRAVELERS, DEMO_TRAVELER_DETAILS, demoServices } from "@/lib/demo-data";
import type { TravelerDetail, TravelerServiceItem } from "@/lib/models";
import { StoryPanel, TimelinePanel, AdvicePanel, ServicePanel } from "./ProfilePanels";
import { PaywallView } from "./PaywallView";

type TabKey = "story" | "timeline" | "advice" | "service";

const TABS: { key: TabKey; label: string }[] = [
  { key: "story", label: "她的故事" },
  { key: "timeline", label: "时间线" },
  { key: "advice", label: "经验与建议" },
  { key: "service", label: "可提供服务" },
];

export function ProfileView({ travelerId }: { travelerId: number }) {
  const router = useRouter();
  const show = useToast((s) => s.show);

  const travelers = useData((s) => s.travelers);
  const unlockedIds = useData((s) => s.unlockedProfileIds);
  const unlocked = unlockedIds.includes(travelerId);

  const [detail, setDetail] = useState<TravelerDetail | null>(null);
  const [services, setServices] = useState<TravelerServiceItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<TabKey>("story");
  const [showPaywall, setShowPaywall] = useState(false);

  const traveler =
    travelers.find((t) => t.id === travelerId) ??
    DEMO_TRAVELERS.find((t) => t.id === travelerId) ??
    null;

  useEffect(() => {
    let alive = true;
    const data = useData.getState();
    if (data.travelers.length === 0) void data.loadTravelers();
    void data.loadUnlocks();
    // 先用 demo 兜底立即渲染（秒开），网络返回后静默刷新
    setDetail(DEMO_TRAVELER_DETAILS[travelerId] ?? null);
    setServices(demoServices(travelerId));
    setLoading(false);
    void (async () => {
      const [d, s] = await Promise.all([
        data.loadTravelerDetail(travelerId),
        data.loadServices(travelerId),
      ]);
      if (!alive) return;
      if (d) setDetail(d);
      if (s.length) setServices(s);
    })();
    return () => {
      alive = false;
    };
  }, [travelerId]);

  const consultPrice = services.find((s) => s.kind === "consult")?.price ?? 29;

  if (!traveler) {
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center gap-4 screen-bg px-6 text-center md:min-h-[calc(100dvh-var(--nav-h))]">
        <p className="text-[14px] text-sub">没有找到这位旅人。</p>
        <button
          onClick={() => router.back()}
          className="rounded-chip border border-line bg-raised px-5 py-2.5 text-[13px] text-ink"
        >
          返回
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-dvh screen-bg md:min-h-[calc(100dvh-var(--nav-h))]">
      {/* 顶栏 */}
      <div className="sticky top-0 z-20 border-b border-line bg-paper/90 backdrop-blur md:top-[var(--nav-h)]">
        <div className="mx-auto flex w-full max-w-measure items-center gap-3 px-5 py-3">
          <BackButton onClick={() => router.back()} />
          <div className="min-w-0 flex-1">
            <div className="truncate text-[16px] font-semibold tracking-[0.5px] text-ink">
              {traveler.name}
            </div>
            <div className="text-[11px] text-faint">真实经历 · 已验证</div>
          </div>
          <button
            aria-label="更多"
            onClick={() => show("更多操作：分享主页 · 举报 · 屏蔽")}
            className="flex h-9 w-9 items-center justify-center rounded-full border border-line bg-raised text-[18px] leading-none text-sub"
          >
            ···
          </button>
        </div>
      </div>

      {loading ? (
        <div className="flex min-h-[60dvh] items-center justify-center">
          <OrbView size={80} />
        </div>
      ) : (
        <>
          {/* Hero */}
          <div className="border-b border-line">
            <div
              className="mx-auto w-full max-w-measure px-[22px] pb-5 pt-[22px]"
              style={{
                background:
                  "radial-gradient(220px circle at 100% 0%, rgba(94,150,255,0.28), transparent), linear-gradient(135deg,#111625 0%,#0B0E17 100%)",
              }}
            >
              <div className="flex items-start gap-4">
                <div className="relative shrink-0">
                  <TravelerAvatar
                    initial={traveler.initial}
                    hueIndex={traveler.hue}
                    size={74}
                    cornerRadius={26}
                    imageSrc={mockAvatarById(traveler.id)}
                  />
                  <span className="absolute -bottom-0.5 -right-0.5 h-[17px] w-[17px] rounded-full border-[3px] border-[#10131D] bg-teal" />
                </div>
                <div className="flex min-w-0 flex-col gap-1.5">
                  <div className="flex flex-wrap items-center gap-2">
                    <h1 className="text-[21px] font-bold tracking-[0.5px] text-ink">{traveler.name}</h1>
                    <span className="rounded-chip border border-[#5E96FF]/26 bg-[#5E96FF]/13 px-[7px] py-[3px] text-[10px] text-[#AFC8FF]">
                      经历已验证
                    </span>
                  </div>
                  {detail && (
                    <span className="text-[12px] text-sub">
                      {[detail.age ? `${detail.age} 岁` : null, detail.city].filter(Boolean).join(" · ")}
                    </span>
                  )}
                </div>
              </div>

              {detail && (detail.from_role || detail.to_role) && (
                <div className="mt-[18px] text-[15px] font-semibold text-ink">
                  {detail.from_role}
                  <span className="text-brand"> → </span>
                  {detail.to_role}
                </div>
              )}
              {detail && (detail.years || detail.result) && (
                <div className="mt-[7px] text-[12px] text-sub">
                  {[detail.years, detail.result].filter(Boolean).join(" · ")}
                </div>
              )}

              {traveler.tags.length > 0 && (
                <div className="mt-4 flex flex-wrap gap-[7px]">
                  {traveler.tags.map((tag) => (
                    <span
                      key={tag}
                      className="rounded-chip border border-[#5E96FF]/20 bg-[#5E96FF]/11 px-2.5 py-1.5 text-[11px] text-[#C6D7FF]"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Tab 栏 */}
          {/* 页内 tab 栏叠在页眉之下：74px navbar + 57px 页眉 = 131px */}
          <div className="sticky top-[57px] z-10 border-b border-line bg-paper/95 backdrop-blur md:top-[131px]">
            <div className="mx-auto flex w-full max-w-measure">
              {TABS.map((t) => {
                const active = tab === t.key;
                return (
                  <button
                    key={t.key}
                    onClick={() => setTab(t.key)}
                    className="relative flex-1 pb-2.5 pt-[15px] text-center"
                  >
                    <span
                      className={`text-[11.5px] ${active ? "font-semibold text-ink" : "text-faint"}`}
                    >
                      {t.label}
                    </span>
                    <span
                      className={`absolute inset-x-5 bottom-0 h-0.5 rounded-full bg-brand transition-opacity ${
                        active ? "opacity-100" : "opacity-0"
                      }`}
                    />
                  </button>
                );
              })}
            </div>
          </div>

          {/* Panel 内容 */}
          <div className="mx-auto w-full max-w-measure px-5 pb-32 pt-5">
            {tab === "story" && (
              <StoryPanel
                traveler={traveler}
                detail={detail}
                unlocked={unlocked}
                onOpenPaywall={() => setShowPaywall(true)}
              />
            )}
            {tab === "timeline" && <TimelinePanel traveler={traveler} />}
            {tab === "advice" && (
              <AdvicePanel
                detail={detail}
                unlocked={unlocked}
                onOpenPaywall={() => setShowPaywall(true)}
              />
            )}
            {tab === "service" && (
              <ServicePanel services={services} onCheckout={() => setShowPaywall(true)} />
            )}
          </div>

          {/* 底部咨询付费栏 */}
          <div className="shell-fixed-x fixed bottom-0 z-20 border-t border-line bg-paper/90 backdrop-blur">
            <div className="mx-auto w-full max-w-measure px-4 py-3">
              <button
                onClick={() => setShowPaywall(true)}
                className="flex w-full items-center justify-center gap-2 rounded-[16px] bg-btn-g py-[15px] text-[13px] font-semibold text-white shadow-[0_8px_14px_rgba(79,125,255,0.55)] transition active:scale-[0.97]"
              >
                向 TA 咨询
                <span className="text-[15px] font-bold">¥{consultPrice}</span>
              </button>
            </div>
          </div>
        </>
      )}

      <AnimatePresence>
        {showPaywall && (
          <PaywallView
            travelerId={travelerId}
            travelerName={traveler.name}
            services={services}
            onClose={() => setShowPaywall(false)}
            onUnlocked={() => void useData.getState().loadUnlocks()}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
