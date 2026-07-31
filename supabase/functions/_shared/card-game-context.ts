type CardGameContext = {
  text: string;
  gameKeys: string[];
};

function object(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

function safeText(value: unknown, max = 80): string | null {
  if (typeof value !== "string") return null;
  const text = value.replace(/\s+/g, " ").trim();
  return text.length > 0 ? text.slice(0, max) : null;
}

/**
 * 将每种游戏最近一次已验证结果压缩成 AI 可消费的证据块。
 * 这里只读取完成时生成的结构化快照，不读取玩家在交换理由中写下的原话。
 */
export function cardGameRunsContext(rows: unknown[]): CardGameContext {
  const seen = new Set<string>();
  const lines: string[] = [];

  for (const rawRow of rows) {
    if (lines.length >= 6) break;
    const row = object(rawRow);
    const snapshot = object(row?.ai_snapshot);
    const source = object(snapshot?.source);
    const gameKey = safeText(source?.game_key, 64);
    if (!snapshot || !gameKey || seen.has(gameKey)) continue;

    const cards = Array.isArray(snapshot.final_cards)
      ? snapshot.final_cards
        .map((item) => safeText(object(item)?.title_snapshot, 40))
        .filter((value): value is string => Boolean(value))
        .slice(0, 8)
      : [];
    const behavior = object(snapshot.behavior);
    const mode = safeText(behavior?.decision_mode, 40);
    const acceptRate = typeof behavior?.accept_rate === "number" &&
        Number.isFinite(behavior.accept_rate)
      ? Math.round(behavior.accept_rate * 100)
      : null;
    const tradeCount = Number.isInteger(behavior?.trade_count)
      ? Number(behavior?.trade_count)
      : null;
    const voluntaryTradeCount = Number.isInteger(
        behavior?.voluntary_trade_count,
      )
      ? Number(behavior?.voluntary_trade_count)
      : null;
    const forcedTradeCount = Number.isInteger(behavior?.forced_trade_count)
      ? Number(behavior?.forced_trade_count)
      : null;
    const signals = Array.isArray(snapshot.signals)
      ? snapshot.signals
        .map((item) => {
          const signal = object(item);
          const key = safeText(signal?.key, 64);
          const score = typeof signal?.score === "number" &&
              Number.isFinite(signal.score)
            ? signal.score.toFixed(2)
            : null;
          const confidence = typeof signal?.confidence === "number" &&
              Number.isFinite(signal.confidence)
            ? Math.round(signal.confidence * 100)
            : null;
          return key && score && confidence !== null
            ? `${key}=${score}（置信度${confidence}%）`
            : null;
        })
        .filter((value): value is string => Boolean(value))
        .slice(0, 5)
      : [];

    if (cards.length === 0 && signals.length === 0) continue;
    const parts = [
      cards.length > 0 ? `最终选择：${cards.join("、")}` : null,
      mode ? `决策模式：${mode}` : null,
      acceptRate !== null ? `接受率：${acceptRate}%` : null,
      voluntaryTradeCount !== null
        ? `自主交换：${voluntaryTradeCount}次`
        : null,
      forcedTradeCount !== null ? `压力强制交换：${forcedTradeCount}次` : null,
      voluntaryTradeCount === null && forcedTradeCount === null &&
        tradeCount !== null
        ? `交换总计：${tradeCount}次`
        : null,
      signals.length > 0 ? `结构化信号：${signals.join("；")}` : null,
      "限制：这是一次情境游戏证据，不等同于稳定人格或心理诊断",
    ].filter(Boolean);
    lines.push(`卡牌结果（${gameKey}）：${parts.join("；")}`);
    seen.add(gameKey);
  }

  return {
    text: lines.join("\n"),
    gameKeys: [...seen],
  };
}
