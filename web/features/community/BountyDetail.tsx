"use client";
/* 悬赏详情（全屏页）—— 移植 iOS BountyDetailView。
   标签 / 标题 / 发布者 / 杏色悬赏卡 / 问题详情 / 亲历者回应 / 发送名片。
   get_bounty 拉取权威帖子 + 回应；失败回落列表数据与本地演示详情。
   回应名片是关键动作：游客先经 useAuthGate().require 登录。 */

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { BackButton } from "@/features/card-game/ui";
import { TravelerAvatar } from "@/components/ui/Avatar";
import { TagPill } from "@/components/ui/Basics";
import { useToast } from "@/components/ui/Toast";
import { useAuthGate } from "@/components/auth/AuthGate";
import { callFunction } from "@/lib/supabase";
import { mockAvatarByText } from "@/lib/theme";
import { useData } from "@/stores/data";
import { useMyProfile } from "@/stores/my-profile";
import { demoBountyDetail } from "@/lib/demo-data";
import { bountyDisplayAmount, type BountyDetailResponse } from "@/lib/models";

const SENT_KEY = "kaleido_bounty_sent_v1";

function loadSentIds(): number[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(SENT_KEY);
    const parsed = raw ? (JSON.parse(raw) as unknown) : [];
    return Array.isArray(parsed) ? parsed.filter((n): n is number => typeof n === "number") : [];
  } catch {
    return [];
  }
}

function markSent(id: number) {
  if (typeof window === "undefined") return;
  const ids = new Set(loadSentIds());
  ids.add(id);
  window.localStorage.setItem(SENT_KEY, JSON.stringify([...ids]));
}

/** ISO 时间戳 → 本地 YYYY-MM-DD（无效返回 null） */
function dayString(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) return null;
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** user_id → 「旅人 #XXXX」 */
function anonymousName(userId: string): string {
  return `旅人 #${userId.slice(0, 4).toUpperCase()}`;
}

export function BountyDetail({ bountyId }: { bountyId: number }) {
  const router = useRouter();
  const show = useToast((s) => s.show);
  const { require } = useAuthGate();
  const bounties = useData((s) => s.bounties);
  const listBounty = bounties.find((b) => b.id === bountyId) ?? null;

  const [remote, setRemote] = useState<BountyDetailResponse | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [sent, setSent] = useState(false);
  const [showModal, setShowModal] = useState(false);

  const demo = useMemo(() => demoBountyDetail(bountyId), [bountyId]);

  useEffect(() => {
    setSent(loadSentIds().includes(bountyId));
  }, [bountyId]);

  const reload = async () => {
    try {
      const res = await callFunction<BountyDetailResponse>("community", {
        action: "get_bounty",
        bounty_id: bountyId,
      });
      setRemote(res);
    } catch {
      setRemote(null);
    } finally {
      setLoaded(true);
    }
  };

  useEffect(() => {
    void reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bountyId]);

  /** 远端成功 → 真实数据；否则回落列表 + 本地演示详情 */
  const usesDemo = loaded && !remote;

  const tags = remote?.bounty.tags?.length
    ? remote.bounty.tags
    : listBounty?.tags?.length
      ? listBounty.tags
      : usesDemo
        ? demo.tags
        : [];
  const question = remote?.bounty.question ?? listBounty?.question ?? "这条悬赏正在加载…";
  const detailText =
    (remote?.bounty.detail && remote.bounty.detail) ||
    (listBounty?.detail && listBounty.detail) ||
    (usesDemo ? demo.detail : "详情暂未填写。");
  const rewardText = remote?.bounty.reward ?? listBounty?.reward ?? "";
  const statusRaw = remote?.bounty.status ?? listBounty?.status ?? null;
  const statusText = statusRaw ? (statusRaw === "closed" ? "已结束" : "征集中") : usesDemo ? demo.goal : "征集中";

  const responseCount = usesDemo
    ? `${demo.replies.length} 人回应`
    : remote
      ? `${remote.responses.length} 人回应`
      : loaded
        ? "回应加载失败"
        : "回应加载中";

  const publisherName = usesDemo ? demo.asker : "匿名旅人";
  const publisherMeta = usesDemo
    ? `${demo.city} · ${demo.time}发布`
    : (() => {
        const day = dayString(remote?.bounty.created_at ?? listBounty?.created_at);
        return day ? `${day} 发布` : "已发布";
      })();

  const onSend = () => {
    if (sent) {
      show("你的名片已经发送");
      return;
    }
    require(() => setShowModal(true));
  };

  return (
    <div className="min-h-dvh screen-bg md:min-h-[calc(100dvh-var(--nav-h))]">
      {/* 顶栏 */}
      <div className="sticky top-0 z-20 border-b border-line bg-paper/80 backdrop-blur md:top-[var(--nav-h)]">
        <div className="mx-auto flex w-full max-w-measure items-center gap-3 px-5 py-3">
          <BackButton onClick={() => router.back()} />
          <div className="min-w-0 flex-1">
            <div className="text-[16px] font-bold tracking-[0.5px] text-ink">悬赏详情</div>
            <div className="text-[10.5px] text-faint">
              {statusText} · {responseCount}
            </div>
          </div>
        </div>
      </div>

      <div className="mx-auto flex w-full max-w-measure flex-col gap-4 px-5 pb-28 pt-4">
        {tags.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {tags.map((tag) => (
              <TagPill key={tag} text={tag} />
            ))}
          </div>
        )}

        <h1 className="text-[21px] font-bold leading-[1.5] text-ink">{question}</h1>

        {/* 发布者 */}
        <div className="flex items-center gap-[11px]">
          <TravelerAvatar
            initial={publisherName.slice(0, 1)}
            hueIndex={bountyId % 5}
            size={40}
            imageSrc={mockAvatarByText(publisherName)}
          />
          <div className="flex flex-col gap-0.5">
            <span className="text-[13px] font-semibold text-ink">{publisherName}</span>
            <span className="text-[11px] text-faint">{publisherMeta}</span>
          </div>
        </div>

        {/* 杏色悬赏卡 */}
        <div
          className="flex items-center justify-between rounded-[18px] px-[17px] py-[15px] shadow-[0_10px_20px_rgba(255,176,103,0.22)]"
          style={{
            background: "linear-gradient(135deg,#FFC98A 0%,#FFB067 55%,#F08E4E 100%)",
          }}
        >
          <div className="flex flex-col gap-0.5">
            <span className="text-[10.5px] text-[#2B1A08]/75">本帖悬赏</span>
            {usesDemo ? (
              <span className="text-[24px] font-extrabold text-[#2B1A08]">¥{demo.amount}</span>
            ) : (
              <span className="text-[17px] font-extrabold text-[#2B1A08]">
                {rewardText || bountyDisplayAmount({ id: bountyId, question, reward: rewardText, responses: "" })}
              </span>
            )}
          </div>
          <span className="text-[11.5px] font-medium text-[#2B1A08]/80">{statusText}</span>
        </div>

        {/* 问题详情 */}
        <div className="kaleido-card flex flex-col gap-2.5 p-4">
          <span className="text-[13.5px] font-bold text-ink">TA 想了解的具体情况</span>
          <p className="whitespace-pre-line text-[12.5px] leading-[1.7] text-sub">{detailText}</p>
        </div>

        {/* 亲历者回应 */}
        <div className="flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <span className="text-[13.5px] font-bold text-ink">亲历者回应</span>
            <span className="text-[11px] text-faint">{responseCount}</span>
          </div>
          <Replies
            usesDemo={usesDemo}
            loaded={loaded}
            remote={remote}
            demoReplies={demo.replies}
            bountyId={bountyId}
          />
        </div>

        {sent && (
          <div className="rounded-[13px] border border-[#3ED9A4]/30 bg-[#3ED9A4]/8 p-[13px] text-[11.5px] leading-[1.6] text-[#8EE7C8]">
            你的名片与补充说明已发送，发帖人可以查看你的经历并与你联系。
          </div>
        )}
      </div>

      {/* 底部动作栏 */}
      <div className="shell-fixed-x fixed bottom-0 z-20 border-t border-line bg-paper/90 backdrop-blur">
        <div className="mx-auto w-full max-w-measure px-5 py-3">
          <button
            onClick={onSend}
            disabled={sent}
            className={`w-full rounded-chip py-[15px] text-[14px] font-semibold text-white transition active:scale-[0.97] ${
              sent ? "bg-raised" : "bg-btn-g"
            }`}
          >
            {sent ? "名片已发送 ✓" : "发送我的名片"}
          </button>
        </div>
      </div>

      <AnimatePresence>
        {showModal && (
          <CardModal
            bountyId={bountyId}
            onClose={() => setShowModal(false)}
            onSent={() => {
              markSent(bountyId);
              setSent(true);
              setShowModal(false);
              show("名片已发送给发帖人");
              void reload();
            }}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

function Replies({
  usesDemo,
  loaded,
  remote,
  demoReplies,
  bountyId,
}: {
  usesDemo: boolean;
  loaded: boolean;
  remote: BountyDetailResponse | null;
  demoReplies: { name: string; role: string; text: string }[];
  bountyId: number;
}) {
  if (remote) {
    if (remote.responses.length === 0) {
      return <EmptyReplies />;
    }
    return (
      <>
        {remote.responses.map((r, i) => (
          <ReplyRow
            key={r.id}
            name={anonymousName(r.user_id)}
            role={dayString(r.created_at) ?? "亲历者"}
            text={r.message}
            hueIndex={(bountyId + i + 2) % 5}
          />
        ))}
      </>
    );
  }
  if (usesDemo) {
    if (demoReplies.length === 0) return <EmptyReplies />;
    return (
      <>
        {demoReplies.map((r, i) => (
          <ReplyRow key={i} name={r.name} role={r.role} text={r.text} hueIndex={(bountyId + i + 2) % 5} />
        ))}
      </>
    );
  }
  return (
    <div className="rounded-[14px] bg-raised p-[13px] text-[12px] text-faint">
      {loaded ? "回应暂时加载失败，请稍后再试。" : "正在加载回应…"}
    </div>
  );
}

function EmptyReplies() {
  return (
    <div className="rounded-[14px] bg-raised p-[13px] text-[12px] text-faint">
      还没有旅人回应，成为第一个分享经历的人吧。
    </div>
  );
}

function ReplyRow({
  name,
  role,
  text,
  hueIndex,
}: {
  name: string;
  role: string;
  text: string;
  hueIndex: number;
}) {
  return (
    <div className="flex items-start gap-[11px] rounded-[14px] bg-raised p-[13px]">
      <TravelerAvatar initial={name.slice(0, 1)} hueIndex={hueIndex} size={34} imageSrc={mockAvatarByText(name)} />
      <div className="flex flex-col gap-1">
        <div className="flex items-center gap-2">
          <span className="text-[12.5px] font-semibold text-ink">{name}</span>
          <span className="text-[10px] text-brand">{role}</span>
        </div>
        <p className="text-[12px] leading-[1.6] text-sub">{text}</p>
      </div>
    </div>
  );
}

/* 发送名片弹层 */
function CardModal({
  bountyId,
  onClose,
  onSent,
}: {
  bountyId: number;
  onClose: () => void;
  onSent: () => void;
}) {
  const show = useToast((s) => s.show);
  const profile = useMyProfile((s) => s.profile);
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);

  const confirm = async () => {
    if (sending) return;
    setSending(true);
    const trimmed = message.trim();
    const payload = (trimmed || `我是${profile.name}：${profile.bio}`).slice(0, 500);
    try {
      await callFunction<{ ok: boolean }>("community", {
        action: "respond_bounty",
        bounty_id: bountyId,
        message: payload,
      });
      onSent();
    } catch {
      onClose();
      show("发送失败，请稍后重试");
    } finally {
      setSending(false);
    }
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
        className="relative max-h-[88dvh] w-full max-w-[520px] overflow-y-auto no-scrollbar rounded-t-sheet border border-line bg-[#10131C] px-[22px] pb-8 pt-6 md:rounded-sheet"
      >
        <div className="mx-auto mb-4 h-1 w-10 rounded-chip bg-white/20 md:hidden" />
        <div className="flex flex-col gap-3.5">
          <h2 className="text-[17px] font-bold text-ink">发送我的名片</h2>

          <div className="flex flex-col gap-2.5 rounded-[16px] border border-line bg-card p-3.5">
            <div className="flex items-center gap-[11px]">
              <TravelerAvatar initial={profile.name.slice(0, 1)} hueIndex={profile.hue} size={42} />
              <div className="flex flex-col gap-0.5">
                <span className="text-[14px] font-bold text-ink">{profile.name}</span>
                <span className="text-[11.5px] text-sub">{profile.bio}</span>
              </div>
            </div>
            {profile.tags.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {profile.tags.map((tag) => (
                  <TagPill key={tag} text={tag} />
                ))}
              </div>
            )}
          </div>

          <span className="text-[11.5px] text-sub">补充一句话，让对方知道你为什么能回答</span>
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            rows={4}
            placeholder="例如：我去年完成了相似转型，可以分享第一份工作的准备过程。"
            className="w-full resize-none rounded-[13px] border border-line bg-raised px-3 py-3 text-[12.5px] text-ink placeholder:text-faint focus:border-[#5E96FF]/50 focus:outline-none"
          />
          <p className="text-[10.5px] leading-[1.6] text-faint">
            发送后，你的回应会和公开画像一起展示在这条悬赏下，所有旅人可见；请不要在补充说明中留下联系方式。
          </p>

          <button
            onClick={confirm}
            disabled={sending}
            className={`w-full rounded-chip py-[14px] text-[14px] font-semibold text-white transition active:scale-[0.97] ${
              sending ? "bg-raised" : "bg-btn-g"
            }`}
          >
            {sending ? "发送中…" : "确认发送名片"}
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}
