"use client";
/* 卡牌游戏大厅 —— 移植自 iOS CardGameHubView.swift（原型 #cardGameHub） */

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import {
  type CardGameManifestItem,
  loadCardGameManifest,
} from "./catalog";
import {
  CARD_GAME_KINDS,
  type CardGameKind,
  cardGameConfig,
} from "./data";
import {
  CardGameLocalRecord,
  defaultStorage,
  userScopedCardGameStorage,
} from "./engine";
import { BackButton, withAlpha } from "./ui";
import { hue } from "@/lib/theme";
import { supabase } from "@/lib/supabase";

export function HubView() {
  const router = useRouter();
  /** 已完成 / 进行中的卡牌局（本地标记），驱动角标 */
  const [completedKinds, setCompletedKinds] = useState<Set<CardGameKind>>(new Set());
  const [progressKinds, setProgressKinds] = useState<Set<CardGameKind>>(new Set());
  const [games, setGames] = useState<CardGameManifestItem[]>([]);

  const refresh = useCallback(async () => {
    const remote = await loadCardGameManifest();
    const available = remote.length > 0
      ? remote
      : CARD_GAME_KINDS.map((kind, index) => {
        const config = cardGameConfig(kind);
        return {
          game_key: kind,
          title: config.title,
          intro_copy: config.introCopy,
          accent: config.accent,
          glyph: config.glyph,
          version: 1,
          content_hash: "fallback",
          sort_order: (index + 1) * 10,
        };
      });
    setGames(available);
    let store = defaultStorage();
    try {
      const { data } = await supabase().auth.getSession();
      if (data.session?.user.id) {
        store = userScopedCardGameStorage(data.session.user.id, store);
      }
    } catch {
      // Status badges may temporarily use the legacy local cache.
    }
    const kinds = available.map((game) => game.game_key);
    setCompletedKinds(CardGameLocalRecord.doneKinds(store, kinds));
    setProgressKinds(CardGameLocalRecord.progressKinds(store, kinds));
  }, []);

  useEffect(() => {
    void refresh();
    const refreshOnFocus = () => void refresh();
    window.addEventListener("focus", refreshOnFocus);
    document.addEventListener("visibilitychange", refreshOnFocus);
    return () => {
      window.removeEventListener("focus", refreshOnFocus);
      document.removeEventListener("visibilitychange", refreshOnFocus);
    };
  }, [refresh]);

  const launch = (kind: CardGameKind) => router.push(`/card-game/${kind}`);
  const life = games.find((game) => game.game_key === "life");
  const secondaryGames = games.filter((game) => game.game_key !== "life");

  /** 完成、进行中或本地已完成但云端待同步的角标 */
  const statusBadge = (kind: CardGameKind) => {
    const done = completedKinds.has(kind);
    const inProgress = progressKinds.has(kind);
    if (!done && !inProgress) return null;
    const pendingSync = done && inProgress;
    const title = pendingSync ? "待同步" : done ? "已完成" : "继续";
    const color = pendingSync ? "#FFB096" : done ? "#8EE7C8" : "#9DBCFF";
    return (
      <span
        className="shrink-0 rounded-chip px-2 py-1 text-[9.5px] font-semibold"
        style={{
          color,
          background: withAlpha(color, 0.12),
          border: `1px solid ${withAlpha(color, 0.35)}`,
        }}
      >
        {title}
      </span>
    );
  };

  return (
    <div className="min-h-dvh screen-bg md:min-h-[calc(100dvh-74px)]">
      {/* 顶栏 */}
      <div className="border-b border-line">
        <div className="mx-auto flex w-full max-w-measure items-center gap-3 px-5 pt-[14px] pb-3">
          <BackButton onClick={() => router.back()} />
          <div className="text-[16px] font-bold text-ink">卡牌探索</div>
        </div>
      </div>

      <div className="mx-auto flex w-full max-w-measure flex-col gap-4 px-[22px] pt-4 pb-[34px]">
        {/* hero */}
        <motion.div
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35 }}
          className="relative overflow-hidden rounded-card p-5"
          style={{
            background:
              "radial-gradient(190px circle at 100% 0%, rgba(143,123,255,0.28), transparent), linear-gradient(135deg,#141A34,#241A3E,#10132A)",
            border: "1px solid rgba(143,123,255,0.28)",
          }}
        >
          <p className="text-[12px] leading-[1.8] text-sub">
            每套卡牌都会让你在有限的底牌里做选择。最终留下的牌，会成为画像的一部分。
          </p>
        </motion.div>

        {/* 人生卡牌主卡 */}
        <motion.button
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, delay: 0.05 }}
          onClick={() => life && launch(life.game_key)}
          disabled={!life}
          className="relative overflow-hidden rounded-[18px] p-4 text-left transition active:scale-[0.98]"
          style={{
            background:
              "radial-gradient(150px circle at 100% 0%, rgba(143,123,255,0.3), transparent), linear-gradient(135deg,#1B1A38,#241A45,#141329)",
            border: "1px solid rgba(143,123,255,0.32)",
          }}
        >
          <div className="flex flex-col gap-[14px]">
            <div className="flex items-center gap-[14px]">
              {/* 迷你牌堆 */}
              <div className="relative h-[36px] w-[44px] shrink-0">
                <div
                  className="absolute left-[2px] top-0 h-[36px] w-[26px] -rotate-[10deg] rounded-[6px]"
                  style={{ background: hue(4).gradient }}
                />
                <div
                  className="absolute left-[13px] top-0 h-[36px] w-[26px] rotate-[9deg] rounded-[6px]"
                  style={{ background: hue(1).gradient }}
                />
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-[9.5px] font-semibold tracking-[1.8px] text-[#B6A8FF]">
                  LIFE CARDS · 5–8 分钟
                </div>
                <div className="mt-1 text-[15.5px] font-bold text-ink">
                  {life?.title ?? "正在加载人生卡牌…"}
                </div>
                <div className="mt-0.5 text-[11px] text-sub">
                  {life?.intro_copy ?? "正在读取最新牌库"}
                </div>
              </div>
              {statusBadge("life")}
              <span className="text-[16px] text-faint">›</span>
            </div>
            <div className="flex gap-2">
              {(
                [
                  ["01", "选择"],
                  ["02", "加码"],
                  ["03", "交换"],
                ] as const
              ).map(([no, label]) => (
                <div
                  key={no}
                  className="flex flex-1 items-center justify-center gap-1.5 rounded-chip bg-white/6 py-[7px]"
                >
                  <span className="text-[9.5px] font-bold text-[#B6A8FF]">{no}</span>
                  <span className="text-[10.5px] text-sub">{label}</span>
                </div>
              ))}
            </div>
          </div>
        </motion.button>

        <div className="pt-1 text-[11px] tracking-[1px] text-faint">更多专题</div>

        {secondaryGames.map((game, i) => {
          const kind = game.game_key;
          return (
            <motion.button
              key={kind}
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.35, delay: 0.1 + i * 0.05 }}
              onClick={() => launch(kind)}
              className="flex items-center gap-[13px] rounded-[16px] bg-card px-[15px] py-[14px] text-left transition active:scale-[0.98]"
              style={{
                border: `1px solid ${withAlpha(game.accent, 0.24)}`,
              }}
            >
              <span
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[13px] text-[17px]"
                style={{
                  color: game.accent,
                  background: withAlpha(game.accent, 0.13),
                }}
              >
                {game.glyph}
              </span>
              <div className="min-w-0 flex-1">
                <div className="text-[14px] font-semibold text-ink">
                  {game.title}
                </div>
                <div className="mt-[3px] line-clamp-2 text-[11px] text-sub">
                  {game.intro_copy}
                </div>
              </div>
              {statusBadge(kind)}
              <span className="text-[15px] text-faint">›</span>
            </motion.button>
          );
        })}
      </div>
    </div>
  );
}
