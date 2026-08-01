"use client";
/* 人生实验室（原型 scr-lab）—— 移植自 iOS Features/Lab/LabView.swift + LabModel.swift。
 * 问题卡 → 时间旋钮 → 动态选择卡扇形牌堆（点/拖入转盘）+ 自定义卡 → 底线卡 → 推演。
 * 推演结果作为内部阶段态（ResultView），以便携带数据。 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { PageShell } from "@/components/shell/PageShell";
import { PageHeader, SectionHeader, PrimaryButton } from "@/components/ui/Basics";
import { OrbView } from "@/components/ui/OrbView";
import { useToast } from "@/components/ui/Toast";
import { useData } from "@/stores/data";
import { callFunction } from "@/lib/supabase";
import { cardAccent } from "@/lib/theme";
import { EXPLORE_TOPICS } from "@/lib/models";
import { CardIconChip, CardIconMark, resolveIcon, matchTitleDesc } from "./CardIcon";
import { DialView } from "./DialView";
import { ResultView } from "./ResultView";
import {
  CARRY_CARDS,
  carryCardById,
  DEFAULT_HORIZON_KEY,
  HORIZONS,
  horizonByKey,
  loadCustomChoices,
  LOAD_STEPS,
  persistCustomChoices,
  PRESET_HORIZON_KEYS,
  type Choice,
  type LabChoiceResponse,
  type SimResultData,
  type SimulateResponse,
} from "./model";

const MAGENTA = "#E35CC1";

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T | null> {
  return Promise.race([
    promise,
    new Promise<null>((resolve) => setTimeout(() => resolve(null), ms)),
  ]);
}

export function LabView({ initialQuestion }: { initialQuestion?: string }) {
  const toast = useToast((s) => s.show);
  const travelers = useData((s) => s.travelers);
  const loadTravelers = useData((s) => s.loadTravelers);

  const [question, setQuestion] = useState(initialQuestion?.trim() || EXPLORE_TOPICS[0].sampleQuestion);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");

  const [pick, setPick] = useState<string | null>(null);
  const [horizonKey, setHorizonKey] = useState(DEFAULT_HORIZON_KEY);

  const [remoteChoices, setRemoteChoices] = useState<Choice[]>([]);
  const [choicesLoading, setChoicesLoading] = useState(false);
  const [customChoices, setCustomChoices] = useState<Choice[]>([]);

  const [showCustomEditor, setShowCustomEditor] = useState(false);
  const [customName, setCustomName] = useState("");
  const [customDesc, setCustomDesc] = useState("");
  const [frontCard, setFrontCard] = useState<string | null>(null);
  const [fanned, setFanned] = useState(false);

  const [carry, setCarry] = useState<string[]>([]);

  const [loading, setLoading] = useState(false);
  const [loadStep, setLoadStep] = useState(0);
  const [result, setResult] = useState<SimResultData | null>(null);

  // 拖拽状态
  const [dragChoice, setDragChoice] = useState<Choice | null>(null);
  const [dragPoint, setDragPoint] = useState({ x: 0, y: 0 });
  const [isHotDial, setIsHotDial] = useState(false);
  const dialWrapRef = useRef<HTMLDivElement>(null);

  const choices = useMemo(() => [...remoteChoices, ...customChoices], [remoteChoices, customChoices]);
  const requestIdRef = useRef(0);

  /* 首屏：恢复自定义卡 + 确保旅人池已加载 */
  useEffect(() => {
    setCustomChoices(loadCustomChoices());
    if (travelers.length === 0) void loadTravelers();
    const t = setTimeout(() => setFanned(true), 60);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* 外部带入问题变化时同步（Chat「去人生实验室」） */
  useEffect(() => {
    const q = initialQuestion?.trim();
    if (q && q !== question) setQuestion(q);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialQuestion]);

  /* 问题变化即请求动态选择卡 */
  const loadChoices = useCallback(async () => {
    const q = question;
    requestIdRef.current += 1;
    const requestId = requestIdRef.current;
    setChoicesLoading(true);
    setRemoteChoices([]);
    setPick(null);

    const topic = EXPLORE_TOPICS.find((t) => t.sampleQuestion === q.trim())?.topic;
    const res = await withTimeout(
      callFunction<LabChoiceResponse>("lab-choices", { question: q, ...(topic ? { topic } : {}) }),
      30_000,
    ).catch(() => null);

    if (requestId !== requestIdRef.current) return; // 有更新请求在跑
    setChoicesLoading(false);
    if (q !== question) return;
    const cards = res?.cards;
    if (!cards || cards.length === 0) {
      toast("选择卡生成失败，请检查网络后重试");
      return;
    }
    const seen = new Set(customChoices.map((c) => c.name));
    const mapped: Choice[] = [];
    for (const card of cards) {
      const name = card.title.trim().slice(0, 18);
      const desc = card.description.trim().slice(0, 42);
      if (!name || !desc || seen.has(name)) continue;
      seen.add(name);
      mapped.push({
        id: name,
        name,
        desc,
        isCustom: false,
        color: card.color,
        icon: resolveIcon(card.glyph, name, desc),
      });
    }
    if (mapped.length === 0) {
      toast("选择卡生成结果无效，请重试");
      return;
    }
    setRemoteChoices(mapped);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [question, customChoices, toast]);

  useEffect(() => {
    void loadChoices();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [question]);

  /* ============ 交互 ============ */

  const saveEdit = () => {
    const clean = draft.trim();
    if (clean) setQuestion(clean);
    setEditing(false);
  };

  const selectChoice = (choice: Choice) => {
    setShowCustomEditor(false);
    setPick(choice.name);
    setFrontCard(choice.id);
  };

  const addCustomChoice = () => {
    const n = customName.trim().slice(0, 18);
    const d = customDesc.trim().slice(0, 42);
    if (!n || !d || choices.some((c) => c.name === n)) {
      toast("名称和描述都要填，且不能重名");
      return;
    }
    const choice: Choice = {
      id: n,
      name: n,
      desc: d,
      isCustom: true,
      icon: matchTitleDesc(n, d) ?? "custom",
    };
    const next = [...customChoices, choice];
    setCustomChoices(next);
    persistCustomChoices(next);
    setPick(n);
    setCustomName("");
    setCustomDesc("");
    setShowCustomEditor(false);
    setFrontCard(choice.id);
    toast(`已选中「${n}」`);
  };

  const removeCustomChoice = (name: string) => {
    const next = customChoices.filter((c) => c.name !== name);
    setCustomChoices(next);
    persistCustomChoices(next);
    if (pick === name) setPick(null);
  };

  const toggleCarry = (id: string) => {
    setCarry((prev) => {
      if (prev.includes(id)) return prev.filter((x) => x !== id);
      if (prev.length >= 3) {
        toast("最多带走 3 张底线卡");
        return prev;
      }
      return [...prev, id];
    });
  };

  /* ============ 推演 ============ */

  const runSim = async () => {
    if (!pick || loading) return;
    setLoading(true);
    setLoadStep(0);
    const stepTimer = setInterval(() => {
      setLoadStep((s) => Math.min(s + 1, LOAD_STEPS.length - 1));
    }, 750);
    const horizon = horizonByKey(horizonKey);
    const carryNames = carry.map((id) => carryCardById(id)?.name).filter((n): n is string => !!n);
    try {
      const res = await callFunction<SimulateResponse>("simulate", {
        question,
        choice: pick,
        years: horizon.years,
        time_horizon: horizon.label,
        ...(carryNames.length ? { carry_cards: carryNames } : {}),
      });
      const ids = res.recommended_traveler_ids ?? [];
      const people = ids
        .map((id) => useData.getState().travelers.find((t) => t.id === id))
        .filter((t): t is NonNullable<typeof t> => !!t);
      setResult({
        question,
        choice: pick,
        horizonLabel: horizon.label,
        scenarios: res.scenarios,
        people,
        carry,
        bottomLine: res.bottom_line_analysis ?? null,
      });
    } catch {
      toast("推演 API 调用失败，请检查网络后重试");
    } finally {
      clearInterval(stepTimer);
      setLoading(false);
    }
  };

  /* 结果阶段态 */
  if (result) {
    return <ResultView data={result} onBack={() => setResult(null)} />;
  }

  /* ============ 扇形牌堆布局 ============ */
  type DeckItem = { kind: "choice"; choice: Choice } | { kind: "create" };
  const deckItems: DeckItem[] = [...choices.map((c) => ({ kind: "choice" as const, choice: c })), { kind: "create" as const }];
  const total = deckItems.length;
  const spread = Math.min(310, Math.max(224, (total - 1) * 52));
  const stepPx = total > 1 ? spread / (total - 1) : 0;
  const center = (total - 1) / 2;

  const deckZ = (item: DeckItem, distance: number): number => {
    const id = item.kind === "choice" ? item.choice.id : "__create__";
    if (item.kind === "choice" && dragChoice?.id === item.choice.id) return 30;
    if (frontCard === id) return 28;
    if (item.kind === "choice" && pick === item.choice.name) return 24;
    return Math.round(20 - Math.abs(distance) * 2);
  };

  /* 拖拽命中转盘检测 */
  const overDial = (x: number, y: number): boolean => {
    const el = dialWrapRef.current;
    if (!el) return false;
    const r = el.getBoundingClientRect();
    const cx = r.left + r.width / 2;
    const cy = r.top + r.height / 2;
    return Math.hypot(x - cx, y - cy) < r.width / 2 + 30;
  };

  return (
    <>
      <PageShell>
        <PageHeader
          eyebrow="LIFE LAB"
          title="人生实验室"
          description="设定一个问题与时间尺度，选出你的那张牌，看看这条路会把你带到哪里。"
        />

        {/* 桌面拆成两栏：左「设定条件」（问题 + 时间尺度），右「做出选择」（牌堆 + 底线 + 推演）。
            整条流程纵向排下来在 1440px 屏上要滚三屏，分栏后一屏可见，
            拖牌进转盘的命中判定走 getBoundingClientRect，跨栏依然成立。 */}
        <div className="mt-[18px] grid grid-cols-1 items-start gap-8 lg:mt-9 lg:grid-cols-2 lg:gap-10 xl:gap-14">
          <div className="flex min-w-0 flex-col">
            {/* 问题卡 */}
            <div className="kaleido-card px-5 py-[18px] xl:px-7 xl:py-6">
              <div className="text-[11px] tracking-[2.5px] text-faint">当前探索问题</div>
              {editing ? (
                <div className="mt-2 flex flex-col gap-2.5">
                  <textarea
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    rows={3}
                    className="w-full resize-none rounded-[14px] border border-brand/40 bg-[#060810]/50 px-[14px] py-3 text-[14px] leading-[1.6] text-ink focus:outline-none"
                  />
                  <div className="flex justify-end gap-3">
                    <button onClick={() => setEditing(false)} className="text-[12.5px] text-faint">
                      取消
                    </button>
                    <button
                      onClick={saveEdit}
                      className="rounded-chip bg-btn-g px-5 py-2 text-[12.5px] font-semibold text-white"
                    >
                      确定
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  <p className="mt-2 text-[16.5px] font-bold leading-[1.6] text-ink">{question}</p>
                  <div className="mt-2.5 flex justify-end">
                    <button
                      onClick={() => {
                        setDraft(question);
                        setEditing(true);
                      }}
                      className="text-[12px] text-brand"
                    >
                      更换问题 ›
                    </button>
                  </div>
                </>
              )}
            </div>

            {/* 时间旋钮 */}
            <div ref={dialWrapRef} className="mt-[30px] flex justify-center">
              <DialView horizonKey={horizonKey} onChange={setHorizonKey} pick={pick} isHot={isHotDial} />
            </div>

            {/* 预设档位 */}
            <div className="no-scrollbar mt-[18px] flex gap-2 overflow-x-auto">
              {PRESET_HORIZON_KEYS.map((key) => {
                const h = horizonByKey(key);
                const on = key === horizonKey;
                return (
                  <button
                    key={key}
                    onClick={() => setHorizonKey(key)}
                    className={`shrink-0 rounded-chip border px-[14px] py-2 text-[12px] tabular-nums transition ${
                      on
                        ? "bg-btn-g font-semibold text-white border-[#6FA5FF]/60"
                        : "bg-raised text-sub border-line"
                    }`}
                  >
                    {h.label}
                  </button>
                );
              })}
            </div>
            <p className="mt-3 text-center text-[11px] tracking-[1px] text-faint">
              拖动旋钮，从 7 天到 10 年任意停留
            </p>
          </div>

          <div className="flex min-w-0 flex-col">
            {/* 选择卡扇形牌堆 */}
            <div className="flex flex-col gap-2.5">
              {/* 桌面分栏后转盘在左侧而非上方，文案去掉方位词 */}
              <SectionHeader title="我的选择卡" trailing="点选，或拖进转盘" />
              <GestureHint />
              {choicesLoading && (
                <div className="flex w-fit items-center gap-2 rounded-chip border border-[#6FA5FF]/22 bg-[#5E96FF]/8 px-3 py-1.5">
                  <span className="h-3 w-3 animate-spin rounded-full border-2 border-brand border-t-transparent" />
                  <span className="text-[10px] text-sub">正在根据当前问题生成专属选择卡……</span>
                </div>
              )}
              {!choicesLoading && remoteChoices.length === 0 && (
                <button onClick={() => void loadChoices()} className="w-fit text-[11.5px] font-semibold text-brand">
                  重新生成选择卡
                </button>
              )}

              {showCustomEditor && (
                <CustomEditor
                  name={customName}
                  desc={customDesc}
                  onName={setCustomName}
                  onDesc={setCustomDesc}
                  onCancel={() => {
                    setShowCustomEditor(false);
                    if (frontCard === "__create__") setFrontCard(null);
                  }}
                  onAdd={addCustomChoice}
                />
              )}

              {/* 牌堆 */}
              <div
                className="relative mx-auto w-full"
                style={{ height: total > 7 ? 194 : 178 }}
              >
                {deckItems.map((item, index) => {
                  const distance = index - center;
                  const normalized = center > 0 ? distance / center : 0;
                  const id = item.kind === "choice" ? item.choice.id : "__create__";
                  const lifted = frontCard === id;
                  const x = fanned ? distance * stepPx : 0;
                  const y = fanned ? -5 + Math.pow(Math.abs(normalized), 1.35) * 23 + (lifted ? -9 : 0) : 0;
                  const rot = fanned ? normalized * 16 : 0;
                  const scale = lifted && fanned ? 1.035 : 1;
                  return (
                    <div
                      key={id}
                      className="absolute bottom-2 left-1/2 transition-transform duration-500 ease-out"
                      style={{
                        transformOrigin: "bottom center",
                        transform: `translateX(-50%) translate(${x}px, ${y}px) rotate(${rot}deg) scale(${scale})`,
                        zIndex: deckZ(item, distance),
                      }}
                    >
                      {item.kind === "choice" ? (
                        <ChoiceCardBody
                          choice={item.choice}
                          isOn={pick === item.choice.name}
                          index={index}
                          dragging={dragChoice?.id === item.choice.id}
                          onSelect={() => selectChoice(item.choice)}
                          onRemove={item.choice.isCustom ? () => removeCustomChoice(item.choice.name) : undefined}
                          onDragStart={(px, py) => {
                            setDragChoice(item.choice);
                            setDragPoint({ x: px, y: py });
                            setIsHotDial(overDial(px, py));
                          }}
                          onDragMove={(px, py) => {
                            setDragPoint({ x: px, y: py });
                            setIsHotDial(overDial(px, py));
                          }}
                          onDragEnd={(px, py) => {
                            if (overDial(px, py)) {
                              selectChoice(item.choice);
                              toast(`「${item.choice.name}」已放入实验室`);
                            }
                            setDragChoice(null);
                            setIsHotDial(false);
                          }}
                        />
                      ) : (
                        <CreateCard
                          active={showCustomEditor && frontCard === "__create__"}
                          onClick={() => {
                            setPick(null);
                            setFrontCard("__create__");
                            setShowCustomEditor(true);
                          }}
                        />
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* 底线卡 */}
            <div className="mt-6 flex flex-col gap-3.5">
              <div className="flex items-center justify-between">
                <h2 className="text-[15px] font-bold text-ink">什么要一起带走？</h2>
                <span className="text-[12px] tabular-nums">
                  <span className="font-bold text-brand">{carry.length}</span>
                  <span className="text-faint">/3</span>
                </span>
              </div>
              {/* 手机横滑，桌面换成折行网格 —— 出血横滑条在宽屏上会把末张卡切在栏外 */}
              <div className="no-scrollbar -mx-[22px] flex gap-[9px] overflow-x-auto px-[22px] lg:mx-0 lg:grid lg:grid-cols-2 lg:overflow-visible lg:px-0 xl:grid-cols-3">
                {CARRY_CARDS.map((card) => {
                  const on = carry.includes(card.id);
                  return (
                    <button
                      key={card.id}
                      onClick={() => toggleCarry(card.id)}
                      className="flex w-[130px] shrink-0 flex-col items-start gap-1.5 rounded-[14px] border px-3 py-3 text-left transition active:scale-[0.97] lg:w-auto"
                      style={{
                        background: on ? "rgba(94,150,255,0.1)" : "var(--color-card)",
                        borderColor: on ? "rgba(111,165,255,0.65)" : "var(--color-line)",
                        borderWidth: on ? 1.4 : 1,
                      }}
                    >
                      <span className={on ? "text-brand" : "text-sub"}>
                        <CardIconMark icon={card.icon} size={14} />
                      </span>
                      <span className="text-[12.5px] font-semibold text-ink">{card.name}</span>
                      <span className="text-[9.5px] text-faint">{card.source}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* 开始推演 */}
            <div className="mt-[26px]">
              <PrimaryButton title="开始推演" wide enabled={!!pick && !loading} onClick={runSim} />
            </div>
            <p className="mt-3.5 text-center text-[11px] leading-[1.7] text-faint">
              推演基于你的动态画像与 1,842 位相似旅人的真实经历
              <br />
              它不是预言，是一面镜子
            </p>
          </div>
        </div>
      </PageShell>

      {/* 拖拽浮标 */}
      {dragChoice && (
        <div
          className="pointer-events-none fixed z-[60] flex items-center gap-2 rounded-[16px] border border-[#6FA5FF]/55 bg-[#161A26]/95 px-[18px] py-3 shadow-[0_0_24px_rgba(79,125,255,0.35)]"
          style={{ left: dragPoint.x, top: dragPoint.y, transform: "translate(-50%, -50%)" }}
        >
          <span className="text-brand">
            <CardIconMark icon={dragChoice.icon} size={14} />
          </span>
          <span className="text-[14px] font-semibold text-ink">{dragChoice.name}</span>
        </div>
      )}

      {/* 推演加载浮层 */}
      {loading && (
        <div className="fixed inset-0 z-[70] flex flex-col items-center justify-center gap-[22px] bg-[#08090F]/95 px-10">
          <OrbView size={110} />
          <div className="text-[18px] font-bold text-ink">正在推演 {pick}</div>
          <div className="text-[12.5px] text-sub">{LOAD_STEPS[Math.min(loadStep, LOAD_STEPS.length - 1)]}</div>
        </div>
      )}
    </>
  );
}

/* ============ 手势提示 ============ */

function GestureHint() {
  return (
    <div className="flex flex-wrap items-center gap-1.5 text-[9.5px]">
      <span className="rounded-chip border border-[#8F7BFF]/17 bg-[#8F7BFF]/10 px-[7px] py-[3px] text-[9px] text-[#D9D0F5]">
        手势
      </span>
      <span className="text-[#B6BED0]">单击选中</span>
      <span className="text-[#5D6578]">·</span>
      <span className="text-[#B6BED0]">按住拖入转盘</span>
      <span className="text-[#5D6578]">·</span>
      <span className="text-[#5D6578]">自定义卡可删除</span>
    </div>
  );
}

/* ============ 选择卡卡面（116×148） ============ */

function ChoiceCardBody({
  choice,
  isOn,
  index,
  dragging,
  onSelect,
  onRemove,
  onDragStart,
  onDragMove,
  onDragEnd,
}: {
  choice: Choice;
  isOn: boolean;
  index: number;
  dragging: boolean;
  onSelect: () => void;
  onRemove?: () => void;
  onDragStart: (x: number, y: number) => void;
  onDragMove: (x: number, y: number) => void;
  onDragEnd: (x: number, y: number) => void;
}) {
  const accent = choice.isCustom ? MAGENTA : cardAccent(choice.color, index);
  const start = useRef<{ x: number; y: number; moved: boolean } | null>(null);

  const handlePointerDown = (e: React.PointerEvent) => {
    start.current = { x: e.clientX, y: e.clientY, moved: false };
    e.currentTarget.setPointerCapture(e.pointerId);
  };
  const handlePointerMove = (e: React.PointerEvent) => {
    const s = start.current;
    if (!s) return;
    if (!s.moved && Math.hypot(e.clientX - s.x, e.clientY - s.y) > 8) {
      s.moved = true;
      onDragStart(e.clientX, e.clientY);
    }
    if (s.moved) onDragMove(e.clientX, e.clientY);
  };
  const handlePointerUp = (e: React.PointerEvent) => {
    const s = start.current;
    start.current = null;
    if (!s) return;
    if (s.moved) onDragEnd(e.clientX, e.clientY);
    else onSelect();
  };

  return (
    <div
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      className="relative flex h-[148px] w-[116px] cursor-pointer touch-none flex-col items-start overflow-hidden rounded-[18px] px-[13px] py-[17px]"
      style={{
        background: `radial-gradient(120px circle at 82% -12%, ${hexA(accent, 0.17)}, transparent), ${
          isOn ? "linear-gradient(135deg, rgba(94,150,255,0.26), rgba(143,123,255,0.13)), " : ""
        }#151922`,
        border: isOn
          ? "1.5px solid rgba(111,165,255,0.72)"
          : "1.5px dashed rgba(255,255,255,0.2)",
        opacity: dragging ? 0.22 : 1,
        boxShadow: isOn ? "0 8px 12px rgba(79,125,255,0.5)" : "0 3px 6px rgba(0,0,0,0.5)",
      }}
    >
      <CardIconChip icon={choice.icon} accent={accent} emphasized={isOn} />
      <div className="mt-2.5 text-[13px] font-semibold leading-[1.4] text-ink">{choice.name}</div>
      <div className="mt-1.5 text-[10.5px] leading-[1.5] text-sub">{choice.desc}</div>
      {isOn && (
        <div className="absolute right-3 top-2.5 flex h-5 w-5 items-center justify-center rounded-full bg-btn-g text-[11px] font-bold text-white">
          ✓
        </div>
      )}
      {onRemove && (
        <button
          onPointerDown={(e) => e.stopPropagation()}
          onClick={(e) => {
            e.stopPropagation();
            onRemove();
          }}
          aria-label="删除这张卡"
          className="absolute left-2 top-2 flex h-5 w-5 items-center justify-center rounded-full bg-black/40 text-[12px] text-faint transition hover:text-ink"
        >
          ×
        </button>
      )}
    </div>
  );
}

/* ============ 自定义选择卡 ============ */

function CreateCard({ active, onClick }: { active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="relative flex h-[148px] w-[116px] flex-col items-start overflow-hidden rounded-[18px] px-[13px] py-[17px] text-left"
      style={{
        background: `radial-gradient(120px circle at 82% -12%, ${hexA(MAGENTA, 0.15)}, transparent), ${
          active ? "linear-gradient(135deg, rgba(227,92,193,0.24), rgba(143,123,255,0.14)), " : ""
        }#131720`,
        border: active
          ? "1.5px solid rgba(231,132,211,0.82)"
          : "1.5px dashed rgba(255,255,255,0.13)",
      }}
    >
      <CardIconChip icon="custom" accent={MAGENTA} emphasized={active} />
      <div className="mt-2.5 text-[13px] font-semibold text-[#E3D9F4]">自定义选择</div>
      <div className="mt-1.5 text-[10.5px] leading-[1.5] text-[#777F93]">写下真正在考虑的那条路</div>
      {active && (
        <div
          className="absolute right-3 top-2.5 flex h-5 w-5 items-center justify-center rounded-full text-[11px] font-bold text-white"
          style={{ background: "linear-gradient(135deg, #E35CC1, #8F7BFF)" }}
        >
          ✓
        </div>
      )}
    </button>
  );
}

function CustomEditor({
  name,
  desc,
  onName,
  onDesc,
  onCancel,
  onAdd,
}: {
  name: string;
  desc: string;
  onName: (v: string) => void;
  onDesc: (v: string) => void;
  onCancel: () => void;
  onAdd: () => void;
}) {
  return (
    <div
      className="flex flex-col gap-2.5 rounded-[17px] border p-[13px]"
      style={{
        background: "linear-gradient(135deg, rgba(94,150,255,0.08), rgba(227,92,193,0.055))",
        borderColor: "rgba(143,161,255,0.19)",
      }}
    >
      <div className="flex items-center justify-between">
        <span className="text-[12px] font-semibold text-ink">写一张自己的选择卡</span>
        <span className="text-[9px] text-faint">名称 ≤18 字 · 描述 ≤42 字</span>
      </div>
      <input
        value={name}
        onChange={(e) => onName(e.target.value)}
        placeholder="选择名称，例如：去大厂做 AI"
        className="rounded-[11px] border border-white/10 bg-[#060810]/54 px-[11px] py-[9px] text-[11.5px] text-ink placeholder:text-faint focus:outline-none"
      />
      <textarea
        value={desc}
        onChange={(e) => onDesc(e.target.value)}
        placeholder="一句话描述这条路"
        rows={2}
        className="resize-none rounded-[11px] border border-white/10 bg-[#060810]/54 px-[11px] py-[9px] text-[11.5px] text-ink placeholder:text-faint focus:outline-none"
      />
      <div className="flex justify-end gap-3">
        <button onClick={onCancel} className="text-[11.5px] text-faint">
          取消
        </button>
        <button onClick={onAdd} className="rounded-chip bg-btn-g px-4 py-[7px] text-[11.5px] font-semibold text-white">
          加入牌堆
        </button>
      </div>
    </div>
  );
}

/* #RRGGBB → rgba() */
function hexA(hex: string, alpha: number): string {
  const m = hex.trim().match(/^#?([0-9a-f]{6})$/i);
  if (!m) return hex;
  const n = parseInt(m[1], 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${alpha})`;
}
