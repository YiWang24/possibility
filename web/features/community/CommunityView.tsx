"use client";
/* 万花筒社区主视图 —— 移植 iOS CommunityView。
   双 tab：①为你推荐（放映 / 卡片两种浏览方式 + 搜索，点击 → /traveler/[id]）
          ②悬赏贴（列表，来自 loadBounties，点击 → /bounty/[id]）。
   右下角 FAB：推荐 tab 打开万花筒抽取浮层；悬赏 tab 登录门控后弹发布表单。 */

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { HueBandHeader } from "@/components/ui/Avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useAuthGate } from "@/components/auth/AuthGate";
import { useData } from "@/stores/data";
import { bountyDisplayAmount, bountyRewardGoal, type Bounty, type Traveler } from "@/lib/models";
import { mockAvatarById } from "@/lib/theme";
import { KaleidoscopeDraw } from "./KaleidoscopeDraw";
import { BountyCompose } from "./BountyCompose";
import { WatchMode } from "./WatchMode";

type Tab = 0 | 1;

/* 浏览方式沿用 iOS 的 @AppStorage("possibility-watch")：同一把钥匙、同一个默认值
   （放映），两端换过来看到的是自己上次选的那个模式。 */
const WATCH_STORAGE_KEY = "possibility-watch";

export function CommunityView() {
  const router = useRouter();
  const { require } = useAuthGate();

  const travelers = useData((s) => s.travelers);
  const bounties = useData((s) => s.bounties);
  const loadTravelers = useData((s) => s.loadTravelers);
  const loadBounties = useData((s) => s.loadBounties);

  const [tab, setTab] = useState<Tab>(0);
  const [search, setSearch] = useState("");
  const [showDraw, setShowDraw] = useState(false);
  const [showCompose, setShowCompose] = useState(false);
  /* 首帧固定用默认值渲染，读 localStorage 放到 effect 里 ——
     服务端拿不到它，直接读会造成 hydration 不一致。 */
  const [watchMode, setWatchMode] = useState(true);

  useEffect(() => {
    void loadTravelers();
    void loadBounties(50, 0);
  }, [loadTravelers, loadBounties]);

  useEffect(() => {
    setWatchMode(window.localStorage.getItem(WATCH_STORAGE_KEY) !== "0");
  }, []);

  const toggleWatchMode = () => {
    const next = !watchMode;
    setWatchMode(next);
    window.localStorage.setItem(WATCH_STORAGE_KEY, next ? "1" : "0");
  };

  const filteredTravelers = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return travelers;
    return travelers.filter((t) =>
      [t.name, t.quote, t.bio, ...t.tags].join(" ").toLowerCase().includes(q),
    );
  }, [travelers, search]);
  const travelerColumns = useMemo(() => splitAlternating(filteredTravelers), [filteredTravelers]);
  const bountyColumns = useMemo(() => splitAlternating(bounties), [bounties]);

  const primaryAction = () => {
    if (tab === 0) setShowDraw(true);
    else require(() => setShowCompose(true));
  };
  const actionLabel = tab === 0 ? "万花筒抽一位旅人" : "发布悬赏";
  const actionIcon = tab === 0 ? <MiniOrb /> : <PlusIcon />;

  return (
    <>
      {/* 页眉 */}
      <div className="flex items-end justify-between gap-6">
        <div className="flex flex-col gap-1.5">
          <span className="text-eyebrow text-faint">KALEIDOSCOPE</span>
          <h1 className="text-display font-bold text-ink">万花筒社区</h1>
        </div>
        <p className="max-w-[190px] whitespace-pre-line text-right font-serif text-micro leading-[1.7] tracking-[0.35px] text-sub xl:max-w-[240px] xl:text-footnote">
          {tab === 0
            ? "人生如逆旅，我亦是行人。"
            : "未来不是被我们预见的，\n而是被我们亲手促成的。"}
        </p>
      </div>

      {/* 双 tab —— 桌面把主动作从浮动 FAB 提到同一行，页面顶部即可触达 */}
      <div className="mt-4 flex items-center justify-between gap-6 lg:mt-8">
        <div className="flex items-baseline gap-6">
          <TabButton label="为你推荐" on={tab === 0} onClick={() => setTab(0)} />
          <TabButton label="悬赏贴" on={tab === 1} onClick={() => setTab(1)} />
        </div>
        <div className="flex items-center gap-3">
          {tab === 0 && <WatchToggle watch={watchMode} onToggle={toggleWatchMode} />}
          <Button onClick={primaryAction} className="hidden tracking-[0.5px] md:flex">
            {actionIcon}
            {actionLabel}
          </Button>
        </div>
      </div>

      <div className="mt-4 lg:mt-7">
        {tab === 0 ? (
          <div className="flex flex-col gap-3 lg:gap-5">
            <SearchBar value={search} onChange={setSearch} />
            {/* 放映模式自带命中/落空反馈（气泡淡出 + 舞台内空态），
                所以搜索词交给它原样处理，不走 filteredTravelers */}
            {watchMode ? (
              <WatchMode travelers={travelers} query={search} />
            ) : filteredTravelers.length === 0 ? (
              <EmptyState text="没有匹配的旅人，换个关键词试试。" />
            ) : (
              <>
                <div className="grid grid-cols-2 items-start gap-3 lg:hidden">
                  {travelerColumns.map((column, index) => (
                    <div key={index} className="flex min-w-0 flex-col gap-3">
                      {column.map((traveler) => (
                        <TravelerCard
                          key={traveler.id}
                          traveler={traveler}
                          href={`/traveler/${traveler.id}`}
                        />
                      ))}
                    </div>
                  ))}
                </div>
                <div className="hidden grid-cols-3 gap-5 lg:grid 2xl:grid-cols-4">
                  {filteredTravelers.map((traveler) => (
                    <TravelerCard
                      key={traveler.id}
                      traveler={traveler}
                      href={`/traveler/${traveler.id}`}
                    />
                  ))}
                </div>
              </>
            )}
          </div>
        ) : (
          <>
            <div className="grid grid-cols-2 items-start gap-3 lg:hidden">
              {bountyColumns.map((column, index) => (
                <div key={index} className="flex min-w-0 flex-col gap-3">
                  {column.map((bounty) => (
                    <BountyCard
                      key={bounty.id}
                      bounty={bounty}
                      onClick={() => router.push(`/bounty/${bounty.id}`)}
                    />
                  ))}
                </div>
              ))}
            </div>
            <div className="hidden gap-5 lg:grid lg:grid-cols-2 xl:grid-cols-3">
              {bounties.map((bounty) => (
                <BountyCard
                  key={bounty.id}
                  bounty={bounty}
                  onClick={() => router.push(`/bounty/${bounty.id}`)}
                />
              ))}
            </div>
          </>
        )}
      </div>

      {/* FAB：仅移动端；桌面已提到页眉，浮动按钮在大屏上是移动端习惯 */}
      <Button
        onClick={primaryAction}
        className="fixed bottom-[100px] right-5 z-40 tracking-[0.5px] md:hidden"
      >
        {actionIcon}
        {actionLabel}
      </Button>

      <AnimatePresence>
        {showDraw && <KaleidoscopeDraw onClose={() => setShowDraw(false)} />}
      </AnimatePresence>
      <AnimatePresence>
        {showCompose && (
          <BountyCompose
            onClose={() => setShowCompose(false)}
            onPublished={() => void loadBounties(50, 0)}
          />
        )}
      </AnimatePresence>
    </>
  );
}

function splitAlternating<T>(items: T[]): [T[], T[]] {
  const columns: [T[], T[]] = [[], []];
  items.forEach((item, index) => columns[index % 2].push(item));
  return columns;
}

function TabButton({ label, on, onClick }: { label: string; on: boolean; onClick: () => void }) {
  return (
    <button onClick={onClick} className="flex flex-col items-center gap-1.5">
      <span
        className={`transition ${on ? "text-title font-bold text-ink" : "text-lead text-faint"}`}
      >
        {label}
      </span>
      <span className={`h-[3px] w-[18px] rounded-chip bg-aurora ${on ? "opacity-100" : "opacity-0"}`} />
    </button>
  );
}

/* 卡片 / 放映 切换（iOS watchToggle）。文案给的是「点下去会变成什么」，
   高亮给的是「现在在放映模式」—— 两者含义不同，靠 aria-label 说清楚。 */
function WatchToggle({ watch, onToggle }: { watch: boolean; onToggle: () => void }) {
  const label = watch ? "切换到卡片视图" : "切换到放映视图";
  return (
    <button
      type="button"
      onClick={onToggle}
      title={label}
      aria-label={label}
      aria-pressed={watch}
      className={`flex shrink-0 items-center gap-1.5 rounded-chip border px-3 py-1.5 text-caption font-medium transition active:scale-95 ${
        watch
          ? "border-brand/45 bg-brand/15 text-brand-lite"
          : "border-line bg-raised text-sub hover:text-ink"
      }`}
    >
      {watch ? <GridIcon /> : <ClusterIcon />}
      {watch ? "卡片" : "放映"}
    </button>
  );
}

function GridIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden>
      <rect x="0.75" y="0.75" width="4" height="4" rx="1.2" stroke="currentColor" strokeWidth="1.1" />
      <rect x="7.25" y="0.75" width="4" height="4" rx="1.2" stroke="currentColor" strokeWidth="1.1" />
      <rect x="0.75" y="7.25" width="4" height="4" rx="1.2" stroke="currentColor" strokeWidth="1.1" />
      <rect x="7.25" y="7.25" width="4" height="4" rx="1.2" stroke="currentColor" strokeWidth="1.1" />
    </svg>
  );
}

function ClusterIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden>
      <circle cx="6" cy="6" r="2.4" stroke="currentColor" strokeWidth="1.1" />
      <circle cx="1.9" cy="2.6" r="1.4" stroke="currentColor" strokeWidth="1.1" />
      <circle cx="10.1" cy="2.6" r="1.4" stroke="currentColor" strokeWidth="1.1" />
      <circle cx="1.9" cy="9.4" r="1.4" stroke="currentColor" strokeWidth="1.1" />
      <circle cx="10.1" cy="9.4" r="1.4" stroke="currentColor" strokeWidth="1.1" />
    </svg>
  );
}

function SearchBar({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    /* 搜索框不跟着看板一路拉到 1536px —— 单行输入拉太宽反而难扫读 */
    <div className="flex w-full items-center gap-2 rounded-chip border border-line bg-white/5 px-[14px] py-2.5 transition focus-within:border-brand/50 md:max-w-[420px]">
      <svg width="13" height="13" viewBox="0 0 15 15" fill="none" className="shrink-0 text-faint" aria-hidden>
        <circle cx="6.5" cy="6.5" r="4.5" stroke="currentColor" strokeWidth="1.5" />
        <path d="M10 10 13 13" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      </svg>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="搜索旅人、介绍或标签"
        className="min-w-0 flex-1 bg-transparent text-body text-ink placeholder:text-faint focus:outline-none"
      />
      {value && (
        <button
          onClick={() => onChange("")}
          aria-label="清空"
          className="shrink-0 text-faint transition active:scale-90"
        >
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden>
            <circle cx="7" cy="7" r="6" fill="currentColor" opacity="0.25" />
            <path d="M4.8 4.8 9.2 9.2M9.2 4.8 4.8 9.2" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
          </svg>
        </button>
      )}
    </div>
  );
}

function TravelerCard({ traveler, href }: { traveler: Traveler; href: string }) {
  return (
    <Link
      href={href}
      className="kaleido-card block transition active:scale-[0.99]"
      style={{ borderRadius: 20 }}
    >
      <HueBandHeader
        initial={traveler.initial}
        hueIndex={traveler.hue}
        imageSrc={mockAvatarById(traveler.id)}
      />
      <div className="flex flex-col gap-1.5 px-3.5 pb-3.5 pt-5">
        <span className="text-body font-semibold text-ink">{traveler.name}</span>
        <p className="text-caption leading-relaxed text-sub">{traveler.quote}</p>
        {traveler.tags.length > 0 && (
          <div className="mt-0.5 flex flex-wrap gap-1.5">
            {traveler.tags.slice(0, 3).map((tag) => (
              <Badge key={tag} size="sm">{tag}</Badge>
            ))}
          </div>
        )}
        <span className="mt-1 text-caption font-medium text-brand">查看详情 ›</span>
      </div>
    </Link>
  );
}

function BountyCard({ bounty, onClick }: { bounty: Bounty; onClick: () => void }) {
  const tags = bounty.tags ?? [];
  const goal = bountyRewardGoal(bounty);
  return (
    <button
      onClick={onClick}
      className="kaleido-card flex flex-col items-start px-[13px] py-3.5 text-left transition active:scale-[0.99]"
      style={{ borderRadius: 18 }}
    >
      {tags.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {tags.slice(0, 3).map((tag) => (
            <Badge key={tag} size="sm">{tag}</Badge>
          ))}
        </div>
      )}
      <p className={`text-body font-semibold leading-[1.5] text-ink ${tags.length ? "mt-[11px]" : ""}`}>
        {bounty.question}
      </p>
      {goal && <p className="mt-2 line-clamp-2 text-micro font-medium text-sub">{goal}</p>}
      <div className="mt-3 h-px w-full bg-line" />
      <div className="mt-2.5 flex w-full items-end justify-between gap-1.5">
        <div className="flex flex-col gap-0.5">
          <span className="text-micro font-medium text-faint">悬赏金</span>
          <span className="text-subtitle font-bold tabular-nums text-apricot">
            {bountyDisplayAmount(bounty)}
          </span>
        </div>
        <span className="max-w-[45%] text-right text-micro text-faint">{bounty.responses}</span>
      </div>
    </button>
  );
}

function EmptyState({ text }: { text: string }) {
  return (
    <div className="rounded-card border border-line bg-raised px-4 py-8 text-center text-footnote text-faint">
      {text}
    </div>
  );
}

/* 迷你光球（FAB 图标，复用 orb conic 动画） */
function MiniOrb() {
  return (
    <span className="relative h-[18px] w-[18px] overflow-hidden rounded-full" aria-hidden>
      <span className="absolute inset-0 animate-[spin_6s_linear_infinite] bg-orb-conic" />
      <span className="absolute inset-0 rounded-full border border-white/30" />
    </span>
  );
}

function PlusIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 15 15" fill="none" aria-hidden>
      <circle cx="7.5" cy="7.5" r="6.5" stroke="currentColor" strokeWidth="1.5" />
      <path d="M7.5 4.5v6M4.5 7.5h6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}
