"use client";
/* 付费墙浮层 —— 移植 iOS PaywallView.swift（§10 demo mock 支付）。
   单商品订单卡，由入口决定结账对象（iOS ProfileModel.Checkout）：
     · 锁定块 → 解锁完整经验 ¥9.9（真解锁，写 unlocks 表）；
     · 服务卡 → 该项服务（咨询 / 资料包 / 陪跑，demo 模拟下单）。
   点击支付 → useAuthGate().require 登录门控 → mock 支付 → 成功态。 */
import { useState } from "react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { useAuthGate } from "@/components/auth/AuthGate";
import { useData } from "@/stores/data";
import { PRICE_UNLOCK_PROFILE, type TravelerServiceItem } from "@/lib/models";

/** 结账类型，对应 iOS ProfileModel.Checkout。 */
export type ProfileCheckout =
  | { kind: "unlock" }
  | { kind: "service"; service: TravelerServiceItem };

const PAY_NOTE =
  "演示环境：点击即模拟完成，不产生真实扣款。正式版将通过 App 内购安全支付。";

export function PaywallView({
  travelerId,
  travelerName,
  checkout,
  onClose,
  onUnlocked,
}: {
  travelerId: number;
  travelerName: string;
  checkout: ProfileCheckout;
  onClose: () => void;
  onUnlocked: () => void;
}) {
  const { require } = useAuthGate();

  const [processing, setProcessing] = useState(false);
  const [succeeded, setSucceeded] = useState(false);

  const service = checkout.kind === "service" ? checkout.service : null;
  const consult = service?.kind === "consult";
  const headTitle = service ? (consult ? "预约咨询" : "确认订单") : "解锁完整经验";
  const itemTitle = service ? service.title : `${travelerName} · 完整转型经验`;
  const itemSub = service ? service.description : "完整故事 + 全部踩坑建议 + 完整轨迹";
  const price = service ? service.price : PRICE_UNLOCK_PROFILE;
  const actionTitle = service
    ? `${consult ? "确认预约" : "确认购买"} · ¥${price}`
    : `确认解锁 · ¥${price}`;

  const pay = () => {
    if (processing) return;
    // 付费解锁是关键动作：游客先经 AuthGate 就地登录，再继续原动作
    require(() => void confirmPay());
  };

  const confirmPay = async () => {
    setProcessing(true);
    if (!service) {
      // demo mock 支付：写 unlocks 表（成败都进成功态，与 iOS confirmUnlock 一致）
      await useData.getState().unlockProfile(travelerId);
      onUnlocked();
    } else {
      // 具体服务：模拟下单延时
      await new Promise((r) => setTimeout(r, 600));
    }
    setProcessing(false);
    setSucceeded(true);
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
          <SuccessView
            title={service ? (consult ? "预约成功" : "购买成功") : "已解锁完整经验"}
            sub={
              service
                ? "TA 会尽快与你确认。可在消息中追问具体细节。"
                : "完整故事、踩坑建议与轨迹已全部展开，回到主页查看。"
            }
            onClose={onClose}
          />
        ) : (
          <>
            <div className="flex items-center justify-between">
              <h2 className="text-[18px] font-semibold text-ink">{headTitle}</h2>
              <button
                aria-label="关闭"
                onClick={onClose}
                className="flex h-8 w-8 items-center justify-center rounded-full bg-raised text-sub"
              >
                ✕
              </button>
            </div>

            {/* 订单卡（iOS orderCard） */}
            <div className="mt-[18px] flex items-center gap-3.5 rounded-card border border-line bg-card p-4">
              <div className="flex flex-1 flex-col gap-1">
                <span className="text-callout font-semibold text-ink">{itemTitle}</span>
                <span className="text-caption leading-[1.5] text-sub">{itemSub}</span>
              </div>
              <span className="shrink-0 text-[22px] font-bold text-ink">¥{price}</span>
            </div>

            <p className="mt-3.5 text-caption leading-[1.6] text-faint">{PAY_NOTE}</p>

            <Button size="lg" className="mt-5 w-full" onClick={pay} disabled={processing}>
              {processing ? "处理中…" : actionTitle}
            </Button>
          </>
        )}
      </motion.div>
    </motion.div>
  );
}

function SuccessView({ title, sub, onClose }: { title: string; sub: string; onClose: () => void }) {
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
