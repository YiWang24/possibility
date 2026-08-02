"use client";
/* 卡牌对局 —— 移植自 iOS CardGameView.swift（原型 #lifeGame / #relationshipGame / #valueGame 通用界面）
 * intro → 选 9 张 → 抽情境（扇形背面牌，翻牌）→ 决策 → 交换 → 结果。 */

import {
  useCallback,
  useEffect,
  useReducer,
  useState,
  type ReactNode,
} from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import type { CardGameKind, GameCard } from "./data";
import type { CardGameAiNarrativeResponse } from "@possibility/shared-types";
import { loadCardGameConfig } from "./catalog";
import {
  CardGameSessionCoordinator,
  lastCompletedCardGameSession,
  pinnedCardGameCatalogVersion,
} from "./session";
import {
  CardGameEngine,
  userScopedCardGameStorage,
} from "./engine";
import { FanArc } from "./FanArc";
import { LifeResult, RelationResult } from "./ResultViews";
import { ValueCardFace, valueCardPalette } from "./ValueCardFace";
import { Foot, PRESSURE_COLORS, withAlpha } from "./ui";
import { FocusShell } from "@/components/shell/FocusShell";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/Toast";
import { callFunction } from "@/lib/supabase";

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

function pressureColor(engine: CardGameEngine): string {
  const index = Math.max(
    0,
    Math.min(
      PRESSURE_COLORS.length - 1,
      engine.pressure - engine.pressureMin,
    ),
  );
  return PRESSURE_COLORS[index];
}

function PressureDots({ engine }: { engine: CardGameEngine }) {
  const color = pressureColor(engine);
  return (
    <div className="flex items-center gap-1.5" aria-label={`压力 ${engine.pressure}/${engine.pressureMax}`}>
      {Array.from(
        { length: engine.pressureMax - engine.pressureMin + 1 },
        (_, index) => engine.pressureMin + index,
      ).map((level) => (
        <span
          key={level}
          className="h-2.5 w-2.5 rounded-full transition-all duration-300"
          style={{
            background: level <= engine.pressure ? color : "var(--color-raised)",
            boxShadow: level <= engine.pressure
              ? `0 0 12px ${withAlpha(color, 0.45)}`
              : undefined,
          }}
        />
      ))}
      <span className="ml-1 text-micro tabular-nums text-sub">
        {engine.pressure}/{engine.pressureMax}
      </span>
    </div>
  );
}

function GameWorkspace({
  engine,
  children,
  mainClassName = "",
}: {
  engine: CardGameEngine;
  children: ReactNode;
  mainClassName?: string;
}) {
  return (
    <div className="mx-auto grid w-full max-w-[1184px] gap-4 px-0 py-0 lg:grid-cols-[minmax(0,1fr)_286px] lg:px-6 lg:py-4 xl:px-0">
      <section className={`card-game-surface min-w-0 ${mainClassName}`}>
        {children}
      </section>
      <GameStateRail engine={engine} />
    </div>
  );
}

function GameStateRail({ engine }: { engine: CardGameEngine }) {
  const accent = engine.config.accent;
  const activeCards = engine.phase === "select"
    ? engine.selected.map((id) => engine.card(id))
    : engine.heldCards;
  const held = new Set(engine.held);
  const released = engine.phase === "select"
    ? []
    : engine.selected.filter((id) => !held.has(id)).map((id) => engine.card(id));

  return (
    <aside className="hidden flex-col gap-3 lg:flex">
      <div className="card-game-panel p-3.5">
        <div className="flex items-center justify-between">
          <div className="text-footnote font-semibold text-ink">
            {engine.phase === "select" ? "这一局已选择" : "当前持有的底牌"}
          </div>
          <div className="text-micro tabular-nums" style={{ color: accent }}>
            {activeCards.length}/{engine.phase === "select" ? engine.initialSelectCount : engine.held.length}
          </div>
        </div>
        <div className="mt-3 flex flex-col gap-1.5">
          {activeCards.length === 0 && (
            <div className="rounded-field border border-dashed border-white/10 px-3 py-6 text-center text-micro text-faint">
              选择的底牌会出现在这里
            </div>
          )}
          {activeCards.map((card) => {
            const palette = valueCardPalette(card.group, accent);
            return (
              <div
                key={card.id}
                className="flex items-center gap-2.5 rounded-field border px-2.5 py-2"
                style={{
                  borderColor: withAlpha(palette.primary, 0.16),
                  background: `linear-gradient(90deg, ${withAlpha(palette.primary, 0.08)}, rgba(255,255,255,0.018))`,
                }}
              >
                <span
                  className="grid h-7 w-7 shrink-0 place-items-center rounded-[8px] border text-body"
                  style={{
                    color: palette.primary,
                    borderColor: withAlpha(palette.primary, 0.2),
                    background: withAlpha(palette.primary, 0.12),
                    boxShadow: `0 0 14px ${withAlpha(palette.primary, 0.1)}`,
                  }}
                >
                  {card.glyph}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-caption font-medium text-ink">
                    {card.name}
                  </span>
                  <span className="block truncate text-micro text-faint">{card.group}</span>
                </span>
                <span
                  className="rounded-chip border px-2 py-0.5 text-micro"
                  style={{
                    color: withAlpha(palette.primary, 0.82),
                    borderColor: withAlpha(palette.primary, 0.12),
                    background: withAlpha(palette.primary, 0.06),
                  }}
                >
                  持有
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {released.length > 0 && (
        <div className="card-game-panel p-3.5">
          <div className="flex items-center justify-between">
            <div className="text-footnote font-semibold text-ink">已经放下</div>
            <div className="text-micro text-faint">{released.length} 张</div>
          </div>
          <div className="mt-3 flex flex-wrap gap-1.5">
            {released.map((card) => (
              <span
                key={card.id}
                className="rounded-chip border border-white/[0.06] bg-white/[0.025] px-2.5 py-1 text-micro text-faint"
              >
                {card.glyph} {card.name}
              </span>
            ))}
          </div>
        </div>
      )}

      <div className="card-game-panel p-3.5">
        <div className="text-footnote font-semibold text-ink">本局状态</div>
        <div className="mt-3">
          <div className="text-micro text-faint">命运压力</div>
          <div className="mt-1.5"><PressureDots engine={engine} /></div>
        </div>
        <div className="mt-3 grid grid-cols-2 gap-2">
          <div className="rounded-field bg-white/[0.025] p-2.5">
            <div className="text-micro text-faint">已接受</div>
            <div className="mt-1 text-subtitle font-bold text-ink">{engine.accepted.length}</div>
          </div>
          <div className="rounded-field bg-white/[0.025] p-2.5">
            <div className="text-micro text-faint">已交换</div>
            <div className="mt-1 text-subtitle font-bold text-ink">{engine.traded.length}</div>
          </div>
        </div>
      </div>
    </aside>
  );
}

export function GameView({ kind }: { kind: CardGameKind }) {
  const router = useRouter();
  /* 引擎在客户端挂载后创建（构造时会从 localStorage 恢复局内快照，避免 SSR 水合不一致） */
  const [engine, setEngine] = useState<CardGameEngine | null>(null);
  const [, bump] = useReducer((n: number) => n + 1, 0);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [sessionSync, setSessionSync] =
    useState<CardGameSessionCoordinator | null>(null);
  const [lastResultSessionId, setLastResultSessionId] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    void (async () => {
      try {
        const pinnedVersion = await pinnedCardGameCatalogVersion(kind);
        const { config, envelope } = await loadCardGameConfig(
          kind,
          pinnedVersion,
        );
        let candidate: CardGameSessionCoordinator | null = null;
        if (envelope) {
          try {
            candidate = await CardGameSessionCoordinator.create(
              kind,
              envelope.version,
            );
          } catch {
            // The legacy final-result save remains available if session
            // bootstrap is temporarily offline.
          }
        }
        const nextEngine = new CardGameEngine(
          kind,
          config,
          candidate
            ? userScopedCardGameStorage(candidate.userId)
            : undefined,
        );
        let coordinator: CardGameSessionCoordinator | null = null;
        if (candidate) {
          // A legacy in-progress snapshot has no action history to replay on
          // the server. Finish that one through the legacy save path instead
          // of fabricating earlier actions.
          if (
            candidate.resumed ||
            nextEngine.phase === "intro" ||
            nextEngine.phase === "select"
          ) {
            coordinator = candidate;
          } else {
            candidate.clearLocalState();
          }
        }
        if (!active) return;
        if (coordinator) nextEngine.scenarioSeed = coordinator.seed;
        const previousResultSessionId = await lastCompletedCardGameSession(kind);
        if (!active) return;
        setSessionSync(coordinator);
        setLastResultSessionId(previousResultSessionId);
        setEngine(nextEngine);
        setLoadError(null);
      } catch {
        if (active) {
          setLoadError("这套牌库尚未缓存，请联网后重试。");
        }
      }
    })();
    return () => {
      active = false;
    };
  }, [kind]);

  const act = useCallback(
    (fn: () => void) => {
      fn();
      bump();
    },
    [bump],
  );

  if (!engine) {
    return (
      <div className="flex min-h-dvh items-center justify-center screen-bg px-6 md:min-h-[calc(100dvh-74px)]">
        {loadError
          ? (
            <div className="w-full max-w-sm rounded-card border border-line bg-card p-5 text-center">
              <div className="text-lead font-semibold text-ink">牌库加载失败</div>
              <p className="mt-2 text-footnote leading-[1.7] text-sub">
                {loadError}
              </p>
              <Button variant="tonal" size="sm" className="mt-4" type="button" onClick={() => router.back()}>
                返回卡牌大厅
              </Button>
            </div>
          )
          : <div className="text-footnote text-faint">加载最新牌库…</div>}
      </div>
    );
  }
  return (
    <GameBody
      engine={engine}
      sessionSync={sessionSync}
      lastResultSessionId={lastResultSessionId}
      act={act}
      router={router}
      isSaving={isSaving}
      setIsSaving={setIsSaving}
      saveError={saveError}
      setSaveError={setSaveError}
    />
  );
}

function GameBody({
  engine,
  sessionSync,
  lastResultSessionId,
  act,
  router,
  isSaving,
  setIsSaving,
  saveError,
  setSaveError,
}: {
  engine: CardGameEngine;
  sessionSync: CardGameSessionCoordinator | null;
  lastResultSessionId: string | null;
  act: (fn: () => void) => void;
  router: ReturnType<typeof useRouter>;
  isSaving: boolean;
  setIsSaving: (v: boolean) => void;
  saveError: string | null;
  setSaveError: (v: string | null) => void;
}) {
  const cfg = engine.config;
  const accent = engine.config.accent;
  const phase = engine.phase;
  const [aiResult, setAiResult] = useState<CardGameAiNarrativeResponse | null>(null);
  const [resultPersisted, setResultPersisted] = useState(false);
  const [aiRetryNonce, setAiRetryNonce] = useState(0);

  useEffect(() => {
    if (phase !== "result" || (!sessionSync && !lastResultSessionId)) return;
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | null = null;

    const setIfActive = (result: CardGameAiNarrativeResponse) => {
      if (!cancelled) setAiResult(result);
    };
    const poll = async (sessionId: string, remaining = 36): Promise<void> => {
      if (cancelled || remaining <= 0) return;
      try {
        const result = await callFunction<CardGameAiNarrativeResponse>(
          "card-game-result",
          { operation: "get", session_id: sessionId },
        );
        setIfActive(result);
        if (result.status === "generating") {
          timer = setTimeout(() => void poll(sessionId, remaining - 1), 2_500);
        }
      } catch {
        setIfActive({
          ok: true,
          session_id: sessionId,
          status: "failed",
          narrative: null,
          generated_at: null,
          retryable: true,
          source: "rules",
        });
      }
    };

    const prepare = async () => {
      const sessionId = sessionSync
        ? (await sessionSync.complete()).sessionId
        : lastResultSessionId;
      if (!sessionId) return;
      if (cancelled) return;
      setResultPersisted(true);
      const result = await callFunction<CardGameAiNarrativeResponse>(
        "card-game-result",
        { operation: "generate", session_id: sessionId },
      );
      setIfActive(result);
      if (result.status === "generating") await poll(sessionId);
    };
    void prepare().catch(() => {
      setIfActive({
        ok: true,
        session_id: sessionSync?.sessionId ?? lastResultSessionId ?? "",
        status: "failed",
        narrative: null,
        generated_at: null,
        retryable: true,
        source: "rules",
      });
    });

    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [aiRetryNonce, lastResultSessionId, phase, sessionSync]);

  /* 顶栏信息（iOS topInfo）—— 引擎为可变对象，每次渲染直接重算 */
  const topInfo = ((): { title: string; sub: string; progressText: string } => {
    switch (phase) {
      case "intro":
        return { title: cfg.title, sub: "一次关于取舍的模拟", progressText: "准备开始" };
      case "select":
        return {
          title: `选择${cfg.title.slice(0, 2)}底牌`,
          sub: `向下滑动浏览全部 ${cfg.cards.length} 张`,
          progressText:
            `已选 ${engine.selected.length}/${engine.initialSelectCount}`,
        };
      case "trade":
        return {
          title: "交换底牌",
          sub: `选择 ${engine.discardPerTrade} 张牌作为代价`,
          progressText:
            `已选 ${engine.tradePick.length}/${engine.discardPerTrade}`,
        };
      case "result":
        return { title: "这一局的回望", sub: "结果默认仅自己可见", progressText: "完成" };
      default: {
        const stage = engine.stageMeta;
        return {
          title: stage.age,
          sub: `${stage.name} · 持有 ${engine.held.length} 张底牌`,
          progressText: `第 ${engine.round + 1} 轮`,
        };
      }
    }
  })();

  const close = () => router.back();

  const back = () => {
    switch (phase) {
      case "trade":
        act(() => engine.cancelTrade());
        break;
      case "decision":
        act(() => engine.returnToDraw());
        break;
      case "draw":
        engine.saveProgress();
        useToast.getState().show(`${cfg.title}进度已为你保留`);
        close();
        break;
      default:
        close();
    }
  };

  const saveAndClose = async () => {
    if (isSaving) return;
    const tags = engine.saveResultLocally();
    setSaveError(null);
    setIsSaving(true);
    try {
      if (sessionSync) {
        await sessionSync.complete();
      } else {
        await callFunction("save-profile", engine.buildSavePayload());
      }
      engine.clearProgressAfterSync();
      if (cfg.kind === "life") {
        useToast.getState().show(
          `${engine.finalCardCount} 张底牌已融入动态画像并同步`,
        );
      } else {
        useToast
          .getState()
          .show(
            `${cfg.title.slice(0, 2)}中最关心的 ${engine.finalCardCount} 点已写入画像：${
              tags.join(" · ")
            }`,
          );
      }
      close();
    } catch {
      setIsSaving(false);
      setSaveError(
        `请检查网络后重试。你的 ${engine.finalCardCount} 张底牌、取舍记录和画像关键词都已安全留在本机。`,
      );
    }
  };

  /* 任务条中段随阶段变化的一句话。抽成具名变量而不是内联嵌套三元 ——
     嵌套三元要在脑子里回溯分支才读得懂，Sonar 也按可维护性问题计（S3358）。
     这里不重复「第 N 轮」：任务条右侧的 progressLabel 已经是它
     （topInfo.progressText），两处同时出现是 main 原顶栏就带的冗余。 */
  let phaseHint: React.ReactNode;
  if (phase === "intro") {
    phaseHint = <span>从选择底牌开始，看见你在代价出现时保护什么</span>;
  } else if (phase === "select") {
    phaseHint = (
      <span>
        已选择 <b className="font-semibold text-sub">{engine.selected.length}</b> /{" "}
        {engine.initialSelectCount} 张底牌
      </span>
    );
  } else {
    phaseHint = (
      <span>
        当前持有 <b className="font-semibold text-sub">{engine.held.length}</b> 张底牌
      </span>
    );
  }

  return (
    /* 专注模式：一局卡牌有明确的开始与结束，中途顶着全站导航既削弱专注，
       原来那条全宽 border-b + backdrop-blur 的顶栏又会在它下面再画一条。
       全站导航由 AppShell 依 isFocusRoute 收起；这里的顶栏并入 FocusShell，
       原本挂在上面的轮次 / 持牌数上下文原样进 meta 槽，一条都没少。
       fullHeight 保留 main 的固定高度牌桌结构（GameWorkspace 按一屏台面设计）。 */
    <FocusShell
      fullHeight
      stageClassName="card-game-stage"
      title={topInfo.title}
      subtitle={topInfo.sub}
      onExit={back}
      exitLabel="退出这局"
      progress={engine.progress()}
      progressLabel={topInfo.progressText}
      meta={
        <>
          {phase === "intro"
            ? <span>从选择底牌开始，看见你在代价出现时保护什么</span>
            : phase === "select"
              ? <span>已选择 <b className="font-semibold text-sub">{engine.selected.length}</b> / {engine.initialSelectCount} 张底牌</span>
              /* 「第 N 轮」不在这里重复：任务条右侧的 progressLabel 已经是它
               （topInfo.progressText），两处同时出现是 main 原顶栏就带的冗余。 */
            : <span>当前持有 <b className="font-semibold text-sub">{engine.held.length}</b> 张底牌</span>}
          <span>目标 · 留下 <b className="font-semibold text-sub">{engine.finalCardCount}</b> 张底牌</span>
        </>
      }
    >
      <AnimatePresence mode="wait">
        <motion.div
          key={`${phase}:${engine.round}`}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -6 }}
          transition={{ duration: 0.25, ease: "easeOut" }}
          className="flex min-h-0 flex-1 flex-col"
        >
          {phase === "intro" && <IntroPhase engine={engine} act={act} />}
          {phase === "select" && (
            <SelectPhase
              engine={engine}
              act={act}
              sessionSync={sessionSync}
            />
          )}
          {phase === "draw" && (
            <DrawPhase
              engine={engine}
              act={act}
              sessionSync={sessionSync}
            />
          )}
          {phase === "decision" && (
            <DecisionPhase
              engine={engine}
              act={act}
              sessionSync={sessionSync}
            />
          )}
          {phase === "trade" && (
            <TradePhase
              engine={engine}
              act={act}
              sessionSync={sessionSync}
            />
          )}
          {phase === "result" && (
            <div className="flex min-h-0 flex-1 flex-col">
              <div className="no-scrollbar flex-1 overflow-y-auto">
                {cfg.kind === "life"
                  ? (
                    <LifeResult
                      engine={engine}
                      aiResult={aiResult}
                      onRetry={sessionSync || lastResultSessionId
                        ? () => setAiRetryNonce((value) => value + 1)
                        : undefined}
                    />
                  )
                  : (
                    <RelationResult
                      engine={engine}
                      aiResult={aiResult}
                      onRetry={sessionSync || lastResultSessionId
                        ? () => setAiRetryNonce((value) => value + 1)
                        : undefined}
                    />
                  )}
              </div>
              {saveError && (
                <div
                  className="px-[13px] py-[13px]"
                  style={{
                    background: "rgba(255,122,77,0.09)",
                    borderTop: "1px solid rgba(255,122,77,0.3)",
                  }}
                >
                  <div className="mx-auto w-full max-w-measure">
                    <div className="text-footnote font-semibold text-[#FFB096]">
                      ⚠ 已保存在本机，云端同步失败
                    </div>
                    <p className="mt-1.5 text-micro leading-[1.7] text-sub">{saveError}</p>
                    <button
                      type="button"
                      onClick={close}
                      className="mt-2 text-caption font-semibold text-ink underline-offset-2 active:opacity-70"
                    >
                      暂时关闭，稍后从“待同步”继续
                    </button>
                  </div>
                </div>
              )}
              <Foot
                title={
                  isSaving
                    ? "正在保存…"
                    : saveError === null
                      ? resultPersisted
                        ? "完成并返回人生实验室"
                        : cfg.kind === "life"
                        ? "保存到我的私密画像"
                        : `保存最关心的 ${engine.finalCardCount} 点`
                      : "重试云端同步"
                }
                enabled={!isSaving}
                onClick={saveAndClose}
              />
            </div>
          )}
        </motion.div>
      </AnimatePresence>
    </FocusShell>
  );
}

/* ============ intro ============ */

function IntroPhase({ engine, act }: { engine: CardGameEngine; act: (fn: () => void) => void }) {
  const cfg = engine.config;
  const accent = cfg.accent;
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="no-scrollbar flex-1 overflow-y-auto">
        <div className="mx-auto grid w-full max-w-[1100px] items-center gap-8 px-6 py-8 lg:min-h-[600px] lg:grid-cols-[minmax(0,0.92fr)_minmax(440px,1.08fr)] lg:px-8 lg:py-12">
          <div className="order-2 flex flex-col gap-5 lg:order-1">
            <div className="text-micro font-semibold tracking-[3px]" style={{ color: withAlpha(accent, 0.95) }}>
              {cfg.eyebrow} · 一次关于取舍的模拟
            </div>
            <h1 className="whitespace-pre-line text-[28px] font-bold leading-[1.35] text-ink lg:text-[42px] lg:leading-[1.25]">
              {cfg.introTitle}
            </h1>
            <p className="max-w-[52ch] text-footnote leading-[1.9] text-sub lg:text-callout">
              {cfg.introCopy}
            </p>
            <div className="grid gap-2.5 md:grid-cols-3 lg:grid-cols-1">
              {cfg.rules.map(([title, copy], idx) => (
                <div
                  key={`${title}:${copy}`}
                  className="card-game-panel flex items-start gap-3 p-3.5"
                >
                  <span
                    className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[9px] text-micro font-bold"
                    style={{ color: accent, background: withAlpha(accent, 0.13) }}
                  >
                    {pad2(idx + 1)}
                  </span>
                  <div>
                    <div className="text-footnote font-semibold text-ink">{title}</div>
                    <div className="mt-1 text-micro leading-[1.65] text-sub">{copy}</div>
                  </div>
                </div>
              ))}
            </div>
            {cfg.contentWarning && (
              <p className="rounded-field border border-orange/20 bg-orange/[0.055] p-3 text-micro leading-[1.7] text-faint">
                {cfg.contentWarning}
              </p>
            )}
          </div>

          <div className="order-1 flex flex-col items-center lg:order-2">
            <div className="relative h-[250px] w-full max-w-[520px] lg:h-[390px]">
              <div
                className="absolute inset-x-[12%] bottom-[3%] h-[18%] rounded-[50%] blur-xl"
                style={{ background: withAlpha(accent, 0.24) }}
              />
              <div className="absolute inset-x-[18%] bottom-[10%] h-px bg-gradient-to-r from-transparent via-violet-soft/80 to-transparent" />
              {[0, 1, 2, 3, 4].map((i) => {
                const d = i - 2;
                return (
                  <motion.div
                    key={i}
                    initial={{ opacity: 0, y: 54, rotate: 0 }}
                    animate={{
                      opacity: 1,
                      y: Math.abs(d) * 18,
                      rotate: d * 10,
                    }}
                    transition={{ delay: 0.08 * i, type: "spring", stiffness: 210, damping: 19 }}
                    className="card-game-back absolute left-1/2 top-[8%] h-[185px] w-[126px] rounded-tile border lg:h-[286px] lg:w-[192px] lg:rounded-card"
                    style={{
                      marginLeft: `calc(-63px + ${d * 48}px)`,
                      borderColor: d === 0 ? withAlpha(accent, 0.7) : withAlpha(accent, 0.28),
                      zIndex: 10 - Math.abs(d),
                    }}
                  >
                    <div className="absolute inset-[11px] rounded-field border border-white/[0.07] lg:inset-[15px] lg:rounded-tile" />
                    <div
                      className="animate-card-game-pulse absolute left-1/2 top-1/2 h-8 w-8 -translate-x-1/2 -translate-y-1/2 rounded-[8px] border lg:h-12 lg:w-12 lg:rounded-field"
                      style={{ borderColor: withAlpha(accent, 0.7) }}
                    />
                    <span className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 text-lead text-violet-soft/80 lg:text-[21px]">
                      ✦
                    </span>
                  </motion.div>
                );
              })}
            </div>
            <div className="mt-1 text-center text-micro tracking-[0.18em] text-faint">
              看不见情境，只能在翻开后做出选择
            </div>
          </div>
        </div>
      </div>
      <Foot title="开始这一局" enabled onClick={() => act(() => engine.start())} />
    </div>
  );
}

/* ============ 选牌 ============ */

function SelectPhase({
  engine,
  act,
  sessionSync,
}: {
  engine: CardGameEngine;
  act: (fn: () => void) => void;
  sessionSync: CardGameSessionCoordinator | null;
}) {
  const cfg = engine.config;
  const accent = cfg.accent;
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="no-scrollbar flex-1 overflow-y-auto">
        <GameWorkspace engine={engine}>
        <div className="flex w-full flex-col gap-4 px-[22px] py-5 lg:min-h-[620px] lg:px-6 lg:py-6">
          <div className="flex items-start justify-between">
            <div>
              <div className="text-micro font-semibold tracking-[2.2px]" style={{ color: withAlpha(accent, 0.9) }}>
                YOUR FOUNDATION
              </div>
              <h2 className="mt-[5px] text-heading font-bold text-ink lg:text-[24px]">{cfg.selectTitle}</h2>
              <p className="mt-1.5 text-micro text-faint lg:text-caption">
                这些牌会正面展示；真正的命运情境仍藏在无字牌背之后。
              </p>
            </div>
            <div className="flex flex-col items-center">
              <span className="text-micro text-faint">已选</span>
              <span className="text-heading font-extrabold leading-tight" style={{ color: accent }}>
                {engine.selected.length}
                <span className="text-caption font-normal text-faint">
                  /{engine.initialSelectCount}
                </span>
              </span>
            </div>
          </div>
          <div className="h-1 overflow-hidden rounded-chip bg-raised">
            <div
              className="h-full rounded-chip transition-all duration-300"
              style={{
                width:
                  `${(engine.selected.length / engine.initialSelectCount) * 100}%`,
                background: accent,
              }}
            />
          </div>
          <div className="text-micro text-faint">没有标准答案，此刻的选择只代表这一局</div>

          <div className="mt-1 grid grid-cols-2 gap-2.5 md:grid-cols-3 lg:gap-3">
            {cfg.cards.map((card, idx) => (
              <SelectCard key={card.id} engine={engine} act={act} card={card} index={idx} />
            ))}
          </div>
          <div className="pt-1.5 text-center text-micro text-faint">
            已展示全部 {cfg.cards.length} 张底牌
          </div>
        </div>
        </GameWorkspace>
      </div>
      <Foot
        title={
          engine.selected.length === engine.initialSelectCount
            ? `带着这 ${engine.initialSelectCount} 张牌出发`
            : `还需选择 ${
              engine.initialSelectCount - engine.selected.length
            } 张`
        }
        enabled={engine.selected.length === engine.initialSelectCount}
        onClick={() => {
          const selected = [...engine.selected];
          act(() => engine.confirmSelection());
          sessionSync?.record({
            action_type: "confirm_selection",
            card_keys: selected,
          });
        }}
      />
    </div>
  );
}

function SelectCard({
  engine,
  act,
  card,
  index,
}: {
  engine: CardGameEngine;
  act: (fn: () => void) => void;
  card: GameCard;
  index: number;
}) {
  const cfg = engine.config;
  const accent = cfg.accent;
  const on = engine.selected.includes(card.id);
  return (
    <motion.button
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: Math.min(index * 0.035, 0.5), duration: 0.3 }}
      onClick={() =>
        act(() => {
          const message = engine.toggleSelect(card.id);
          if (message) useToast.getState().show(message);
        })
      }
      className="block h-full w-full rounded-tile text-left transition active:scale-[0.97]"
    >
      <ValueCardFace
        card={card}
        accent={accent}
        index={index}
        selected={on}
      />
    </motion.button>
  );
}

/* ============ 抽牌 ============ */

function DrawPhase({
  engine,
  act,
  sessionSync,
}: {
  engine: CardGameEngine;
  act: (fn: () => void) => void;
  sessionSync: CardGameSessionCoordinator | null;
}) {
  const cfg = engine.config;
  const accent = cfg.accent;
  const options = engine.scenarioOptions;
  const severity = engine.severityMeta;
  const currentPressureColor = pressureColor(engine);
  const stage = engine.stageMeta;
  return (
    <div className="no-scrollbar flex-1 overflow-y-auto">
      <GameWorkspace engine={engine}>
      <div className="flex min-h-[620px] w-full flex-col px-5 py-5 lg:px-7 lg:py-6">
        <div className="grid gap-4 border-b border-white/[0.065] pb-5 md:grid-cols-[minmax(0,1fr)_240px] md:items-start">
          <div>
            <div className="text-micro font-semibold tracking-[2px]" style={{ color: withAlpha(accent, 0.9) }}>
              STAGE {pad2(engine.round + 1)} · {stage.age}
            </div>
            <h2 className="mt-2 text-[22px] font-bold text-ink lg:text-[27px]">{stage.name}</h2>
            <p className="mt-2 text-caption leading-[1.7] text-sub lg:text-footnote">
              {engine.acceptStreak > 0
                ? `你已连续接受 ${engine.acceptStreak} 次，命运压力正在加码。牌背不会透露任何情境。`
                : `命运放下了 ${engine.scenarioChoiceCount} 张无字牌。凭直觉抽一张，翻开后再做选择。`}
            </p>
          </div>

          <div
            className="rounded-field border p-3.5"
            style={{
              borderColor: withAlpha(currentPressureColor, 0.25),
              background: withAlpha(currentPressureColor, 0.055),
            }}
          >
            <div className="flex items-center justify-between">
              <span className="text-micro text-faint">{cfg.pressureLabel}</span>
              <span className="text-micro font-semibold" style={{ color: currentPressureColor }}>
                {severity.name}
              </span>
            </div>
            <div className="mt-2"><PressureDots engine={engine} /></div>
            <p className="mt-2 text-micro leading-[1.55] text-sub">{severity.copy}</p>
          </div>
        </div>

        {/* 可滑动扇形牌弧 */}
        <div className="flex flex-1 flex-col justify-center py-2">
          <div className="text-center text-caption text-sub">点击或选择一张要面对的底牌</div>
          <FanArc
            options={options}
            accent={accent}
            onDraw={(scenario) => {
              act(() => engine.draw(scenario));
              sessionSync?.record({
                action_type: "draw_scenario",
                scenario_key: scenario.key,
              });
            }}
          />

          <div className="text-center text-micro text-faint">左右滑动牌弧 · 牌面在选择前保持隐藏</div>
        </div>
      </div>
      </GameWorkspace>
    </div>
  );
}

/* ============ 决策 ============ */

function DecisionPhase({
  engine,
  act,
  sessionSync,
}: {
  engine: CardGameEngine;
  act: (fn: () => void) => void;
  sessionSync: CardGameSessionCoordinator | null;
}) {
  const cfg = engine.config;
  const accent = cfg.accent;
  const scenario = engine.current!;
  const severity = engine.severityMeta;
  const currentPressureColor = pressureColor(engine);
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="no-scrollbar flex-1 overflow-y-auto">
        <GameWorkspace engine={engine}>
        <div className="flex min-h-[620px] w-full flex-col gap-4 px-5 py-5 lg:px-7 lg:py-6">
          <span className="w-fit rounded-chip border border-white/[0.06] bg-white/[0.035] px-3 py-[5px] text-micro font-semibold text-sub">
            第 {engine.round + 1} 轮 ·{" "}
            {cfg.kind === "life" ? engine.stageMeta.name : scenario.theme}
          </span>

          {/* 情境卡（翻牌进入） */}
          <motion.div
            initial={{ rotateY: 90, opacity: 0, scale: 0.92 }}
            animate={{ rotateY: 0, opacity: 1, scale: 1 }}
            transition={{ type: "spring", stiffness: 220, damping: 20 }}
            style={{ transformPerspective: 1000 }}
            className="grid w-full overflow-hidden rounded-tile border border-white/[0.11] bg-[#101429] md:grid-cols-[180px_minmax(0,1fr)]"
          >
            <div
              className="relative flex min-h-[140px] items-center justify-center overflow-hidden border-b border-white/[0.08] md:min-h-[230px] md:border-b-0 md:border-r"
              style={{
                background: `radial-gradient(circle at 50% 45%, ${withAlpha(accent, 0.38)}, transparent 38%), linear-gradient(145deg, ${withAlpha(accent, 0.35)}, #101329 72%)`,
              }}
            >
              <span className="absolute inset-3 rounded-field border border-white/[0.08]" />
              <span className="text-[38px] text-white/65 md:text-[50px]">{cfg.glyph}</span>
              <span className="absolute bottom-4 text-[8px] font-semibold tracking-[2px] text-white/45">
                SETBACK {pad2(engine.round + 1)}
              </span>
            </div>
            <div className="flex flex-col justify-center p-5 md:p-7">
              <div className="text-micro font-semibold tracking-[2px]" style={{ color: withAlpha(accent, 0.92) }}>
                {scenario.theme} · 已翻开的情境
              </div>
              <div className="mt-3 text-[22px] font-bold leading-[1.35] text-white md:text-[28px]">
                {scenario.title}
              </div>
              <p className="mt-3 max-w-[52ch] text-footnote leading-[1.85] text-white/70 md:text-body">
                {scenario.copy}
              </p>
            </div>
          </motion.div>

          <div
            className="grid gap-3 rounded-tile border p-4 md:grid-cols-[200px_minmax(0,1fr)] md:items-center"
            style={{
              borderColor: withAlpha(currentPressureColor, 0.24),
              background: withAlpha(currentPressureColor, 0.1),
            }}
          >
            <div>
              <div className="text-micro text-faint">命运压力 · {severity.name}</div>
              <div className="mt-2"><PressureDots engine={engine} /></div>
            </div>
            <p className="text-caption leading-[1.75] text-sub md:text-caption">
              {engine.isForcedTrade
                ? `压力已经到达上限。这一轮不能继续接受，必须放下 ${engine.discardPerTrade} 张底牌才能继续。`
                : `接受会保留全部底牌并继续加压；不接受则放下 ${engine.discardPerTrade} 张。游戏会在手中自然只剩 ${engine.finalCardCount} 张时结束。`}
            </p>
          </div>

          {/* 持有条 */}
          <div className="flex flex-wrap gap-1.5 lg:hidden">
            {engine.heldCards.map((card) => (
              <span
                key={card.id}
                className="rounded-chip bg-raised px-[9px] py-1 text-micro text-sub"
              >
                {card.name}
              </span>
            ))}
          </div>
        </div>
        </GameWorkspace>
      </div>
      <div className="border-t border-white/[0.07] bg-[#090b17]/82 px-5 py-3 backdrop-blur-xl">
        <div className="mx-auto flex w-full max-w-[800px] gap-3">
          {engine.canAccept && (
            <Button
              size="lg"
              className="flex-1"
              type="button"
              onClick={() => {
                const scenarioKey = engine.current?.key;
                act(() => engine.accept());
                sessionSync?.record({
                  action_type: "accept_scenario",
                  scenario_key: scenarioKey,
                });
              }}
            >
              接受它
            </Button>
          )}
          <button
            type="button"
            disabled={!engine.canTrade}
            onClick={() => act(() => engine.beginTrade())}
            className="flex-1 rounded-chip py-[14px] text-body font-semibold transition active:scale-[0.97]"
            style={{
              color: engine.canTrade ? "#FF9A8A" : "var(--color-faint)",
              background: `rgba(255,106,92,${engine.canTrade ? 0.12 : 0.05})`,
              border: `1px solid rgba(255,106,92,${engine.canTrade ? 0.45 : 0.15})`,
            }}
          >
            {engine.canTrade
              ? engine.isForcedTrade
                ? `必须交换 ${engine.discardPerTrade} 张`
                : "我不接受"
              : "只剩最终底牌"}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ============ 交换 ============ */

function TradePhase({
  engine,
  act,
  sessionSync,
}: {
  engine: CardGameEngine;
  act: (fn: () => void) => void;
  sessionSync: CardGameSessionCoordinator | null;
}) {
  const cfg = engine.config;
  const accent = cfg.accent;
  const forcedTrade = engine.isForcedTrade;
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="no-scrollbar flex-1 overflow-y-auto">
        <GameWorkspace engine={engine}>
        <div className="flex min-h-[620px] w-full flex-col gap-4 px-[22px] py-5 lg:px-7 lg:py-6">
          <div className="flex items-start justify-between gap-4 border-b border-white/[0.065] pb-4">
            <div>
            <div className="text-micro font-semibold tracking-[2.2px]" style={{ color: withAlpha(accent, 0.9) }}>
              THE PRICE
            </div>
            <h2 className="mt-[5px] text-heading font-bold text-ink lg:text-[25px]">
              {forcedTrade ? "压力已到极限，必须做出取舍" : "你愿意用什么交换？"}
            </h2>
            </div>
            <div className="hidden rounded-field border border-white/[0.06] bg-white/[0.025] px-3 py-2 text-right md:block">
              <div className="text-micro text-faint">本轮需要放下</div>
              <div className="mt-0.5 text-title font-bold text-ink">
                {engine.tradePick.length}<span className="text-micro font-normal text-faint">/{engine.discardPerTrade}</span>
              </div>
            </div>
          </div>
          <p
            className="rounded-field p-3.5 text-caption leading-[1.8] text-sub"
            style={{
              background: withAlpha(accent, 0.07),
              border: `1px solid ${withAlpha(accent, 0.25)}`,
            }}
          >
            {forcedTrade
              ? <>你已经承担到上限。请从仍持有的 {engine.held.length} 张底牌中放下
                {" "}{engine.discardPerTrade} 张，释放压力后继续。最后
                {engine.finalCardCount} 张会被保留。</>
              : <>为了让“{engine.current?.title ?? ""}”不发生，请从仍持有的
                {" "}{engine.held.length} 张底牌中放下 {engine.discardPerTrade} 张。最后
                {engine.finalCardCount} 张会被保留。</>}
          </p>

          <div className="grid grid-cols-2 gap-2.5 md:grid-cols-3 lg:gap-3">
            {engine.heldCards.map((card) => {
              const picked = engine.tradePick.includes(card.id);
              const palette = valueCardPalette(card.group, accent);
              return (
                <button
                  type="button"
                  key={card.id}
                  onClick={() =>
                    act(() => {
                      const message = engine.toggleTrade(card.id);
                      if (message) useToast.getState().show(message);
                    })
                  }
                  className="relative flex min-h-[82px] items-center gap-2.5 overflow-hidden rounded-field border px-3 py-3 text-left transition hover:-translate-y-0.5 active:scale-[0.96]"
                  style={{
                    background: `radial-gradient(circle at 10% 0%, ${withAlpha(palette.secondary, picked ? 0.18 : 0.1)}, transparent 42%), linear-gradient(145deg, ${withAlpha(palette.primary, picked ? 0.16 : 0.08)}, ${palette.deep})`,
                    borderColor: withAlpha(palette.primary, picked ? 0.75 : 0.24),
                    boxShadow: picked
                      ? `0 8px 24px ${withAlpha(palette.primary, 0.18)}, inset 0 1px rgba(255,255,255,0.08)`
                      : "inset 0 1px rgba(255,255,255,0.045)",
                  }}
                >
                  <span
                    className="grid h-9 w-9 shrink-0 place-items-center rounded-field border text-title"
                    style={{
                      color: palette.primary,
                      borderColor: withAlpha(palette.primary, 0.25),
                      background: withAlpha(palette.primary, 0.1),
                    }}
                  >
                    {card.glyph}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-footnote font-semibold text-ink">
                      {card.name}
                    </span>
                    <span className="block text-micro text-faint">{card.group}</span>
                  </span>
                  <span
                    className="grid h-5 w-5 shrink-0 place-items-center rounded-full border text-micro font-bold"
                    style={{
                      color: picked ? "#fff" : withAlpha(palette.primary, 0.58),
                      borderColor: withAlpha(palette.primary, picked ? 0.72 : 0.2),
                      background: picked
                        ? `linear-gradient(135deg, ${palette.secondary}, ${palette.primary})`
                        : "rgba(255,255,255,0.025)",
                    }}
                  >
                    {picked ? "✓" : "−"}
                  </span>
                </button>
              );
            })}
          </div>

          <div className={`grid gap-3 ${forcedTrade ? "" : "md:grid-cols-2"}`}>
            {!forcedTrade && (
              <ReasonField
                label="为什么你不能接受这件事？"
                hint="写下第一反应"
                placeholder="例如：我无法接受重要的人因为我受到伤害……"
                value={engine.reasonCannotAccept}
                onChange={(v) =>
                  act(() => {
                    engine.reasonCannotAccept = v;
                    engine.saveProgress();
                  })
                }
              />
            )}
            <ReasonField
              label={forcedTrade
                ? `在必须取舍时，为什么放下这 ${engine.discardPerTrade} 张牌？`
                : `为什么愿意放弃这 ${engine.discardPerTrade} 张牌？`}
              hint="没有标准答案"
              placeholder="例如：这些东西可以以后再争取……"
              value={engine.reasonAbandon}
              onChange={(v) =>
                act(() => {
                  engine.reasonAbandon = v;
                  engine.saveProgress();
                })
              }
            />
          </div>
          <p className="text-micro text-faint">
            你的原话会成为结果分析的重要依据，默认只进入私密画像。
          </p>
        </div>
        </GameWorkspace>
      </div>
      <Foot
        title={`确认交换 ${engine.discardPerTrade} 张牌`}
        enabled={engine.tradePick.length === engine.discardPerTrade}
        onClick={() => {
          const scenarioKey = engine.current?.key;
          const cardKeys = [...engine.tradePick];
          const reasonCannotAccept = engine.reasonCannotAccept.trim();
          const reasonAbandon = engine.reasonAbandon.trim();
          const decisionSource = engine.isForcedTrade
            ? "pressure_forced" as const
            : "voluntary_reject" as const;
          act(() => engine.confirmTrade());
          sessionSync?.record({
            action_type: "trade_cards",
            scenario_key: scenarioKey,
            card_keys: cardKeys,
            reason_cannot_accept: reasonCannotAccept,
            reason_abandon: reasonAbandon,
            decision_source: decisionSource,
          });
        }}
      />
    </div>
  );
}

function ReasonField({
  label,
  hint,
  placeholder,
  value,
  onChange,
}: {
  label: string;
  hint: string;
  placeholder: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="card-game-panel flex flex-col gap-[7px] p-3.5">
      <div className="flex items-baseline justify-between">
        <span className="text-footnote font-semibold text-ink">{label}</span>
        <span className="text-micro text-faint">{hint}</span>
      </div>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        rows={3}
        className="w-full resize-none rounded-field border border-white/[0.065] bg-black/15 p-[11px] text-footnote leading-[1.65] text-ink placeholder:text-faint focus:border-brand/50 focus:outline-none"
      />
    </div>
  );
}
