"use client";

import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { TravelerAvatar } from "@/components/ui/Avatar";
import { Button } from "@/components/ui/button";
import { useAuthGate } from "@/components/auth/AuthGate";
import { useToast } from "@/components/ui/Toast";
import { mockAvatarById } from "@/lib/theme";
import type { Traveler, TravelerServiceItem } from "@/lib/models";

interface PeerMessage {
  id: string;
  role: "me" | "traveler";
  text: string;
}

function messageId(): string {
  if (typeof crypto !== "undefined" && crypto.randomUUID) return crypto.randomUUID();
  return `${Date.now()}-${Math.floor(Math.random() * 1e9)}`;
}

function serviceKindLabel(kind: string): string {
  switch (kind) {
    case "materials":
      return "资料工具包";
    case "companion":
      return "阶段陪跑";
    default:
      return "1 对 1 咨询";
  }
}

export function ConsultChatSheet({
  traveler,
  services,
  onClose,
}: {
  traveler: Traveler;
  services: TravelerServiceItem[];
  onClose: () => void;
}) {
  const { require } = useAuthGate();
  const show = useToast((state) => state.show);
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<PeerMessage[]>([
    {
      id: "welcome",
      role: "traveler",
      text: `你好，我是${traveler.name}。可以先免费聊聊你现在的处境；如果需要更深入的支持，再从下面选择服务。`,
    },
  ]);
  const [selectedService, setSelectedService] = useState<TravelerServiceItem | null>(null);
  const [processingService, setProcessingService] = useState<string | null>(null);
  const [purchasedServiceIds, setPurchasedServiceIds] = useState<string[]>([]);
  const replyTimer = useRef<number | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages.length]);

  useEffect(() => () => {
    if (replyTimer.current != null) window.clearTimeout(replyTimer.current);
  }, []);

  const send = () => {
    const text = input.trim();
    if (!text) return;
    setInput("");
    setMessages((current) => [...current, { id: messageId(), role: "me", text }]);
    if (replyTimer.current != null) window.clearTimeout(replyTimer.current);
    replyTimer.current = window.setTimeout(() => {
      setMessages((current) => [
        ...current,
        {
          id: messageId(),
          role: "traveler",
          text: "我看到了。你可以先说说：在这个问题里，最希望我用亲身经历帮你判断的是什么？",
        },
      ]);
      replyTimer.current = null;
    }, 550);
  };

  const pay = (service: TravelerServiceItem) => {
    if (processingService) return;
    require(() => void confirmPay(service));
  };

  const confirmPay = async (service: TravelerServiceItem) => {
    setProcessingService(service.id);
    await new Promise((resolve) => setTimeout(resolve, 650));
    setProcessingService(null);
    setSelectedService(null);
    setPurchasedServiceIds((current) => [...new Set([...current, service.id])]);
    setMessages((current) => [
      ...current,
      {
        id: messageId(),
        role: "traveler",
        text: `你已选择「${service.title}」。我会在聊天中和你确认目标、时间与交付方式。`,
      },
    ]);
    show("演示环境：已模拟支付成功，不会产生真实扣款");
  };

  return (
    <motion.div
      className="fixed inset-0 z-[70] flex items-end justify-center md:items-center md:p-6"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      <button aria-label="关闭聊天" onClick={onClose} className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
      <motion.section
        role="dialog"
        aria-modal="true"
        aria-labelledby="consult-chat-title"
        initial={{ y: "6%", opacity: 0.7 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: "6%", opacity: 0 }}
        transition={{ type: "spring", stiffness: 300, damping: 30 }}
        className="relative flex h-[min(88dvh,760px)] w-full max-w-[720px] flex-col overflow-hidden rounded-t-sheet border border-line bg-card shadow-pop md:rounded-sheet"
      >
        <div className="flex items-center gap-3 border-b border-line px-5 py-4">
          <TravelerAvatar
            initial={traveler.initial}
            hueIndex={traveler.hue}
            size={42}
            imageSrc={mockAvatarById(traveler.id)}
          />
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <h2 id="consult-chat-title" className="truncate text-body font-semibold text-ink">与{traveler.name}聊天</h2>
              <span className="rounded-chip bg-teal/12 px-2 py-1 text-micro font-semibold text-teal">免费 1v1</span>
            </div>
            <p className="mt-0.5 text-micro text-faint">先聊清楚，再按需选择付费服务</p>
          </div>
          <button aria-label="关闭" onClick={onClose} className="flex h-8 w-8 items-center justify-center rounded-chip bg-raised text-sub">✕</button>
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-4 md:px-5">
          {messages.slice(0, 1).map((message) => <PeerBubble key={message.id} message={message} />)}

          <section className="my-4 rounded-card border border-brand-bright/25 bg-brand/8 p-4">
            <div className="flex items-end justify-between gap-3">
              <div>
                <p className="text-caption font-semibold text-ink">TA 可以提供的服务</p>
                <p className="mt-1 text-micro text-faint">免费聊天无需选择服务，需要时再付费</p>
              </div>
              <span className="shrink-0 text-micro text-brand-lite">{services.length} 项</span>
            </div>
            <div className="mt-3 grid gap-2 sm:grid-cols-3">
              {services.length > 0 ? services.map((service) => {
                const purchased = purchasedServiceIds.includes(service.id);
                return (
                  <button
                    key={service.id}
                    onClick={() => setSelectedService(service)}
                    className="flex min-h-[142px] flex-col rounded-tile border border-line bg-white/[0.045] p-3 text-left transition hover:border-brand-bright/40 active:scale-[0.98]"
                  >
                    <span className="text-micro tracking-[1.2px] text-brand-lite">{serviceKindLabel(service.kind)}</span>
                    <span className="mt-2 line-clamp-2 text-caption font-semibold leading-[1.5] text-ink">{service.title}</span>
                    <span className="mt-auto pt-3 text-caption font-semibold text-white">
                      {purchased ? "已选择" : `¥${service.price} / ${service.unit}`}
                    </span>
                  </button>
                );
              }) : (
                <p className="text-caption text-faint sm:col-span-3">TA 暂未发布付费服务，你仍然可以继续免费聊天。</p>
              )}
            </div>
          </section>

          {messages.slice(1).map((message) => <PeerBubble key={message.id} message={message} />)}
          <div ref={bottomRef} />
        </div>

        <div className="border-t border-line bg-paper/95 p-3 pb-[max(12px,env(safe-area-inset-bottom))]">
          <div className="flex items-end gap-2 rounded-field border border-line bg-raised px-3 py-2">
            <textarea
              value={input}
              onChange={(event) => setInput(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter" && !event.shiftKey) {
                  event.preventDefault();
                  send();
                }
              }}
              rows={1}
              aria-label="发送免费消息"
              placeholder="免费聊聊你的问题…"
              className="max-h-28 min-h-8 flex-1 resize-none bg-transparent py-1 text-callout leading-[1.5] text-ink outline-none placeholder:text-faint"
            />
            <button
              onClick={send}
              disabled={!input.trim()}
              className="rounded-chip bg-brand px-4 py-2 text-caption font-semibold text-white disabled:opacity-40"
            >
              发送
            </button>
          </div>
        </div>
      </motion.section>

      {selectedService ? (
        <ServiceCheckout
          service={selectedService}
          processing={processingService === selectedService.id}
          onClose={() => setSelectedService(null)}
          onPay={() => pay(selectedService)}
        />
      ) : null}
    </motion.div>
  );
}

function PeerBubble({ message }: { message: PeerMessage }) {
  const mine = message.role === "me";
  return (
    <div className={`flex py-1.5 ${mine ? "justify-end pl-10" : "justify-start pr-10"}`}>
      <div className={`max-w-[min(82%,48ch)] rounded-card px-4 py-3 text-callout leading-[1.65] ${
        mine
          ? "bg-brand text-white"
          : "border border-line bg-card text-ink"
      }`}>
        {message.text}
      </div>
    </div>
  );
}

function ServiceCheckout({
  service,
  processing,
  onClose,
  onPay,
}: {
  service: TravelerServiceItem;
  processing: boolean;
  onClose: () => void;
  onPay: () => void;
}) {
  return (
    <div className="fixed inset-0 z-[80] flex items-end justify-center md:items-center md:p-6">
      <button aria-label="关闭服务确认" onClick={onClose} className="absolute inset-0 bg-black/65 backdrop-blur-sm" />
      <section role="dialog" aria-modal="true" aria-labelledby="service-checkout-title" className="relative w-full max-w-[440px] rounded-t-sheet border border-line bg-card p-5 shadow-pop md:rounded-sheet">
        <div className="flex items-start justify-between gap-4">
          <div>
            <span className="text-micro tracking-[1.5px] text-brand-lite">{serviceKindLabel(service.kind)}</span>
            <h3 id="service-checkout-title" className="mt-2 text-body font-semibold text-ink">{service.title}</h3>
          </div>
          <button aria-label="关闭" onClick={onClose} className="flex h-8 w-8 items-center justify-center rounded-chip bg-raised text-sub">✕</button>
        </div>
        <p className="mt-3 text-footnote leading-[1.7] text-sub">{service.description}</p>
        {service.tags.length > 0 ? (
          <div className="mt-3 flex flex-wrap gap-2">
            {service.tags.slice(0, 4).map((tag) => (
              <span key={tag} className="rounded-chip bg-white/[0.055] px-2.5 py-1.5 text-micro text-sub">{tag}</span>
            ))}
          </div>
        ) : null}
        <div className="mt-5 flex items-end justify-between border-t border-line pt-4">
          <span className="text-caption text-faint">确认后在聊天中沟通服务细节</span>
          <span className="text-heading font-bold text-white">¥{service.price}<span className="text-caption font-normal text-sub"> / {service.unit}</span></span>
        </div>
        <Button size="lg" className="mt-4 w-full" onClick={onPay} disabled={processing}>
          {processing ? "处理中…" : `确认支付 ¥${service.price}`}
        </Button>
        <p className="mt-3 text-center text-micro text-faint">演示环境：模拟支付，不会产生真实扣款</p>
      </section>
    </div>
  );
}
