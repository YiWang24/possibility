"use client";
/* 动态画像维度浮层 —— 移植 iOS DimensionSheet（原型 #skillSheet / DIMENSION_CONFIG）。
   关键词批次（换一批）+ 自定义关键词 + 小工具入口，保存回填画像。 */

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/Toast";
import { DIMENSIONS, type DimensionKey } from "@/lib/dimensions";

export function DimensionSheet({
  dimKey,
  initialSelected,
  onClose,
  onSave,
}: {
  /** null 时不渲染 */
  dimKey: DimensionKey | null;
  initialSelected: string[];
  onClose: () => void;
  onSave: (keywords: string[]) => void;
}) {
  const router = useRouter();
  const showToast = useToast((s) => s.show);

  const [batch, setBatch] = useState(0);
  const [selected, setSelected] = useState<string[]>([]);
  const [custom, setCustom] = useState<string[]>([]);
  const [showCustomInput, setShowCustomInput] = useState(false);
  const [customText, setCustomText] = useState("");

  const open = dimKey !== null;

  /* 每次打开回显已选并复位 */
  useEffect(() => {
    if (open) {
      setSelected(initialSelected);
      setCustom([]);
      setBatch(0);
      setShowCustomInput(false);
      setCustomText("");
    }
    // 仅在打开（dimKey 变化）时初始化
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dimKey]);

  if (!dimKey) return null;
  const cfg = DIMENSIONS[dimKey];
  const toolGroups = [
    { label: "站内探索", tools: cfg.tools.filter((tool) => !tool.externalHref) },
    { label: "中文专业测评 · 跳转官方", tools: cfg.tools.filter((tool) => tool.externalHref) },
  ].filter((group) => group.tools.length > 0);

  // 展示序：已选(不在当前批) + 当前批 + 自定义，去重
  const batchWords = cfg.batches[batch];
  const chipWords: { word: string; isCustom: boolean }[] = [];
  const seen = new Set<string>();
  for (const w of [...selected.filter((s) => !batchWords.includes(s)), ...batchWords]) {
    if (!seen.has(w)) {
      seen.add(w);
      chipWords.push({ word: w, isCustom: false });
    }
  }
  for (const w of custom) {
    if (!seen.has(w)) {
      seen.add(w);
      chipWords.push({ word: w, isCustom: true });
    }
  }

  const toggle = (word: string, isCustom: boolean) => {
    if (isCustom) {
      setCustom((c) => c.filter((w) => w !== word));
    } else {
      setSelected((s) => (s.includes(word) ? s.filter((w) => w !== word) : [...s, word]));
    }
  };

  const addCustom = () => {
    const w = customText.trim();
    if (!w || custom.includes(w) || selected.includes(w)) {
      setCustomText("");
      return;
    }
    setCustom((c) => [...c, w]);
    setCustomText("");
  };

  const save = () => {
    const keywords = [...selected, ...custom].slice(0, 5);
    if (keywords.length === 0) return;
    onSave(keywords);
    showToast("已保存到你的画像");
    onClose();
  };

  const launchTool = (tool: (typeof cfg.tools)[number]) => {
    if (tool.externalHref) {
      const opened = window.open(tool.externalHref, "_blank", "noopener,noreferrer");
      if (!opened) window.location.assign(tool.externalHref);
    } else if (tool.href) {
      router.push(tool.href);
      onClose();
    } else if (tool.assessment) {
      router.push(`/assessment/${tool.assessment}`);
      onClose();
    } else if (tool.cardGame) {
      router.push(`/card-game/${tool.cardGame}`);
      onClose();
    } else {
      showToast(`「${tool.name}」即将上线`);
    }
  };

  const canSave = selected.length > 0 || custom.length > 0;

  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-[80] flex items-end justify-center md:items-center md:p-6">
          <motion.div
            className="absolute inset-0 bg-black/60"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
          />
          <motion.div
            className="no-scrollbar relative max-h-[85vh] w-full overflow-y-auto rounded-t-sheet border border-line bg-[#10131C] shadow-[0_18px_50px_rgba(0,0,0,0.7)] md:w-[460px] md:rounded-sheet"
            initial={{ y: 48, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 48, opacity: 0 }}
            transition={{ type: "spring", stiffness: 380, damping: 34 }}
          >
            <div className="mx-auto mt-3 h-1 w-10 rounded-chip bg-white/20 md:hidden" />

            <div className="flex flex-col px-6 pb-10 pt-4">
              <h2 className="text-[19px] font-bold text-ink">{cfg.title}</h2>

              {/* 01 关键词 */}
              <div className="mt-5 flex items-center justify-between">
                <div className="flex items-center gap-1.5 text-callout font-semibold">
                  <span className="text-brand">01</span>
                  <span className="text-ink">{cfg.question}</span>
                </div>
                <button
                  onClick={() => setBatch((b) => (b + 1) % cfg.batches.length)}
                  className="shrink-0 text-footnote text-brand"
                >
                  换一批 ↻
                </button>
              </div>

              <div className="mt-3 flex flex-wrap gap-2">
                {chipWords.map(({ word, isCustom }) => {
                  const on = isCustom || selected.includes(word);
                  return (
                    <button
                      key={word}
                      onClick={() => toggle(word, isCustom)}
                      className="rounded-chip border px-[15px] py-2 text-footnote transition active:scale-[0.96]"
                      style={
                        on
                          ? {
                              color: "#fff",
                              background: isCustom ? "#2FA98C" : "var(--color-brand-deep)",
                              borderColor: isCustom
                                ? "rgba(62,217,164,0.6)"
                                : "rgba(111,165,255,0.6)",
                              fontWeight: 500,
                            }
                          : {
                              color: "var(--color-sub)",
                              background: "var(--color-raised)",
                              borderColor: "var(--color-line)",
                            }
                      }
                    >
                      {word}
                    </button>
                  );
                })}
              </div>

              {/* 图例 */}
              <div className="mt-3 flex items-center gap-4 text-caption text-faint">
                <span className="flex items-center gap-1.5">
                  <span className="h-[7px] w-[7px] rounded-full bg-brand-deep" />
                  系统推荐
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="h-[7px] w-[7px] rounded-full bg-[#2FA98C]" />
                  我添加的
                </span>
              </div>

              {/* 自定义关键词 */}
              <div className="mt-3 flex flex-col gap-2.5">
                <button
                  onClick={() => setShowCustomInput((v) => !v)}
                  className="self-start text-footnote text-brand"
                >
                  ＋ 自己输入一个关键词
                </button>
                {showCustomInput && (
                  <div className="flex items-center gap-2">
                    <input
                      value={customText}
                      onChange={(e) => setCustomText(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && addCustom()}
                      placeholder="输入一个最像你的词"
                      className="flex-1 rounded-chip border border-line bg-raised px-3.5 py-2.5 text-body text-ink placeholder:text-faint focus:outline-none"
                    />
                    <Button onClick={addCustom}>
                      添加
                    </Button>
                  </div>
                )}
              </div>

              {/* 02 小工具 */}
              <div className="mt-[22px] flex items-center gap-1.5 text-callout font-semibold">
                <span className="text-brand">02</span>
                <span className="text-ink">或者，用小工具继续探索</span>
              </div>

              <div className="mt-3 flex flex-col gap-4">
                {toolGroups.map((group) => (
                  <div key={group.label} className="flex flex-col gap-[11px]">
                    <div className="flex items-center justify-between px-0.5 text-micro tracking-[1.2px] text-faint">
                      <span>{group.label}</span>
                      {group.label.includes("官方") && <span>仅保留中文作答工具</span>}
                    </div>
                    {group.tools.map((tool) => (
                      <button
                        key={tool.name}
                        onClick={() => launchTool(tool)}
                        className="relative flex items-center gap-3 overflow-hidden rounded-tile border border-white/10 px-[15px] py-3.5 text-left transition active:scale-[0.98]"
                        style={{
                          background: `radial-gradient(150px circle at 100% 0%, rgba(255,255,255,0.12), transparent), ${tool.tint}`,
                        }}
                      >
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <div className="text-body font-semibold text-ink">{tool.name}</div>
                            {tool.externalHref && (
                              <span className="rounded-chip border border-white/10 bg-white/6 px-2 py-0.5 text-micro text-brand-lite">
                                官方 ↗
                              </span>
                            )}
                          </div>
                          <div className="mt-1 text-caption leading-relaxed text-sub">{tool.desc}</div>
                          {tool.provider && (
                            <div className="mt-2 text-micro leading-relaxed text-faint">
                              {tool.provider} · {tool.access}
                            </div>
                          )}
                        </div>
                        <span className="shrink-0 rounded-chip bg-white/8 px-[9px] py-[3px] text-micro text-brand-lite">
                          {tool.duration}
                        </span>
                      </button>
                    ))}
                  </div>
                ))}
              </div>

              <div className="mt-[22px]">
                <Button size="lg" className="w-full" disabled={!canSave} onClick={save}>
                  保存到我的画像
                </Button>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
