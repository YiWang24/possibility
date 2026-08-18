"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useToast } from "@/components/ui/Toast";
import type { ChatModel } from "./store";
import type { DrawnTarotCard, TarotPurchaseProduct, TarotShareChannel } from "./tarot";

const POSITIONS = ["现状", "核心阻力", "行动走向"];
const CHANNELS: Array<{ id: TarotShareChannel; label: string; note: string }> = [
  { id: "wechat", label: "微信", note: "发给好友" },
  { id: "moments", label: "朋友圈", note: "发布海报" },
  { id: "xiaohongshu", label: "小红书", note: "发布笔记" },
  { id: "weibo", label: "微博", note: "分享动态" },
  { id: "other", label: "更多渠道", note: "打开系统分享" },
];

const CREDIT_PACKS: Array<{ id: TarotPurchaseProduct; count: number; price: number }> = [
  { id: "credits15", count: 15, price: 19 },
  { id: "credits100", count: 100, price: 99 },
];

function drawWrappedText(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  maxWidth: number,
  lineHeight: number,
  maxLines: number,
): number {
  let line = "";
  let lineCount = 0;
  for (const char of text.replace(/\n+/g, " ")) {
    const next = line + char;
    if (ctx.measureText(next).width > maxWidth && line) {
      ctx.fillText(line, x, y + lineCount * lineHeight);
      line = char;
      lineCount += 1;
      if (lineCount >= maxLines) return y + lineCount * lineHeight;
    } else {
      line = next;
    }
  }
  if (line && lineCount < maxLines) {
    ctx.fillText(line, x, y + lineCount * lineHeight);
    lineCount += 1;
  }
  return y + lineCount * lineHeight;
}

async function makeAppPoster() {
  const canvas = document.createElement("canvas");
  canvas.width = 1080;
  canvas.height = 1440;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("无法生成 App 宣传海报");
  const styles = window.getComputedStyle(document.documentElement);
  const color = (token: string) => styles.getPropertyValue(token).trim();

  const gradient = ctx.createLinearGradient(0, 0, 1080, 1440);
  gradient.addColorStop(0, color("--color-stage"));
  gradient.addColorStop(0.55, color("--color-paper"));
  gradient.addColorStop(1, color("--color-raised"));
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, 1080, 1440);

  ctx.globalAlpha = 0.28;
  ctx.fillStyle = color("--color-brand-bright");
  ctx.beginPath();
  ctx.arc(900, 180, 330, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = color("--color-magenta");
  ctx.beginPath();
  ctx.arc(90, 1260, 360, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalAlpha = 1;

  ctx.fillStyle = color("--color-brand-lite");
  ctx.font = "600 30px system-ui, sans-serif";
  ctx.letterSpacing = "7px";
  ctx.fillText("POSSIBILITY · 万花筒", 84, 110);
  ctx.letterSpacing = "0px";

  ctx.fillStyle = color("--color-ink");
  ctx.font = "700 72px system-ui, sans-serif";
  ctx.fillText("认识你自己，", 84, 250);
  ctx.fillText("推演人生的可能性", 84, 344);
  ctx.fillStyle = "rgba(255,255,255,0.7)";
  ctx.font = "400 30px system-ui, sans-serif";
  drawWrappedText(ctx, "让动态画像、语音日记与真实经验，陪你找到更贴近自己的下一步。", 84, 420, 850, 48, 3);

  const features = [
    ["◉", "动态画像", "在对话与日记中持续生长"],
    ["✦", "人生实验室", "推演选择、代价与可能结果"],
    ["⌁", "相似经验", "看见走过这段路的真实路径"],
  ];
  features.forEach(([symbol, title, note], index) => {
    const y = 610 + index * 190;
    ctx.fillStyle = "rgba(255,255,255,0.06)";
    ctx.strokeStyle = "rgba(145,184,255,0.35)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.roundRect(84, y, 912, 150, 28);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = color("--color-brand-lite");
    ctx.font = "700 42px system-ui, sans-serif";
    ctx.fillText(symbol, 128, y + 88);
    ctx.fillStyle = color("--color-ink");
    ctx.font = "700 31px system-ui, sans-serif";
    ctx.fillText(title, 210, y + 62);
    ctx.fillStyle = "rgba(255,255,255,0.58)";
    ctx.font = "400 24px system-ui, sans-serif";
    ctx.fillText(note, 210, y + 105);
  });

  ctx.fillStyle = color("--color-brand-lite");
  ctx.font = "600 28px system-ui, sans-serif";
  ctx.fillText("分享万花筒，一起看见更多人生可能", 84, 1288);
  ctx.fillStyle = "rgba(255,255,255,0.42)";
  ctx.font = "400 22px system-ui, sans-serif";
  ctx.fillText("海报不包含你的画像、日记或对话内容", 84, 1344);

  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((value) => (value ? resolve(value) : reject(new Error("无法生成 App 宣传海报"))), "image/png");
  });
  const file = new File([blob], "possibility-app-poster.png", { type: "image/png" });
  return { file, url: URL.createObjectURL(blob) };
}

function TarotCardFace({
  card,
  position,
  revealMeaning = false,
}: {
  card: DrawnTarotCard;
  position: string;
  revealMeaning?: boolean;
}) {
  return (
    <div
      className="relative min-h-[174px] rounded-tile border border-brand-bright/35 bg-gradient-to-b from-brand/20 to-white/[0.035] p-3 text-center"
    >
      <span className="block text-micro tracking-[1.5px] text-brand-lite">{position}</span>
      <span className={`mt-3 block text-heading leading-none text-ink ${card.reversed ? "rotate-180" : ""}`}>{card.symbol}</span>
      <span className="mt-3 block text-caption font-semibold text-ink">{card.name}</span>
      <span className="mt-1 block text-micro text-faint">{card.reversed ? "逆位" : "正位"}</span>
      {revealMeaning ? (
        <span className="mt-2 block text-micro leading-[1.5] text-sub line-clamp-2">{card.reversed ? card.shadow : card.light}</span>
      ) : null}
    </div>
  );
}

/** iOS TarotPanel.heading —— 眉标 + 当前问题，offer / drawing / confirm 三个阶段共用。 */
function TarotHeading({ question }: { question: string }) {
  return (
    <>
      <span className="block text-micro tracking-[1.6px] text-brand-lite">三张牌 · 象征分析</span>
      <h2 className="mt-[5px] text-callout font-semibold leading-[1.5] text-ink">{question}</h2>
    </>
  );
}

/** iOS TarotPanel.quotaFooter —— 剩余额度 + 解锁入口。 */
function QuotaFooter({ model }: { model: ChatModel }) {
  return (
    <div className="mt-4 flex items-center justify-between gap-3 border-t border-line pt-3">
      <span className="text-micro text-faint">可用额度：{model.tarotRemainingLabel}</span>
      <button onClick={() => model.prepareTarotShare()} className="text-micro font-semibold text-brand-lite">
        解锁更多次数 ↗
      </button>
    </div>
  );
}

function AppShareSheet({ model, onClose }: { model: ChatModel; onClose: () => void }) {
  const [poster, setPoster] = useState<{ file: File; url: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [awaitingChannel, setAwaitingChannel] = useState<TarotShareChannel | null>(null);

  useEffect(() => {
    let active = true;
    let posterUrl = "";
    void makeAppPoster()
      .then((created) => {
        if (!active) {
          URL.revokeObjectURL(created.url);
          return;
        }
        posterUrl = created.url;
        setPoster(created);
      })
      .catch(() => useToast.getState().show("海报生成失败，请稍后重试"));
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => {
      active = false;
      if (posterUrl) URL.revokeObjectURL(posterUrl);
      window.removeEventListener("keydown", closeOnEscape);
    };
  }, [onClose]);

  const share = async (channel: TarotShareChannel) => {
    if (!poster || busy) return;
    setBusy(true);
    try {
      const data: ShareData = {
        title: "万花筒 · 推演人生的可能性",
        text: "我在使用万花筒，从动态画像、语音日记和真实经验里看见更多人生可能。",
        files: [poster.file],
      };
      if (typeof navigator.share === "function" && (!navigator.canShare || navigator.canShare(data))) {
        await navigator.share(data);
        const claimed = await model.claimTarotShareReward(channel);
        useToast.getState().show(claimed ? "分享完成，已解锁 1 次塔罗抽取" : "次数领取失败，请稍后重试");
      } else {
        const anchor = document.createElement("a");
        anchor.href = poster.url;
        anchor.download = "万花筒-App宣传海报.png";
        anchor.click();
        if (navigator.clipboard) {
          void navigator.clipboard.writeText("我在使用万花筒，一起看见更多人生可能。");
        }
        setAwaitingChannel(channel);
        useToast.getState().show("海报已生成，请完成分享后领取次数");
      }
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return;
      useToast.getState().show("海报生成失败，请稍后重试");
    } finally {
      setBusy(false);
    }
  };

  const confirmFallbackShare = async () => {
    if (!awaitingChannel) return;
    const claimed = await model.claimTarotShareReward(awaitingChannel);
    setAwaitingChannel(null);
    useToast.getState().show(claimed ? "已领取 1 次塔罗抽取，可继续分享领取" : "次数领取失败，请稍后重试");
  };

  return (
    <div className="fixed inset-0 z-[80] flex items-end justify-center md:items-center md:p-6">
      <button aria-label="关闭分享浮层" onClick={onClose} className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="app-share-title"
        className="relative max-h-[92dvh] w-full overflow-y-auto rounded-t-sheet border border-line bg-card p-5 shadow-pop md:max-w-[680px] md:rounded-sheet md:p-6"
      >
        <div className="mx-auto mb-4 h-1 w-10 rounded-chip bg-white/20 md:hidden" />
        <div className="flex items-start justify-between gap-4">
          <div>
            <span className="text-micro tracking-[1.5px] text-brand-lite">每次分享 · +1 次 · 不限次数</span>
            <h2 id="app-share-title" className="mt-1 text-body font-semibold text-ink">分享万花筒 App</h2>
            <p className="mt-1 text-micro leading-[1.6] text-faint">海报不包含你的画像、日记或对话。</p>
          </div>
          <button aria-label="关闭" onClick={onClose} className="flex h-8 w-8 shrink-0 items-center justify-center rounded-chip bg-raised text-sub">✕</button>
        </div>

        <div className="mt-5 grid gap-5 sm:grid-cols-[220px_1fr]">
          <div className="flex min-h-[292px] items-center justify-center rounded-tile border border-line bg-stage/45 p-3">
            {poster ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={poster.url} alt="万花筒 App 宣传海报预览" className="max-h-[50dvh] w-full rounded-tile border border-line" />
            ) : (
              <span className="text-caption text-faint">正在生成海报…</span>
            )}
          </div>

          <div>
            <p className="text-caption font-semibold text-ink">选择分享渠道</p>
            <p className="mt-1 text-micro text-faint">会携带海报和 App 介绍文案</p>
            <div className="mt-3 grid grid-cols-2 gap-2">
              {CHANNELS.map((channel) => {
                return (
                  <button
                    key={channel.id}
                    disabled={!poster || busy}
                    onClick={() => void share(channel.id)}
                    className="rounded-tile border border-line bg-white/[0.045] p-3 text-left transition active:scale-[0.98] disabled:opacity-50"
                  >
                    <span className="block text-caption font-semibold text-ink">{channel.label}</span>
                    <span className="mt-1 block text-micro text-faint">{channel.note}</span>
                  </button>
                );
              })}
            </div>

            {awaitingChannel ? (
              <button
                onClick={() => void confirmFallbackShare()}
                className="mt-3 w-full rounded-chip bg-brand px-4 py-3 text-caption font-semibold text-white"
              >
                我已完成分享，领取 1 次
              </button>
            ) : null}
          </div>
        </div>
      </section>
    </div>
  );
}

function TarotUnlockOptions({ model }: { model: ChatModel }) {
  const [processing, setProcessing] = useState<TarotPurchaseProduct | null>(null);
  const [showShareSheet, setShowShareSheet] = useState(false);
  const closeShareSheet = useCallback(() => setShowShareSheet(false), []);

  const purchase = async (product: TarotPurchaseProduct) => {
    if (processing) return;
    setProcessing(product);
    await model.purchaseTarotAccess(product);
    setProcessing(null);
    const message = product === "subscription"
      ? "演示环境：已模拟开通连续包月"
      : `演示环境：已模拟充入 ${product === "credits15" ? 15 : 100} 次`;
    useToast.getState().show(message);
  };

  return (
    <>
    <div className="mt-4 grid items-stretch gap-3 md:grid-cols-3">
      <div className="flex h-full flex-col rounded-tile border border-brand-bright/30 bg-brand/10 p-4">
        <span className="text-micro tracking-[1.5px] text-brand-lite">每次分享 · +1 次</span>
        <h3 className="mt-2 text-title font-semibold text-ink">分享免费领取次数</h3>
        <p className="mt-2 text-micro leading-[1.6] text-faint">分享次数不限。每完成一次分享即可领取 1 次，可自由选择微信、朋友圈、小红书、微博等渠道。</p>
        <button
          onClick={() => setShowShareSheet(true)}
          className="mt-auto w-full rounded-chip border border-brand-bright/35 bg-brand/15 px-3 py-2.5 text-caption font-semibold text-brand-lite"
        >
          立即分享
        </button>
      </div>
      <div className="flex h-full flex-col rounded-tile border border-brand-bright/35 bg-brand/15 p-4">
        <span className="text-micro tracking-[1.5px] text-brand-lite">包月内不限次</span>
        <h3 className="mt-2 text-title font-semibold text-ink">¥9.9 连续包月</h3>
        <p className="mt-3 text-micro leading-[1.6] text-faint"><span className="mr-1 text-micro">首月</span>优惠；第 2 个月起 ¥25/月，可随时关闭续费</p>
        <button
          disabled={processing !== null}
          onClick={() => void purchase("subscription")}
          className="mt-auto w-full rounded-chip bg-brand px-3 py-2.5 text-caption font-semibold text-white disabled:opacity-55"
        >
          {processing === "subscription" ? "处理中…" : "立即开通"}
        </button>
      </div>
      <div className="flex h-full flex-col rounded-tile border border-line bg-white/[0.045] p-4">
        <span className="text-micro tracking-[1.5px] text-brand-lite">购买次数</span>
        <h3 className="mt-2 text-title font-semibold text-ink">¥19 15次加量包</h3>
        <div className="mt-auto grid gap-2 pt-3">
          {CREDIT_PACKS.map((pack) => (
            <button
              key={pack.id}
              disabled={processing !== null}
              onClick={() => void purchase(pack.id)}
              className="flex items-center justify-between rounded-tile border border-line bg-white/[0.045] px-3 py-3 text-left transition active:scale-[0.98] disabled:opacity-55"
            >
              <span>
                <span className="block text-caption font-semibold text-ink">{pack.count} 次</span>
                <span className="mt-1 block text-micro text-faint">叠加到现有次数</span>
              </span>
              <span className="text-caption font-semibold text-brand-lite">
                {processing === pack.id ? "处理中…" : `¥${pack.price}`}
              </span>
            </button>
          ))}
        </div>
      </div>
      <p className="text-micro leading-[1.6] text-faint md:col-span-3">演示环境：点击购买会模拟权益到账，不会产生真实扣款。正式版需接入 App 内购或合规支付渠道。</p>
    </div>
    {showShareSheet ? <AppShareSheet model={model} onClose={closeShareSheet} /> : null}
    </>
  );
}

export function TarotPanel({ model }: { model: ChatModel }) {
  const [selected, setSelected] = useState<string[]>([]);
  const candidateKey = useMemo(() => model.tarotCandidates.map((card) => card.id).join("|"), [model.tarotCandidates]);

  useEffect(() => setSelected([]), [candidateKey]);

  if (model.tarotPhase === "none") return null;

  if (model.tarotPhase === "offer") {
    return (
      <section className="mt-4 rounded-card border border-brand-bright/25 bg-gradient-to-br from-brand/15 to-white/[0.035] p-4">
        <TarotHeading question={model.tarotDisplayQuestion} />
        <p className="mt-2 text-footnote leading-[1.75] text-sub">
          {model.tarotRequired
            ? "从 12 张候选牌中选出 3 张，会分别对应现状、核心阻力和行动走向。选完后需要你再点击确认。"
            : "刚才的回答已经给出现实判断。如果你还想换一个角度，可以用 3 张牌照见现状、核心阻力和行动走向。"}
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          <button onClick={() => model.beginTarotDraw()} className="rounded-chip bg-brand px-4 py-2.5 text-caption font-semibold text-white">
            开始抽取 3 张牌
          </button>
          {!model.tarotRequired ? (
            <button onClick={() => model.answerWithoutTarot()} className="rounded-chip border border-line px-4 py-2.5 text-caption font-semibold text-sub">
              暂时不抽牌
            </button>
          ) : null}
        </div>
        <QuotaFooter model={model} />
        {model.showTarotShare ? <TarotUnlockOptions model={model} /> : null}
      </section>
    );
  }

  if (model.tarotPhase === "drawing") {
    // iOS TarotPanel.toggle：可反选，选满 3 张后不再追加；确认动作由按钮显式触发。
    const toggle = (cardId: string) => {
      if (selected.includes(cardId)) {
        setSelected(selected.filter((id) => id !== cardId));
        return;
      }
      if (selected.length >= 3) return;
      setSelected([...selected, cardId]);
    };
    return (
      <section className="mt-4 rounded-card border border-brand-bright/25 bg-gradient-to-br from-brand/15 to-white/[0.035] p-4">
        <TarotHeading question={model.tarotDisplayQuestion} />
        <p className="mt-3 text-caption font-semibold text-sub">请选择 3 张 · 已选 {selected.length}/3</p>
        <div className="mt-3 grid grid-cols-4 gap-2 sm:grid-cols-6">
          {model.tarotCandidates.map((card, index) => {
            const isSelected = selected.includes(card.id);
            return (
              <button
                key={card.id}
                aria-pressed={isSelected}
                onClick={() => toggle(card.id)}
                className={`flex h-[72px] flex-col items-center justify-center gap-[7px] rounded-field border transition active:scale-[0.97] ${
                  isSelected ? "border-brand-lite bg-brand-deep/60 text-white" : "border-line bg-white/[0.045] text-sub"
                }`}
              >
                <span className="text-title font-semibold leading-none">{isSelected ? "✦" : "◌"}</span>
                <span className="text-micro font-medium">候选 {index + 1}</span>
              </button>
            );
          })}
        </div>
        <button
          disabled={selected.length !== 3}
          onClick={() => model.prepareTarotConfirmation(selected)}
          className="mt-4 rounded-chip bg-brand px-4 py-2.5 text-caption font-semibold text-white disabled:opacity-55"
        >
          确认这 3 张牌
        </button>
      </section>
    );
  }

  if (model.tarotPhase === "confirm" && model.tarotSelection.length === 3) {
    return (
      <section className="mt-4 rounded-card border border-brand-bright/25 bg-gradient-to-br from-brand/15 to-white/[0.035] p-4">
        <TarotHeading question={model.tarotDisplayQuestion} />
        <p className="mt-3 text-footnote font-semibold text-sub">确认你的三张牌</p>
        <p className="mt-2 text-footnote leading-[1.7] text-sub">点击确认后才会使用 1 次今日机会，并根据三个牌位生成问题答案。</p>
        <div className="mt-4 grid grid-cols-3 gap-2">
          {model.tarotSelection.map((card, index) => (
            <TarotCardFace key={card.id} card={card} position={POSITIONS[index]} />
          ))}
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          <button
            disabled={model.isTarotSubmitting}
            onClick={() => void model.confirmTarotDraw()}
            className="rounded-chip bg-brand px-4 py-2.5 text-caption font-semibold text-white disabled:opacity-55"
          >
            {model.isTarotSubmitting ? "正在生成答案…" : "确认并查看分析"}
          </button>
          <button
            disabled={model.isTarotSubmitting}
            onClick={() => model.beginTarotDraw()}
            className="rounded-chip border border-line px-4 py-2.5 text-caption font-semibold text-sub disabled:opacity-55"
          >
            重新选择
          </button>
        </div>
      </section>
    );
  }

  if (model.tarotPhase === "result" && model.tarotReading) {
    return (
      <section className="mt-4 rounded-card border border-brand-bright/25 bg-gradient-to-br from-brand/15 to-white/[0.035] p-4">
        <span className="text-micro tracking-[1.7px] text-brand-lite">你的三张牌</span>
        <div className="mt-3 grid grid-cols-3 gap-2">
          {model.tarotReading.cards.map((card, index) => (
            <TarotCardFace key={card.id} card={card} position={POSITIONS[index]} revealMeaning />
          ))}
        </div>
        <QuotaFooter model={model} />
        {model.showTarotShare ? <TarotUnlockOptions model={model} /> : null}
      </section>
    );
  }

  return (
    <section className="mt-4 rounded-card border border-violet-soft/30 bg-gradient-to-br from-violet-soft/20 to-white/[0.035] p-4">
      <span className="text-micro tracking-[1.7px] text-brand-lite">今天的基础次数已用完</span>
      <h2 className="mt-2 text-body font-semibold text-ink">选择适合你的解锁方式</h2>
      <p className="mt-2 text-footnote leading-[1.75] text-sub">
        你每天有 3 次基础机会。用完后可无限次分享 App 海报，每次免费领取 1 次；也可连续包月或购买次数包。
      </p>
      <TarotUnlockOptions model={model} />
    </section>
  );
}
