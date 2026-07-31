"use client";
/* 卡牌对局 —— 移植自 iOS CardGameView.swift（原型 #lifeGame / #relationshipGame / #valueGame 通用界面）
 * intro → 选 9 张 → 抽情境（扇形背面牌，翻牌）→ 决策 → 交换 → 结果。 */

import { useCallback, useEffect, useReducer, useState } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import type { CardGameKind, GameCard } from "./data";
import { loadCardGameConfig } from "./catalog";
import {
  CardGameSessionCoordinator,
  pinnedCardGameCatalogVersion,
} from "./session";
import {
  CardGameEngine,
  userScopedCardGameStorage,
} from "./engine";
import { FanArc } from "./FanArc";
import { LifeResult, RelationResult } from "./ResultViews";
import { BackButton, Foot, PRESSURE_COLORS, withAlpha } from "./ui";
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

export function GameView({ kind }: { kind: CardGameKind }) {
  const router = useRouter();
  /* 引擎在客户端挂载后创建（构造时会从 localStorage 恢复局内快照，避免 SSR 水合不一致） */
  const [engine, setEngine] = useState<CardGameEngine | null>(null);
  const [, bump] = useReducer((n: number) => n + 1, 0);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [sessionSync, setSessionSync] =
    useState<CardGameSessionCoordinator | null>(null);
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
        setSessionSync(coordinator);
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
      <div className="flex min-h-dvh items-center justify-center screen-bg px-6 md:min-h-[calc(100dvh-var(--nav-h))]">
        {loadError
          ? (
            <div className="w-full max-w-sm rounded-card border border-line bg-card p-5 text-center">
              <div className="text-[15px] font-semibold text-ink">牌库加载失败</div>
              <p className="mt-2 text-[12px] leading-[1.7] text-sub">
                {loadError}
              </p>
              <button
                className="mt-4 rounded-chip bg-raised px-5 py-2 text-[12px] font-semibold text-ink"
                onClick={() => router.back()}
              >
                返回卡牌大厅
              </button>
            </div>
          )
          : <div className="text-[12px] text-faint">加载最新牌库…</div>}
      </div>
    );
  }
  return (
    <GameBody
      engine={engine}
      sessionSync={sessionSync}
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
  act,
  router,
  isSaving,
  setIsSaving,
  saveError,
  setSaveError,
}: {
  engine: CardGameEngine;
  sessionSync: CardGameSessionCoordinator | null;
  act: (fn: () => void) => void;
  router: ReturnType<typeof useRouter>;
  isSaving: boolean;
  setIsSaving: (v: boolean) => void;
  saveError: string | null;
  setSaveError: (v: string | null) => void;
}) {
  const cfg = engine.config;
  const accent = cfg.accent;
  const phase = engine.phase;

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

  return (
    <div className="flex min-h-dvh flex-col screen-bg md:min-h-[calc(100dvh-var(--nav-h))]">
      {/* 顶栏 */}
      <div className="border-b border-line">
        <div className="mx-auto flex w-full max-w-measure items-center gap-3 px-5 pt-[14px] pb-3">
          <BackButton onClick={back} />
          <div className="min-w-0 flex-1">
            <div className="truncate text-[15.5px] font-bold text-ink">{topInfo.title}</div>
            <div className="truncate text-[10.5px] text-faint">{topInfo.sub}</div>
          </div>
          <div className="flex shrink-0 flex-col items-end gap-[5px]">
            <div className="h-1 w-[70px] overflow-hidden rounded-chip bg-raised">
              <div
                className="h-full rounded-chip transition-all duration-300"
                style={{
                  width: `${engine.progress() * 100}%`,
                  background: `linear-gradient(90deg, ${accent}, ${withAlpha(accent, 0.6)})`,
                }}
              />
            </div>
            <div className="text-[10px] tabular-nums text-faint">{topInfo.progressText}</div>
          </div>
        </div>
      </div>

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
              <div className="flex-1">
                {cfg.kind === "life" ? <LifeResult engine={engine} /> : <RelationResult engine={engine} />}
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
                    <div className="text-[12.5px] font-semibold text-[#FFB096]">
                      ⚠ 已保存在本机，云端同步失败
                    </div>
                    <p className="mt-1.5 text-[10.5px] leading-[1.7] text-sub">{saveError}</p>
                    <button
                      onClick={close}
                      className="mt-2 text-[11.5px] font-semibold text-ink underline-offset-2 active:opacity-70"
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
                      ? cfg.kind === "life"
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
    </div>
  );
}

/* ============ intro ============ */

function IntroPhase({ engine, act }: { engine: CardGameEngine; act: (fn: () => void) => void }) {
  const cfg = engine.config;
  const accent = cfg.accent;
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex-1">
        <div className="mx-auto flex w-full max-w-measure flex-col gap-4 px-6 pt-[14px] pb-[26px]">
          {/* 顶部扇形装饰牌（原型 .linear-spread） */}
          <div className="relative mx-auto mt-3 h-24 w-[220px]">
            {[0, 1, 2, 3, 4].map((i) => {
              const d = i - 2;
              return (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, y: 24, rotate: 0 }}
                  animate={{ opacity: 1, y: Math.abs(d) * 6, rotate: d * 11 }}
                  transition={{ delay: 0.08 * i, type: "spring", stiffness: 240, damping: 18 }}
                  className="absolute left-1/2 top-2 h-[74px] w-[52px] rounded-[9px]"
                  style={{
                    marginLeft: -26 + d * 26,
                    background: `linear-gradient(135deg, ${withAlpha(accent, 0.55)}, ${withAlpha(accent, 0.2)})`,
                    border: "1px solid rgba(255,255,255,0.2)",
                  }}
                />
              );
            })}
          </div>
          <div className="text-[9.5px] font-semibold tracking-[2.6px]" style={{ color: withAlpha(accent, 0.9) }}>
            {cfg.eyebrow}
          </div>
          <h1 className="whitespace-pre-line text-[23px] font-bold leading-[1.5] text-ink">
            {cfg.introTitle}
          </h1>
          <p className="text-[12.5px] leading-[1.8] text-sub">{cfg.introCopy}</p>
          <div className="flex flex-col gap-2.5">
            {cfg.rules.map(([title, copy], idx) => (
              <div
                key={idx}
                className="flex items-start gap-3 rounded-[14px] border border-line bg-card p-3"
              >
                <span
                  className="flex h-7 w-7 shrink-0 items-center justify-center rounded-[9px] text-[11px] font-bold"
                  style={{ color: accent, background: withAlpha(accent, 0.12) }}
                >
                  {pad2(idx + 1)}
                </span>
                <div>
                  <div className="text-[13px] font-semibold text-ink">{title}</div>
                  <div className="mt-[3px] text-[11px] leading-[1.6] text-sub">{copy}</div>
                </div>
              </div>
            ))}
          </div>
          {cfg.contentWarning && (
            <p
              className="rounded-[12px] p-3 text-[10.5px] leading-[1.7] text-faint"
              style={{
                background: "rgba(255,122,77,0.07)",
                border: "1px solid rgba(255,122,77,0.22)",
              }}
            >
              {cfg.contentWarning}
            </p>
          )}
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
      <div className="flex-1">
        <div className="mx-auto flex w-full max-w-measure flex-col gap-3 px-[22px] pt-[14px] pb-6">
          <div className="flex items-start justify-between">
            <div>
              <div className="text-[9px] font-semibold tracking-[2.2px]" style={{ color: withAlpha(accent, 0.9) }}>
                YOUR FOUNDATION
              </div>
              <h2 className="mt-[5px] text-[19px] font-bold text-ink">{cfg.selectTitle}</h2>
            </div>
            <div className="flex flex-col items-center">
              <span className="text-[9.5px] text-faint">已选</span>
              <span className="text-[20px] font-extrabold leading-tight" style={{ color: accent }}>
                {engine.selected.length}
                <span className="text-[11px] font-normal text-faint">
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
          <div className="text-[10.5px] text-faint">没有标准答案，此刻的选择只代表这一局</div>

          <div className="mt-1 grid grid-cols-2 gap-2.5 md:grid-cols-3">
            {cfg.cards.map((card, idx) => (
              <SelectCard key={card.id} engine={engine} act={act} card={card} index={idx} />
            ))}
          </div>
          <div className="pt-1.5 text-center text-[10.5px] text-faint">
            已展示全部 {cfg.cards.length} 张底牌
          </div>
        </div>
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
      className="flex flex-col items-start gap-2 rounded-[14px] p-3 text-left transition active:scale-[0.96]"
      style={{
        background: on ? withAlpha(accent, 0.1) : "var(--color-card)",
        border: `${on ? 1.4 : 1}px solid ${on ? withAlpha(accent, 0.65) : "var(--color-line)"}`,
        boxShadow: on ? `0 4px 14px ${withAlpha(accent, 0.22)}` : undefined,
      }}
    >
      <div className="flex w-full items-center justify-between">
        <span className="text-[7.5px] font-semibold tracking-[1px] text-faint">
          {cfg.cardPrefix} · {pad2(index + 1)}
        </span>
        <span
          className="flex h-[19px] w-[19px] items-center justify-center rounded-full text-[11px] font-bold"
          style={{
            color: on ? "#fff" : "var(--color-faint)",
            background: on ? accent : "var(--color-raised)",
          }}
        >
          {on ? "✓" : "+"}
        </span>
      </div>
      <span className="text-[21px]" style={{ color: on ? accent : "var(--color-sub)" }}>
        {card.glyph}
      </span>
      <div className="w-full">
        <div className="truncate text-[12.5px] font-semibold text-ink">{card.name}</div>
        <div className="mt-0.5 text-[9.5px] text-faint">{card.group}</div>
      </div>
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
    <div className="flex-1">
      <div className="mx-auto flex w-full max-w-measure flex-col gap-4 px-6 pt-4 pb-[26px]">
        <div>
          <div className="text-[9.5px] font-semibold tracking-[2px]" style={{ color: withAlpha(accent, 0.9) }}>
            STAGE {pad2(engine.round + 1)} · {stage.age}
          </div>
          <h2 className="mt-1.5 text-[21px] font-bold text-ink">{stage.name}</h2>
          <p className="mt-1.5 text-[12px] text-sub">
            {engine.acceptStreak > 0
              ? `你已连续接受 ${engine.acceptStreak} 次，压力正在加码。`
              : `命运放下了 ${engine.scenarioChoiceCount} 张牌。凭直觉，抽一张。`}
          </p>
        </div>

        {/* 压力表（原型 .fate-pressure） */}
        <div
          className="rounded-[14px] bg-card p-[13px]"
          style={{
            border: `1px solid ${withAlpha(currentPressureColor, 0.3)}`,
          }}
        >
          <div className="flex items-center justify-between">
            <span className="text-[10.5px] text-faint">{cfg.pressureLabel}</span>
            <span
              className="text-[12.5px] font-bold"
              style={{ color: currentPressureColor }}
            >
              {severity.name}
            </span>
          </div>
          <div className="mt-2 flex gap-[5px]">
            {Array.from(
              { length: engine.pressureMax - engine.pressureMin + 1 },
              (_, index) => engine.pressureMin + index,
            ).map((level) => (
              <div
                key={level}
                className="h-1 flex-1 rounded-chip transition-colors duration-300"
                style={{
                  background: level <= engine.pressure
                    ? currentPressureColor
                    : "var(--color-raised)",
                }}
              />
            ))}
          </div>
          <p className="mt-2 text-[11px] leading-[1.6] text-sub">{severity.copy}</p>
        </div>

        {/* 可滑动扇形牌弧 */}
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

        <div className="text-center text-[10.5px] text-faint">左右滑动牌弧 · 点击其中一张</div>
      </div>
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
      <div className="flex-1">
        <div className="mx-auto flex w-full max-w-measure flex-col items-center gap-[15px] px-6 pt-4 pb-5">
          <span className="rounded-chip bg-raised px-3 py-[5px] text-[10.5px] font-semibold text-sub">
            第 {engine.round + 1} 轮 ·{" "}
            {cfg.kind === "life" ? engine.stageMeta.name : scenario.theme}
          </span>

          {/* 情境卡（翻牌进入） */}
          <motion.div
            initial={{ rotateY: 90, opacity: 0, scale: 0.92 }}
            animate={{ rotateY: 0, opacity: 1, scale: 1 }}
            transition={{ type: "spring", stiffness: 220, damping: 20 }}
            style={{
              transformPerspective: 1000,
              background: `linear-gradient(135deg, ${withAlpha(accent, 0.75)}, ${withAlpha(accent, 0.35)}, #161A30)`,
              border: "1px solid rgba(255,255,255,0.2)",
            }}
            className="w-full rounded-[20px] p-5"
          >
            <div className="text-[8.5px] font-semibold tracking-[2px] text-white/55">
              {cfg.cardPrefix} · SETBACK {pad2(engine.round + 1)}
            </div>
            <div className="mt-2 text-right text-[22px] text-white/40">{cfg.glyph}</div>
            <div className="mt-1 text-[21px] font-bold text-white">{scenario.title}</div>
            <p className="mt-2 text-[12.5px] leading-[1.8] text-white/78">{scenario.copy}</p>
          </motion.div>

          <span
            className="rounded-chip px-3 py-1.5 text-[11px] font-semibold"
            style={{
              color: currentPressureColor,
              background: withAlpha(currentPressureColor, 0.1),
              border: `1px solid ${withAlpha(currentPressureColor, 0.4)}`,
            }}
          >
            {severity.name} · 拒绝需交换 {engine.discardPerTrade} 张
          </span>

          <p className="text-center text-[11.5px] leading-[1.8] text-sub">
            接受它，会保留所有底牌，但下一轮会继续加码；
            <br />
            拒绝它，则放下 {engine.discardPerTrade} 张底牌。直到手中自然只剩
            {engine.finalCardCount} 张。
          </p>

          {/* 持有条 */}
          <div className="flex flex-wrap justify-center gap-1.5">
            {engine.heldCards.map((card) => (
              <span
                key={card.id}
                className="rounded-chip bg-raised px-[9px] py-1 text-[10.5px] text-sub"
              >
                {card.name}
              </span>
            ))}
          </div>
        </div>
      </div>
      <div className="border-t border-line px-5 pt-3 pb-[14px]">
        <div className="mx-auto flex w-full max-w-measure gap-3">
          <button
            onClick={() => {
              const scenarioKey = engine.current?.key;
              act(() => engine.accept());
              sessionSync?.record({
                action_type: "accept_scenario",
                scenario_key: scenarioKey,
              });
            }}
            className="flex-1 rounded-chip bg-btn-g py-[14px] text-[13.5px] font-semibold text-white transition active:scale-[0.97]"
          >
            接受它
          </button>
          <button
            disabled={!engine.canTrade}
            onClick={() => act(() => engine.beginTrade())}
            className="flex-1 rounded-chip py-[14px] text-[13.5px] font-semibold transition active:scale-[0.97]"
            style={{
              color: engine.canTrade ? "#FF9A8A" : "var(--color-faint)",
              background: `rgba(255,106,92,${engine.canTrade ? 0.12 : 0.05})`,
              border: `1px solid rgba(255,106,92,${engine.canTrade ? 0.45 : 0.15})`,
            }}
          >
            {engine.canTrade ? "我不接受" : "只剩最终底牌"}
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
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex-1">
        <div className="mx-auto flex w-full max-w-measure flex-col gap-[14px] px-[22px] pt-4 pb-5">
          <div>
            <div className="text-[9px] font-semibold tracking-[2.2px]" style={{ color: withAlpha(accent, 0.9) }}>
              THE PRICE
            </div>
            <h2 className="mt-[5px] text-[19px] font-bold text-ink">你愿意用什么交换？</h2>
          </div>
          <p
            className="rounded-[12px] p-3 text-[11.5px] leading-[1.8] text-sub"
            style={{
              background: withAlpha(accent, 0.07),
              border: `1px solid ${withAlpha(accent, 0.25)}`,
            }}
          >
            为了让“{engine.current?.title ?? ""}”不发生，请从仍持有的 {engine.held.length}{" "}
            张底牌中放下 {engine.discardPerTrade} 张。最后
            {engine.finalCardCount} 张会被保留。
          </p>

          <div className="grid grid-cols-2 gap-2.5 md:grid-cols-3">
            {engine.heldCards.map((card) => {
              const picked = engine.tradePick.includes(card.id);
              return (
                <button
                  key={card.id}
                  onClick={() =>
                    act(() => {
                      const message = engine.toggleTrade(card.id);
                      if (message) useToast.getState().show(message);
                    })
                  }
                  className="flex items-center gap-2.5 rounded-[13px] px-3 py-3 text-left transition active:scale-[0.96]"
                  style={{
                    background: picked ? "rgba(255,106,92,0.1)" : "var(--color-card)",
                    border: `${picked ? 1.4 : 1}px solid ${picked ? "rgba(255,106,92,0.55)" : "var(--color-line)"}`,
                  }}
                >
                  <span className="text-[16px]" style={{ color: picked ? "#FF9A8A" : "var(--color-sub)" }}>
                    {card.glyph}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[12px] font-semibold text-ink">
                      {card.name}
                    </span>
                    <span className="block text-[9.5px] text-faint">{card.group}</span>
                  </span>
                  {picked && <span className="text-[13px] font-bold text-[#FF9A8A]">×</span>}
                </button>
              );
            })}
          </div>

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
          <ReasonField
            label={`为什么愿意放弃这 ${engine.discardPerTrade} 张牌？`}
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
          <p className="text-[10px] text-faint">
            你的原话会成为结果分析的重要依据，默认只进入私密画像。
          </p>
        </div>
      </div>
      <Foot
        title={`确认交换 ${engine.discardPerTrade} 张牌`}
        enabled={engine.tradePick.length === engine.discardPerTrade}
        onClick={() => {
          const scenarioKey = engine.current?.key;
          const cardKeys = [...engine.tradePick];
          const reasonCannotAccept = engine.reasonCannotAccept.trim();
          const reasonAbandon = engine.reasonAbandon.trim();
          act(() => engine.confirmTrade());
          sessionSync?.record({
            action_type: "trade_cards",
            scenario_key: scenarioKey,
            card_keys: cardKeys,
            reason_cannot_accept: reasonCannotAccept,
            reason_abandon: reasonAbandon,
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
    <div className="flex flex-col gap-[7px]">
      <div className="flex items-baseline justify-between">
        <span className="text-[12px] font-semibold text-ink">{label}</span>
        <span className="text-[10px] text-faint">{hint}</span>
      </div>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        rows={2}
        className="w-full resize-none rounded-[12px] border border-line bg-raised p-[11px] text-[12.5px] text-ink placeholder:text-faint focus:border-brand/50 focus:outline-none"
      />
    </div>
  );
}
