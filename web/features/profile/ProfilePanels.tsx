"use client";
/* 旅人主页四个面板 —— 移植 iOS ProfilePanels.swift / ProfileModel.swift。
   她的故事（quote + 转型故事 intro + 事实卡 + 完整故事[付费]）
   时间线 trajectory（可展开节点，公开）
   经验与建议 advice（转型决策 / 能力迁移 / 求职面试 三类，付费）
   可提供服务 services（consult / materials / companion 三档，CTA 触发付费墙）。
   未解锁时「完整故事」「经验与建议」以 LockedBlock 打码浮层触发付费墙。 */
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Chip } from "@/components/ui/chip";
import { SectionHeader } from "@/components/ui/page-header";
import {
  ADVICE_KINDS,
  adviceTips,
  type AdviceKind,
  type Traveler,
  type TravelerDetail,
  type TravelerServiceItem,
} from "@/lib/models";

/* ============ 锁定块（原型 prof-lock / story-locked） ============ */

export function LockedBlock({
  title,
  hint,
  onClick,
}: {
  title: string;
  hint: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="relative flex w-full items-center justify-center overflow-hidden rounded-card border border-brand-bright/20 p-[19px] text-center transition active:scale-[0.98]"
      style={{
        background:
          "linear-gradient(135deg,rgba(27,31,43,0.96) 0%,rgba(18,21,31,0.96) 100%)",
      }}
    >
      {/* 打码：模糊条 */}
      <div className="pointer-events-none absolute inset-0 flex flex-col justify-center gap-[9px] p-[19px] opacity-[0.24] blur-[4px]">
        {[1, 0.76, 0.88].map((w, i) => (
          <span
            key={i}
            className="h-2 rounded-chip bg-sub"
            style={{ width: `${w * 100}%`, maxWidth: 220 }}
          />
        ))}
      </div>
      <div className="relative flex flex-col items-center gap-1.5">
        <LockIcon />
        <span className="text-body font-semibold text-ink">{title}</span>
        <span className="text-caption leading-[1.5] text-sub">{hint}</span>
      </div>
    </button>
  );
}

function LockIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden className="text-brand">
      <path
        d="M6 10V8a6 6 0 1 1 12 0v2m-13 0h14a1 1 0 0 1 1 1v8a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1v-8a1 1 0 0 1 1-1Z"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/* ============ 她的故事 ============ */

export function StoryPanel({
  traveler,
  detail,
  unlocked,
  onOpenPaywall,
}: {
  traveler: Traveler;
  detail: TravelerDetail | null;
  unlocked: boolean;
  onOpenPaywall: () => void;
}) {
  const nodeCount = traveler.trajectory.length;
  const years = detail?.years?.replace(/[^\d]/g, "") || String(nodeCount);
  return (
    <div className="flex flex-col gap-[18px]">
      {/* 一句话金句 */}
      <div
        className="rounded-card border border-brand-bright/25 p-[22px] text-lead font-medium leading-[1.75] text-ink"
        style={{
          background:
            "linear-gradient(135deg,rgba(94,150,255,0.15) 0%,rgba(143,123,255,0.08) 100%)",
        }}
      >
        {traveler.quote}
      </div>

      {detail && (
        <>
          <div className="flex flex-col gap-2.5">
            <h3 className="text-lead font-semibold text-ink">我的转型故事</h3>
            <p className="text-body leading-[1.75] text-[#C8CDDA]">{detail.intro}</p>
          </div>

          {/* 事实卡 */}
          <div className="grid grid-cols-3 gap-2">
            <Fact value={`${years} 年`} label="真实实践" />
            <Fact value={String(nodeCount)} label="关键节点" />
            <Fact value={String(detail.consulted ?? 0)} label="已帮助人数" />
          </div>

          {/* 完整故事（付费） */}
          {unlocked ? (
            <Card elevation="flat" className="flex flex-col gap-2.5 p-[18px]">
              <h4 className="text-body font-semibold text-brand-lite">完整故事 · 最难的一关</h4>
              <p className="text-body leading-[1.75] text-sub">{detail.full_text}</p>
            </Card>
          ) : (
            <LockedBlock
              title="解锁完整故事 · 最难的一关"
              hint="完整故事 + 全部踩坑建议 + 完整轨迹"
              onClick={onOpenPaywall}
            />
          )}
        </>
      )}
    </div>
  );
}

function Fact({ value, label }: { value: string; label: string }) {
  return (
    <div className="flex flex-col items-center gap-1 rounded-tile border border-line bg-card py-[13px]">
      <span className="text-lead font-semibold text-ink">{value}</span>
      <span className="text-micro text-faint">{label}</span>
    </div>
  );
}

/* ============ 时间线（公开） ============ */

export function TimelinePanel({ traveler }: { traveler: Traveler }) {
  const nodes = traveler.trajectory;
  const [openIndex, setOpenIndex] = useState(0);
  return (
    <div className="flex flex-col gap-2">
      <SectionHeader title="人生关键轨迹" trailing="点击节点展开详情" />
      <div className="mt-3 grid grid-cols-1 gap-0 md:grid-cols-2 md:gap-x-4">
        {nodes.map((node, idx) => (
          <TimelineNode
            key={idx}
            age={node.age}
            title={node.t}
            detail={node.d}
            isLast={idx === nodes.length - 1}
            open={openIndex === idx}
            onToggle={() => setOpenIndex(openIndex === idx ? -1 : idx)}
          />
        ))}
      </div>
      <Card elevation="flat" className="mt-2 flex flex-col gap-2.5 p-[18px]">
        <h4 className="text-body font-semibold text-brand-lite">轨迹说明</h4>
        <p className="text-body leading-[1.7] text-sub">
          以上节点由本人补充，并结合公开履历完成基础验证。经历只代表个人路径，不构成标准答案。
        </p>
      </Card>
    </div>
  );
}

function TimelineNode({
  age,
  title,
  detail,
  isLast,
  open,
  onToggle,
}: {
  age: string;
  title: string;
  detail: string;
  isLast: boolean;
  open: boolean;
  onToggle: () => void;
}) {
  return (
    <div className="flex items-stretch">
      {/* 竖线 + 节点 */}
      <div className="flex w-[15px] flex-col items-center pt-[15px] md:hidden">
        <span
          className="h-[15px] w-[15px] shrink-0 rounded-full border-[3px] border-[#0B0E17] bg-brand-deep"
          style={{ boxShadow: "0 0 0 1px rgba(143,123,255,0.5)" }}
        />
        {!isLast && (
          <span
            className="w-px flex-1"
            style={{
              background: "linear-gradient(to bottom,#8f7bff,rgba(143,123,255,0.08))",
            }}
          />
        )}
      </div>
      <button
        onClick={onToggle}
        className="ml-[15px] mb-3 flex-1 rounded-tile border border-line bg-card p-[15px] text-left transition active:scale-[0.99] md:ml-0"
      >
        <div className="flex items-start justify-between gap-2">
          <div className="flex flex-col gap-1">
            <span className="text-caption font-semibold text-brand">{age}</span>
            <span className="text-callout font-semibold text-ink">{title}</span>
          </div>
          <span
            className="text-lead text-faint transition-transform"
            style={{ transform: open ? "rotate(90deg)" : "none" }}
          >
            ›
          </span>
        </div>
        {open && <p className="mt-2.5 text-footnote leading-[1.6] text-sub">{detail}</p>}
      </button>
    </div>
  );
}

/* ============ 经验与建议（付费） ============ */

const ADVICE_TITLES: Record<AdviceKind, string> = {
  decision: "转型前，先做一次低成本验证",
  ability: "把旧能力翻译成新岗位的优势",
  interview: "让面试官看见真实的行动证据",
};

export function AdvicePanel({
  detail,
  unlocked,
  onOpenPaywall,
}: {
  detail: TravelerDetail | null;
  unlocked: boolean;
  onOpenPaywall: () => void;
}) {
  const [kind, setKind] = useState<AdviceKind>("decision");
  const tips = detail ? adviceTips(detail.advice, kind) : [];
  return (
    <div className="flex flex-col gap-[15px]">
      <SectionHeader title="把踩过的坑留给后来人" trailing={unlocked ? "全部可见" : "解锁后可见"} />
      <div className="flex flex-wrap gap-[7px]">
        {ADVICE_KINDS.map((a) => (
          <Chip key={a.kind} selected={kind === a.kind} onClick={() => setKind(a.kind)}>
            {a.label}
          </Chip>
        ))}
      </div>

      {unlocked ? (
        <Card elevation="flat" className="flex flex-col p-[19px]">
          <span className="text-micro tracking-[2px] text-brand">
            {ADVICE_KINDS.find((a) => a.kind === kind)?.label}
          </span>
          <h4 className="mt-2 text-lead font-semibold leading-[1.4] text-ink">
            {ADVICE_TITLES[kind]}
          </h4>
          <div className="mt-3.5 flex flex-col gap-2.5">
            {tips.map((tip, i) => (
              <div key={i} className="flex items-start gap-2.5">
                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-[7px] bg-teal/12 text-micro text-teal">
                  {i + 1}
                </span>
                <p className="text-footnote leading-[1.6] text-[#C9CFDC]">{tip}</p>
              </div>
            ))}
            {tips.length === 0 && <p className="text-footnote text-faint">暂无该类建议。</p>}
          </div>
        </Card>
      ) : (
        <LockedBlock
          title="解锁 TA 的踩坑建议"
          hint="转型决策 · 能力迁移 · 求职面试 全部可见"
          onClick={onOpenPaywall}
        />
      )}
    </div>
  );
}

/* ============ 可提供服务 ============ */

const SERVICE_STEPS: [string, string][] = [
  ["确认目标与边界", "先说明你的处境，双方确认服务适合再开始"],
  ["正式沟通 / 交付", "按约定形式进行咨询、交付资料或开始陪跑"],
  ["追问与复盘", "结束后保留一次追问，沉淀可执行的下一步"],
];

export function ServicePanel({
  services,
  onCheckout,
}: {
  services: TravelerServiceItem[];
  onCheckout: (service: TravelerServiceItem) => void;
}) {
  return (
    <div className="flex flex-col gap-3">
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        {services.map((service) => (
          <ServiceCard key={service.id} service={service} onClick={() => onCheckout(service)} />
        ))}
      </div>
      <Card elevation="flat" className="mt-1.5 flex flex-col p-[18px]">
        {SERVICE_STEPS.map(([title, sub], i) => (
          <div key={i}>
            <div className="flex items-start gap-3 py-2.5">
              <span className="flex h-[22px] w-[22px] shrink-0 items-center justify-center rounded-full bg-brand/13 text-micro text-brand">
                {i + 1}
              </span>
              <div className="flex flex-col gap-0.5">
                <span className="text-footnote font-medium text-ink">{title}</span>
                <span className="text-caption text-faint">{sub}</span>
              </div>
            </div>
            {i < SERVICE_STEPS.length - 1 && <div className="h-px bg-line" />}
          </div>
        ))}
      </Card>
    </div>
  );
}

function serviceAccent(kind: string): { bg: string; border: string } {
  switch (kind) {
    case "materials":
      return {
        bg: "linear-gradient(135deg,#172820 0%,#101A17 100%)",
        border: "rgba(62,217,164,0.28)",
      };
    case "companion":
      return {
        bg: "linear-gradient(135deg,#2B1B2D 0%,#17121F 100%)",
        border: "rgba(227,92,193,0.28)",
      };
    default:
      return {
        bg: "linear-gradient(135deg,#151C34 0%,#111327 100%)",
        border: "rgba(111,165,255,0.28)",
      };
  }
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

function serviceCtaLabel(kind: string): string {
  switch (kind) {
    case "materials":
      return "购买资料包";
    case "companion":
      return "申请陪跑";
    default:
      return "向 TA 咨询";
  }
}

function ServiceCard({
  service,
  onClick,
}: {
  service: TravelerServiceItem;
  onClick: () => void;
}) {
  const accent = serviceAccent(service.kind);
  return (
    <div
      className="flex flex-col gap-3 rounded-card border p-[21px]"
      style={{ background: accent.bg, borderColor: accent.border }}
    >
      <div className="flex items-end justify-between gap-2">
        <div className="flex flex-col gap-1.5">
          <span className="text-micro tracking-[2.5px] text-brand-lite">
            {serviceKindLabel(service.kind)}
          </span>
          <span className="text-subtitle font-semibold text-ink">{service.title}</span>
        </div>
        <span className="shrink-0 text-white">
          <span className="text-[25px] font-bold">¥{service.price}</span>
          <span className="text-caption text-sub"> / {service.unit}</span>
        </span>
      </div>
      <p className="text-footnote leading-[1.6] text-sub">{service.description}</p>
      {service.tags.length > 0 && (
        <div className="flex flex-wrap gap-[7px]">
          {service.tags.map((tag) => (
            <span
              key={tag}
              className="rounded-chip bg-white/[0.055] px-2.5 py-[7px] text-caption text-[#C8CEDD]"
            >
              {tag}
            </span>
          ))}
        </div>
      )}
      <Button size="lg" className="mt-1 w-full" onClick={onClick}>
        {serviceCtaLabel(service.kind)}
      </Button>
    </div>
  );
}
