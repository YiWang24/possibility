"use client";
/* 付费墙浮层 —— 移植 iOS PaywallView.swift（§10 demo mock 支付）。
   三档权益卡：¥9.9 解锁完整主页 / ¥29 向 TA 咨询 / ¥599 申请陪跑。
   点击任一档 → useAuthGate().require 登录门控 → mock 支付：
     · 解锁完整主页调 useData.unlockProfile(travelerId) 写 unlocks 表；
     · 咨询 / 陪跑仅模拟下单（demo 不接真 IAP）。
   成功后 toast + 展示成功态；解锁档回调 onUnlocked 刷新主页解锁态。 */
import { useState } from "react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/Toast";
import { useAuthGate } from "@/components/auth/AuthGate";
import { useData } from "@/stores/data";
import { PRICE_UNLOCK_PROFILE, type TravelerServiceItem } from "@/lib/models";

type TierKind = "unlock" | "consult" | "companion";

interface Tier {
  kind: TierKind;
  eyebrow: string;
  title: string;
  price: number;
  unit: string;
  desc: string;
  cta: string;
  bg: string;
  border: string;
  featured?: boolean;
}

const PAY_NOTE =
  "演示环境：点击即模拟完成，不产生真实扣款。正式版将通过 App 内购安全支付。";

function buildTiers(travelerName: string, services: TravelerServiceItem[]): Tier[] {
  const consult = services.find((s) => s.kind === "consult");
  const companion = services.find((s) => s.kind === "companion");
  return [
    {
      kind: "unlock",
      eyebrow: "解锁完整主页",
      title: `${travelerName} · 完整转型经验`,
      price: PRICE_UNLOCK_PROFILE,
      unit: "次",
      desc: "完整故事 + 全部踩坑建议 + 完整轨迹，一次解锁永久可看。",
      cta: `确认解锁 · ¥${PRICE_UNLOCK_PROFILE}`,
      bg: "linear-gradient(135deg,rgba(94,150,255,0.16) 0%,rgba(143,123,255,0.10) 100%)",
      border: "rgba(111,165,255,0.4)",
      featured: true,
    },
    {
      kind: "consult",
      eyebrow: "1 对 1 咨询",
      title: consult?.title ?? `与${travelerName}进行 1 小时咨询`,
      price: consult?.price ?? 29,
      unit: consult?.unit ?? "次",
      desc: consult?.description ?? "针对你的处境深度沟通，24 小时内可追问一次。",
      cta: `确认预约 · ¥${consult?.price ?? 29}`,
      bg: "linear-gradient(135deg,#151C34 0%,#111327 100%)",
      border: "rgba(111,165,255,0.28)",
    },
    {
      kind: "companion",
      eyebrow: "阶段陪跑",
      title: companion?.title ?? "4 周申请陪跑",
      price: companion?.price ?? 599,
      unit: companion?.unit ?? "期",
      desc: companion?.description ?? "目标拆解 · 每周复盘 · 材料反馈，确认适合后开始。",
      cta: `确认购买 · ¥${companion?.price ?? 599}`,
      bg: "linear-gradient(135deg,#2B1B2D 0%,#17121F 100%)",
      border: "rgba(227,92,193,0.28)",
    },
  ];
}

export function PaywallView({
  travelerId,
  travelerName,
  services,
  onClose,
  onUnlocked,
}: {
  travelerId: number;
  travelerName: string;
  services: TravelerServiceItem[];
  onClose: () => void;
  onUnlocked: () => void;
}) {
  const show = useToast((s) => s.show);
  const { require } = useAuthGate();
  const tiers = buildTiers(travelerName, services);

  const [processing, setProcessing] = useState<TierKind | null>(null);
  const [succeeded, setSucceeded] = useState<Tier | null>(null);

  const pay = (tier: Tier) => {
    if (processing) return;
    // 付费解锁是关键动作：游客先经 AuthGate 就地登录，再继续原动作
    require(() => void confirmPay(tier));
  };

  const confirmPay = async (tier: Tier) => {
    setProcessing(tier.kind);
    if (tier.kind === "unlock") {
      // demo mock 支付：写 unlocks 表（成败都进成功态，与 iOS 一致）
      await useData.getState().unlockProfile(travelerId);
      onUnlocked();
    } else {
      // 咨询 / 陪跑：模拟下单延时
      await new Promise((r) => setTimeout(r, 600));
    }
    setProcessing(null);
    show(tier.kind === "unlock" ? "已解锁完整经验" : "已提交，TA 会尽快与你确认");
    setSucceeded(tier);
  };

  return (
    <motion.div
      className="fixed inset-0 z-[70] flex items-end justify-center md:items-center"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      <button aria-label="关闭" onClick={onClose} className="absolute inset-0 bg-black/55 backdrop-blur-sm" />
      <motion.div
        initial={{ y: "6%", opacity: 0.6 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: "6%", opacity: 0 }}
        transition={{ type: "spring", stiffness: 300, damping: 30 }}
        className="relative max-h-[88dvh] w-full max-w-[520px] overflow-y-auto no-scrollbar rounded-t-sheet border border-line bg-[#11141D] px-[22px] pb-8 pt-6 md:rounded-sheet"
      >
        <div className="mx-auto mb-4 h-1 w-10 rounded-chip bg-white/20 md:hidden" />

        {succeeded ? (
          <SuccessView tier={succeeded} onClose={onClose} />
        ) : (
          <>
            <div className="flex items-center justify-between">
              <div className="flex flex-col gap-1">
                <h2 className="text-[18px] font-semibold text-ink">解锁 TA 的完整经验</h2>
                <span className="text-caption text-sub">选择一档权益，继续你的转型准备</span>
              </div>
              <button
                aria-label="关闭"
                onClick={onClose}
                className="flex h-8 w-8 items-center justify-center rounded-full bg-raised text-sub"
              >
                ✕
              </button>
            </div>

            <div className="mt-[18px] flex flex-col gap-3">
              {tiers.map((tier) => (
                <TierCard
                  key={tier.kind}
                  tier={tier}
                  processing={processing === tier.kind}
                  disabled={processing !== null}
                  onPay={() => pay(tier)}
                />
              ))}
            </div>

            <p className="mt-3.5 text-caption leading-[1.6] text-faint">{PAY_NOTE}</p>
          </>
        )}
      </motion.div>
    </motion.div>
  );
}

function TierCard({
  tier,
  processing,
  disabled,
  onPay,
}: {
  tier: Tier;
  processing: boolean;
  disabled: boolean;
  onPay: () => void;
}) {
  return (
    <div
      className="flex flex-col gap-3 rounded-card border p-[18px]"
      style={{ background: tier.bg, borderColor: tier.border }}
    >
      <div className="flex items-end justify-between gap-2">
        <div className="flex flex-col gap-1.5">
          <span className="flex items-center gap-2 text-micro tracking-[2px] text-brand-lite">
            {tier.eyebrow}
            {tier.featured && (
              <span className="rounded-chip bg-brand/15 px-2 py-0.5 text-micro tracking-normal text-brand">
                最超值
              </span>
            )}
          </span>
          <span className="text-lead font-semibold text-ink">{tier.title}</span>
        </div>
        <span className="shrink-0 text-white">
          <span className="text-[22px] font-bold">¥{tier.price}</span>
          <span className="text-caption text-sub"> / {tier.unit}</span>
        </span>
      </div>
      <p className="text-footnote leading-[1.6] text-sub">{tier.desc}</p>
      <Button size="lg" className="mt-1 w-full" onClick={onPay} disabled={disabled}>
        {processing ? "处理中…" : tier.cta}
      </Button>
    </div>
  );
}

function SuccessView({ tier, onClose }: { tier: Tier; onClose: () => void }) {
  const title = tier.kind === "unlock" ? "已解锁完整经验" : tier.kind === "consult" ? "预约成功" : "购买成功";
  const sub =
    tier.kind === "unlock"
      ? "完整故事、踩坑建议与轨迹已全部展开，回到主页查看。"
      : "TA 会尽快与你确认，可在消息中追问具体细节。";
  return (
    <div className="flex flex-col items-center pt-5 text-center">
      <span className="flex h-[62px] w-[62px] items-center justify-center rounded-full bg-teal/14 text-[28px] font-bold text-teal">
        ✓
      </span>
      <h2 className="mt-4 text-[18px] font-semibold text-ink">{title}</h2>
      <p className="mt-2 text-footnote leading-[1.6] text-sub">{sub}</p>
      <Button size="lg" className="mt-6 w-full" onClick={onClose}>
        好的
      </Button>
    </div>
  );
}
