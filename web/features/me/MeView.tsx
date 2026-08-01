"use client";
/* 我的公开主页 —— 移植 iOS MeView.swift（原型 #scr-me · renderMyProfile）。
   hero（头像 / 徽章 / 转型条 / 标签 / 编辑）→ 4 tab：动态画像 / 我的故事 / 经验与建议 / 提供服务，
   末尾账号区（登录邮箱 / 退出 / 注销）。冷启动无会话由 AuthWall 拦下，此页必然已登录。 */

import { useCallback, useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { PageShell } from "@/components/shell/PageShell";
import { Badge } from "@/components/ui/badge";
import { PageHeader, SectionHeader } from "@/components/ui/page-header";
import { TravelerAvatar } from "@/components/ui/Avatar";
import { useToast } from "@/components/ui/Toast";
import { useAuth } from "@/stores/auth";
import { useData } from "@/stores/data";
import { useMyProfile } from "@/stores/my-profile";
import { useAuthGate } from "@/components/auth/AuthGate";
import { hue } from "@/lib/theme";
import type { TrajectoryNode } from "@/lib/models";
import { useHome } from "@/features/home/store";
import { buildPersonaModel } from "@/features/home/persona";
import { PersonaCanvas } from "@/features/home/PersonaCanvas";
import { MeEditView, type MeEditMode } from "./MeEditView";
import { ProfilePrivacyView } from "./ProfilePrivacyView";

/* 动态画像单项（对齐 iOS MyProfileStore.PersonaItem） */
export interface PersonaItem {
  key: string;
  label: string;
  value: string;
  glyph: string;
  /** 图标底色 hex */
  tint: string;
  /** 人生底牌卡（仅 life） */
  cards?: { glyph: string; name: string }[];
}

function hasResult(value: string): boolean {
  return (
    value.length > 0 &&
    !value.includes("尚未") &&
    !value.includes("待探索") &&
    !value.includes("未生成")
  );
}

/** 稳定的空回退，避免 zustand 选择器每次产出新引用 */
const NO_FACTS: NonNullable<ReturnType<typeof useData.getState>["profile"]>["facts"] = [];

const TAB_ITEMS: { key: string; label: string }[] = [
  { key: "persona", label: "动态画像" },
  { key: "story", label: "我的故事" },
  { key: "advice", label: "经验与建议" },
  { key: "service", label: "提供服务" },
];

export function MeView() {
  const showToast = useToast((s) => s.show);
  const profile = useMyProfile((s) => s.profile);
  const { require: requireAuth, isAuthenticated } = useAuthGate();
  const email = useAuth((s) => s.email);
  const signOut = useAuth((s) => s.signOut);
  const deleteAccount = useAuth((s) => s.deleteAccount);
  const sendVerificationEmail = useAuth((s) => s.sendVerificationEmail);

  /* 画像数据来源：与「认识你自己」同一份本地维度 + 云端底牌 */
  const loadPortrait = useHome((s) => s.loadPortrait);
  /* 选择器里写 `?? []` 会每次返回新数组引用，useSyncExternalStore 判定快照未缓存
     并抛 "getSnapshot should be cached"，进而无限重渲染。回退值必须是稳定常量。 */
  const profileFacts = useData((s) => s.profile?.facts) ?? NO_FACTS;

  const [tab, setTab] = useState("persona");
  const [editMode, setEditMode] = useState<MeEditMode | null>(null);
  const [confirm, setConfirm] = useState<null | "signout" | "delete">(null);
  const [accountBusy, setAccountBusy] = useState(false);
  const [privacyOpen, setPrivacyOpen] = useState(false);
  const [resendBusy, setResendBusy] = useState(false);

  /* 补发邮箱验证链接。sendVerificationEmail 自己吞异常并回布尔，这里只管把结果说清楚 */
  const resendVerification = useCallback(async () => {
    if (resendBusy || !email) return;
    setResendBusy(true);
    const ok = await sendVerificationEmail(email);
    setResendBusy(false);
    showToast(ok ? `验证链接已重新发送至 ${email}` : "发送失败，请稍后再试");
  }, [resendBusy, email, sendVerificationEmail, showToast]);

  /* 挂载：加载画像和公开主页资料。 */
  useEffect(() => {
    void loadPortrait();
  }, [loadPortrait]);

  useEffect(() => {
    if (!isAuthenticated) return;
    void (async () => {
      const remote = await useData.getState().loadProfile();
      const pub = remote?.public_profile;
      if (pub) {
        useMyProfile.getState().applyRemote(pub);
      }
    })();
  }, [isAuthenticated]);

  const publicValues = useMemo(() => {
    const grouped: Record<string, string[]> = {};
    for (const fact of profileFacts) {
      if (fact.visibility !== "public") continue;
      (grouped[fact.dimension] ??= []).push(fact.value);
    }
    return grouped;
  }, [profileFacts]);

  const lifeCards = useMemo(
    () => (publicValues.life ?? []).slice(0, 3).map((name) => ({ glyph: "◆", name })),
    [publicValues],
  );

  /* 本页只展示明确标记为 public 的事实。 */
  const allPersonaItems = useMemo<PersonaItem[]>(() => {
    const value = (dimension: string, fallback = "尚未公开") =>
      publicValues[dimension]?.join(" · ") || fallback;
    return [
      { key: "personality", label: "人格底色", value: value("personality"), glyph: "◎", tint: "#5968D9" },
      { key: "skill", label: "我擅长", value: value("skill"), glyph: "✦", tint: "#5E96FF" },
      { key: "like", label: "我喜欢", value: value("like"), glyph: "♡", tint: "#E35CC1" },
      { key: "love", label: "我在恋爱关系中在意", value: value("love"), glyph: "✿", tint: "#FF7A4D" },
      { key: "family", label: "我在家庭关系中在意", value: value("family"), glyph: "⌂", tint: "#3ED9A4" },
      { key: "social", label: "我在人际交往中在意", value: value("social"), glyph: "◎", tint: "#5E96FF" },
      {
        key: "life",
        label: "我的人生底牌",
        value: value("life"),
        glyph: "◇",
        tint: "#8F7BFF",
        cards: lifeCards,
      },
    ];
  }, [publicValues, lifeCards]);

  const visibleItems = allPersonaItems.filter((it) => hasResult(it.value));

  /* 公开画像驱动的数字形象（仅由公开项生成，对齐 iOS MeView.personaModel） */
  const personaModel = useMemo(() => {
    const values = visibleItems.filter((it) => it.key !== "life").map((it) => it.value);
    const signature = visibleItems.find((it) => it.key === "life")?.cards?.map((c) => c.name) ?? [];
    return buildPersonaModel(values, signature);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allPersonaItems]);

  /* 编辑公开主页是关键动作：会话过期时先补登录，成功后继续打开编辑页 */
  const requestEdit = (mode: MeEditMode) => requireAuth(() => setEditMode(mode));

  const doSignOut = async () => {
    if (accountBusy) return;
    setAccountBusy(true);
    setConfirm(null);
    await signOut();
    setAccountBusy(false);
    showToast("已退出登录");
  };

  const doDelete = async () => {
    if (accountBusy) return;
    setAccountBusy(true);
    setConfirm(null);
    try {
      await deleteAccount();
      showToast("账号已注销");
    } catch {
      showToast("注销失败，请稍后重试");
    }
    setAccountBusy(false);
  };

  const yearsNumber = (() => {
    const digits = profile.meta.years.replace(/\D/g, "");
    return (digits || String(profile.traj.length)) + " 年";
  })();

  return (
    <>
      {/* 桌面分栏：名片钉在左轨常驻，右侧翻 tab 时身份信息始终在场 */}
      <PageShell
        header={
          <PageHeader
            eyebrow="MY PUBLIC PAGE"
            title="我的主页"
            description="别人点开你的万花筒名片时看到的样子。"
          />
        }
        railSide="start"
        rail={
            <div className="kaleido-card flex flex-col gap-3 p-[18px] xl:p-6">
              <div className="flex items-center gap-3.5">
                <div className="relative shrink-0 rounded-full p-[3px]" style={{ background: hue(profile.hue).gradient }}>
                  <TravelerAvatar initial={profile.name.slice(0, 1)} hueIndex={profile.hue} size={62} />
                </div>
                <div className="flex min-w-0 flex-col gap-1.5">
                  <div className="flex items-center gap-2">
                    <span className="text-[21px] font-bold text-ink">{profile.name}</span>
                    <Badge tone="teal" size="sm" className="font-semibold">
                      我的公开主页
                    </Badge>
                  </div>
                  <span className="text-footnote text-sub">
                    {profile.meta.age} 岁 · {profile.meta.city}
                  </span>
                </div>
                <button
                  onClick={() => requestEdit("basic")}
                  aria-label="编辑个人资料"
                  className="ml-auto flex h-[34px] w-[34px] shrink-0 items-center justify-center rounded-full border border-line bg-raised text-callout text-ink transition active:scale-95"
                >
                  ✎
                </button>
              </div>

              {/* 转型条 */}
              <div className="inline-flex w-fit items-center gap-2.5 rounded-chip border border-brand/28 bg-brand/[0.09] px-3.5 py-[9px] text-body font-semibold">
                <span className="text-sub">{profile.meta.from}</span>
                <span className="text-brand">→</span>
                <span className="text-ink">{profile.meta.to}</span>
              </div>

              <span className="text-caption text-faint">
                {profile.meta.years} · {profile.meta.result}
              </span>

              <div className="flex flex-wrap gap-[7px]">
                {profile.tags.map((t) => (
                  <Badge key={t}>{t}</Badge>
                ))}
              </div>
            </div>
          }
        >
            {/* Tabs */}
            <div className="flex gap-[7px]">
              {TAB_ITEMS.map(({ key, label }) => {
                const on = tab === key;
                return (
                  <button
                    key={key}
                    onClick={() => setTab(key)}
                    className={`flex-1 rounded-chip border py-[9px] text-footnote transition active:scale-[0.97] ${
                      on
                        ? "bg-btn-g border-brand-bright/60 font-semibold text-white"
                        : "border-line bg-raised text-sub"
                    }`}
                  >
                    {label}
                  </button>
                );
              })}
            </div>

            {/* Panel */}
            <div className="mt-4">
              {tab === "story" ? (
                <StoryPanel profile={profile} yearsNumber={yearsNumber} onEdit={() => requestEdit("story")} />
              ) : tab === "advice" ? (
                <AdvicePanel modules={profile.adviceModules} onEdit={() => requestEdit("advice")} />
              ) : tab === "service" ? (
                <ServicePanel services={profile.services} onEdit={() => requestEdit("service")} />
              ) : (
                <PersonaPanel
                  model={personaModel}
                  items={visibleItems}
                  totalCount={allPersonaItems.length}
                  lifeCards={lifeCards}
                  onEdit={() => setPrivacyOpen(true)}
                />
              )}
            </div>

            {/* 账号区 */}
            <div className="mt-6 flex flex-col gap-3">
              <SectionHeader title="账号" />
              <div className="kaleido-card flex flex-col">
                <div className="flex items-center justify-between gap-3 px-4 py-3.5">
                  <span className="shrink-0 text-body text-sub">登录邮箱</span>
                  <span className="truncate text-body font-semibold text-teal-lite">
                    {email ?? "已登录"}
                  </span>
                </div>
                <div className="h-px bg-line" />
                <AccountRow
                  title="个人档案与 AI 隐私"
                  tint="text-brand"
                  busy={accountBusy}
                  onClick={() => setPrivacyOpen(true)}
                />
                <div className="h-px bg-line" />
                {/* 邮箱验证不拦登录，所以这里是「补发」而非「去验证」：注册时那封漏收了可再来一次 */}
                <AccountRow
                  title="重发邮箱验证链接"
                  tint="text-sub"
                  busy={accountBusy || resendBusy}
                  onClick={resendVerification}
                />
                <div className="h-px bg-line" />

                <AccountRow title="退出登录" tint="text-sub" busy={accountBusy} onClick={() => setConfirm("signout")} />
                <div className="h-px bg-line" />
                <AccountRow title="注销账号" tint="text-orange" busy={accountBusy} onClick={() => setConfirm("delete")} />
              </div>
            </div>
      </PageShell>

      {/* 编辑浮层 */}
      <MeEditView mode={editMode} onClose={() => setEditMode(null)} />
      <ProfilePrivacyView open={privacyOpen} onClose={() => setPrivacyOpen(false)} />

      {/* 二次确认 */}
      <ConfirmDialog
        open={confirm !== null}
        title={confirm === "delete" ? "永久注销账号" : "退出登录"}
        message={
          confirm === "delete"
            ? "注销后账号与全部数据将被永久删除，且无法恢复。"
            : "退出后需要重新登录才能继续使用，账号数据不受影响。"
        }
        confirmLabel={confirm === "delete" ? "永久删除我的账号" : "退出登录"}
        destructive={confirm === "delete"}
        onCancel={() => setConfirm(null)}
        onConfirm={confirm === "delete" ? doDelete : doSignOut}
      />
    </>
  );
}

/* ============ 账号行 ============ */

function AccountRow({
  title,
  tint,
  busy,
  onClick,
}: {
  title: string;
  tint: string;
  busy: boolean;
  onClick: () => void;
}) {
  return (
    <button
      disabled={busy}
      onClick={onClick}
      className="flex items-center justify-between px-4 py-3.5 text-left transition active:scale-[0.99] disabled:opacity-60"
    >
      <span className={`text-body font-semibold ${tint}`}>{title}</span>
      <span className="text-lead text-faint">›</span>
    </button>
  );
}

/* ============ 动态画像 Panel ============ */

function PersonaPanel({
  model,
  items,
  totalCount,
  lifeCards,
  onEdit,
}: {
  model: ReturnType<typeof buildPersonaModel>;
  items: PersonaItem[];
  totalCount: number;
  lifeCards: { glyph: string; name: string }[];
  onEdit: () => void;
}) {
  const lifeVisible = items.some((it) => it.key === "life") && lifeCards.length > 0;
  return (
    <div className="flex flex-col gap-3">
      <SectionHeader title="我的动态画像" trailing="设置展示" isLink onTrailing={onEdit} />
      <div className="kaleido-card flex flex-col gap-3.5 p-3.5">
        {/* 数字形象画布 */}
        <div className="relative h-[200px] overflow-hidden rounded-tile border border-brand-lite/12">
          <div
            className="absolute inset-0"
            style={{
              background:
                "radial-gradient(170px circle at 50% 48%, rgba(83,115,255,0.22), transparent), linear-gradient(135deg,#080C1A,#10162B,#080B16)",
            }}
          />
          <PersonaCanvas model={model} />
          <div className="absolute left-3.5 top-3.5 rounded-chip border border-brand-lite/18 bg-[#070B18]/54 px-[9px] py-[5px] text-micro font-semibold tracking-[1.8px] text-[#DCE8FF]">
            SYNCED LIVE FORM
          </div>
        </div>

        {/* 人生底牌 */}
        {lifeVisible && (
          <div className="flex flex-col gap-2.5 rounded-tile bg-raised p-3">
            <div className="flex items-center justify-between">
              <span className="text-footnote font-semibold text-ink">我的人生底牌</span>
              <span className="text-micro text-faint">已参与数字形象生成</span>
            </div>
            <div className="flex gap-2">
              {lifeCards.map((c) => (
                <div
                  key={c.name}
                  className="flex flex-1 items-center justify-center gap-1.5 rounded-field py-2.5 text-white"
                  style={{ background: hue(0).gradient }}
                >
                  <span className="text-footnote">{c.glyph}</span>
                  <span className="truncate text-caption font-medium">{c.name}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {items.length === 0 ? (
          <div className="rounded-tile bg-raised py-7 text-center text-footnote text-faint">
            目前没有开启公开展示的画像内容
          </div>
        ) : (
          <>
            <div className="flex items-center gap-2.5">
              <div className="h-[5px] flex-1 overflow-hidden rounded-chip bg-raised">
                <div
                  className="h-full rounded-chip bg-aurora"
                  style={{ width: `${(items.length / Math.max(totalCount, 1)) * 100}%` }}
                />
              </div>
              <span className="text-caption text-sub">
                {items.length}/{totalCount} 已公开
              </span>
            </div>

            <div className="flex flex-col gap-2.5">
              {items
                .filter((it) => it.key !== "life" || (it.cards?.length ?? 0) === 0)
                .map((it) => (
                  <div key={it.key} className="flex items-center gap-3 rounded-tile bg-raised px-3 py-2.5">
                    <span
                      className="flex h-8 w-8 shrink-0 items-center justify-center rounded-field text-callout"
                      style={{ background: `${it.tint}26` }}
                    >
                      {it.glyph}
                    </span>
                    <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                      <span className="text-body font-semibold text-ink">{it.label}</span>
                      <span className="truncate text-caption text-sub">{it.value}</span>
                    </div>
                    <span className={`text-micro ${hasResult(it.value) ? "text-teal-lite" : "text-faint"}`}>
                      {hasResult(it.value) ? "已公开" : "待完善"}
                    </span>
                  </div>
                ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

/* ============ 我的故事 Panel ============ */

function StoryPanel({
  profile,
  yearsNumber,
  onEdit,
}: {
  profile: ReturnType<typeof useMyProfile.getState>["profile"];
  yearsNumber: string;
  onEdit: () => void;
}) {
  return (
    <div className="flex flex-col gap-3.5">
      <SectionHeader title="我的人生关键轨迹" trailing="编辑故事" isLink onTrailing={onEdit} />
      <MeTimeline nodes={profile.traj} />

      <div className="rounded-tile border border-brand/24 bg-brand/[0.08] p-4 text-callout font-medium italic leading-relaxed text-brand-lite">
        “{profile.quote}”
      </div>

      <div className="kaleido-card flex flex-col gap-2.5 p-4">
        <span className="text-callout font-bold text-ink">我的转型故事</span>
        <p className="whitespace-pre-wrap text-footnote leading-relaxed text-sub">{profile.meta.intro}</p>
      </div>

      <div className="flex gap-2.5">
        <StoryFact value={yearsNumber} label="真实实践" />
        <StoryFact value={String(profile.traj.length)} label="关键节点" />
        <StoryFact value={String(profile.meta.consulted)} label="已帮助人数" />
      </div>

      <div className="kaleido-card flex flex-col gap-2.5 p-4">
        <span className="text-body font-bold text-ink">完整故事 · 最难的一关</span>
        <p className="whitespace-pre-wrap text-footnote leading-relaxed text-sub">{profile.meta.full}</p>
      </div>
    </div>
  );
}

function StoryFact({ value, label }: { value: string; label: string }) {
  return (
    <div className="flex flex-1 flex-col items-center gap-1 rounded-tile border border-line bg-card py-3.5">
      <span className="text-aurora text-subtitle font-bold">{value}</span>
      <span className="text-micro text-faint">{label}</span>
    </div>
  );
}

/* 时间轴（原型 .prof-timeline，可展开节点） */
function MeTimeline({ nodes }: { nodes: TrajectoryNode[] }) {
  const [openIndex, setOpenIndex] = useState(0);
  return (
    <div className="flex flex-col">
      {nodes.map((node, idx) => (
        <div key={idx} className="flex items-stretch">
          <div className="flex w-[15px] flex-col items-center pt-4">
            <span className="h-[15px] w-[15px] shrink-0 rounded-full border-[3px] border-[#0B0E17] bg-brand-deep" />
            {idx !== nodes.length - 1 && (
              <span
                className="w-px flex-1"
                style={{ background: "linear-gradient(to bottom, #8F7BFF, rgba(143,123,255,0.08))" }}
              />
            )}
          </div>
          <button
            onClick={() => setOpenIndex((cur) => (cur === idx ? -1 : idx))}
            className="mb-3 ml-3.5 flex-1 rounded-tile border border-line bg-card p-3.5 text-left"
          >
            <div className="flex items-start justify-between">
              <div className="flex flex-col gap-0.5">
                <span className="text-caption font-semibold text-brand">{node.age}</span>
                <span className="text-callout font-semibold text-ink">{node.t}</span>
              </div>
              <span className={`text-lead text-faint transition ${openIndex === idx ? "rotate-90" : ""}`}>›</span>
            </div>
            {openIndex === idx && (
              <p className="mt-2.5 text-footnote leading-relaxed text-sub">{node.d}</p>
            )}
          </button>
        </div>
      ))}
    </div>
  );
}

/* ============ 经验与建议 Panel ============ */

function AdvicePanel({
  modules,
  onEdit,
}: {
  modules: ReturnType<typeof useMyProfile.getState>["profile"]["adviceModules"];
  onEdit: () => void;
}) {
  return (
    <div className="flex flex-col gap-3">
      <SectionHeader title="我愿意分享的经验" trailing="编辑建议" isLink onTrailing={onEdit} />
      {modules.length === 0 ? (
        <EmptyNote text="还没有公开经验模块，点击「编辑建议」添加第一条内容" />
      ) : (
        modules.map((m, index) => (
          <div key={m.id} className="kaleido-card flex flex-col gap-2.5 p-4">
            <span className="text-micro font-semibold tracking-[2px] text-brand-lite">
              经验 {String(index + 1).padStart(2, "0")}
            </span>
            <span className="text-callout font-bold text-ink">{m.title}</span>
            <p className="whitespace-pre-wrap text-footnote leading-relaxed text-sub">{m.content}</p>
            {m.links.length > 0 && (
              <div className="flex flex-wrap gap-[7px]">
                {m.links.map((link, i) => (
                  <a
                    key={i}
                    href={link.url || undefined}
                    target="_blank"
                    rel="noreferrer"
                    className="rounded-chip bg-brand/10 px-2.5 py-1 text-caption text-brand"
                  >
                    🔗 {link.label || "查看相关链接"}
                  </a>
                ))}
              </div>
            )}
          </div>
        ))
      )}
    </div>
  );
}

/* ============ 提供服务 Panel ============ */

function ServicePanel({
  services,
  onEdit,
}: {
  services: ReturnType<typeof useMyProfile.getState>["profile"]["services"];
  onEdit: () => void;
}) {
  const enabled = services.filter((s) => s.enabled);
  return (
    <div className="flex flex-col gap-3">
      <SectionHeader title="我可以提供的服务" trailing="编辑服务" isLink onTrailing={onEdit} />
      {enabled.length === 0 ? (
        <EmptyNote text="暂未公开服务，可以在这里编辑并开启" />
      ) : (
        enabled.map((s) => (
          <div key={s.id} className="kaleido-card flex flex-col gap-2.5 p-4">
            <div className="flex items-start justify-between">
              <div className="flex flex-col gap-1">
                <span className="text-micro tracking-[1.4px] text-brand-lite">{s.type}</span>
                <span className="text-lead font-bold text-ink">{s.title}</span>
              </div>
              <span className="text-aurora text-[19px] font-extrabold">¥{s.price}</span>
            </div>
            <p className="text-footnote leading-relaxed text-sub">{s.desc}</p>
          </div>
        ))
      )}
    </div>
  );
}

function EmptyNote({ text }: { text: string }) {
  return (
    <div className="rounded-tile border border-line bg-card py-7 text-center text-footnote text-faint">
      {text}
    </div>
  );
}

/* ============ 二次确认对话框 ============ */

function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel,
  destructive,
  onCancel,
  onConfirm,
}: {
  open: boolean;
  title: string;
  message: string;
  confirmLabel: string;
  destructive: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-[85] flex items-end justify-center md:items-center md:p-6">
          <motion.div
            className="absolute inset-0 bg-black/60"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onCancel}
          />
          <motion.div
            className="relative w-full rounded-t-sheet border border-line bg-[#10131C] p-6 shadow-[0_18px_50px_rgba(0,0,0,0.7)] md:w-[380px] md:rounded-sheet"
            initial={{ y: 48, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 48, opacity: 0 }}
            transition={{ type: "spring", stiffness: 380, damping: 34 }}
          >
            <h3 className="text-subtitle font-bold text-ink">{title}</h3>
            <p className="mt-2 text-footnote leading-relaxed text-sub">{message}</p>
            <div className="mt-5 flex flex-col gap-2.5">
              <button
                onClick={onConfirm}
                className={`w-full rounded-chip py-3 text-callout font-semibold text-white transition active:scale-[0.97] ${
                  destructive ? "bg-orange" : "bg-btn-g"
                }`}
              >
                {confirmLabel}
              </button>
              <button
                onClick={onCancel}
                className="w-full rounded-chip border border-line py-3 text-callout font-semibold text-sub transition active:scale-[0.97]"
              >
                取消
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
