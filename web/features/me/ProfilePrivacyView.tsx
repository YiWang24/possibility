"use client";

import { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { callFunction } from "@/lib/supabase";
import { useData } from "@/stores/data";
import { useHome } from "@/features/home/store";

type ProfileFact = {
  id: string;
  dimension: string;
  value: string;
  source: string;
  source_ref?: string | null;
  confidence: number;
  user_confirmed: boolean;
  visibility: "public" | "private";
  observed_at: string;
  updated_at: string;
};

type AccessReceipt = {
  id: number;
  purpose: string;
  dimensions: string[];
  dimension_count: number;
  fact_count: number;
  profile_revision: number;
  public_fact_count: number;
  private_fact_count: number;
  created_at: string;
};

type ProfileProposal = {
  id: string;
  dimension: string;
  value: string;
  source_type: string;
  confidence: number;
  sensitivity: string;
  created_at: string;
  expires_at: string;
};

type PrivacySnapshot = {
  profile_revision: number;
  portrait_pct: number;
  facts: ProfileFact[];
  proposals: ProfileProposal[];
  access_receipts: AccessReceipt[];
};

const DIMENSION_LABELS: Record<string, string> = {
  personality: "人格底色",
  skill: "我擅长",
  like: "我喜欢",
  love: "恋爱关系",
  family: "家庭关系",
  social: "人际交往",
  life: "人生底牌",
};

const SOURCE_LABELS: Record<string, string> = {
  manual: "本人填写",
  assessment: "测评结果",
  card_game: "卡牌选择",
  chat: "探索对话推断",
  diary: "日记推断",
  legacy: "历史资料",
};

const PURPOSE_LABELS: Record<string, string> = {
  persona: "动态 AI 形象",
  chat: "探索对话",
  match: "相似经历匹配",
  lab: "人生实验室",
  community: "社区与万花筒",
};

const DIMENSION_KEYS = Object.keys(DIMENSION_LABELS);

export function ProfilePrivacyView({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const [snapshot, setSnapshot] = useState<PrivacySnapshot | null>(null);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<
    null | { kind: "dimension"; dimension: string } | { kind: "clear" }
  >(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      setSnapshot(await callFunction<PrivacySnapshot>("profile-privacy", { action: "get" }));
    } catch {
      setError("暂时无法读取隐私设置，请稍后重试。");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (open) void load();
  }, [open]);

  const grouped = useMemo(() => {
    const result: Record<string, ProfileFact[]> = {};
    for (const fact of snapshot?.facts ?? []) {
      (result[fact.dimension] ??= []).push(fact);
    }
    return result;
  }, [snapshot]);

  const refreshProfileCaches = async () => {
    useData.getState().invalidateProfile();
    await useData.getState().loadProfile(true);
  };

  const confirmFact = async (fact: ProfileFact) => {
    if (!snapshot) return;
    setBusy(`fact:${fact.id}`);
    setError(null);
    try {
      await callFunction("profile-privacy", {
        action: "confirm_fact",
        fact_id: fact.id,
        profile_revision: snapshot.profile_revision,
      });
      await load();
      await refreshProfileCaches();
    } catch {
      setError("确认失败，画像可能已在其他设备更新，请刷新后重试。");
    } finally {
      setBusy(null);
    }
  };

  const reviewProposal = async (
    proposal: ProfileProposal,
    accept: boolean,
  ) => {
    if (!snapshot) return;
    setBusy(`proposal:${proposal.id}`);
    setError(null);
    try {
      await callFunction("profile-privacy", {
        action: "review_proposal",
        proposal_id: proposal.id,
        accept,
        profile_revision: snapshot.profile_revision,
      });
      await load();
      await refreshProfileCaches();
    } catch {
      setError("处理失败，画像可能已在其他设备更新，请刷新后重试。");
    } finally {
      setBusy(null);
    }
  };

  const setVisibility = async (fact: ProfileFact) => {
    if (!snapshot) return;
    setBusy(`visibility:${fact.id}`);
    setError(null);
    try {
      await callFunction("profile-privacy", {
        action: "set_visibility",
        fact_id: fact.id,
        visibility: fact.visibility === "public" ? "private" : "public",
        profile_revision: snapshot.profile_revision,
      });
      await load();
      await refreshProfileCaches();
    } catch {
      setError("修改失败，画像可能已在其他设备更新，请刷新后重试。");
    } finally {
      setBusy(null);
    }
  };

  const runConfirmedAction = async () => {
    if (!confirm || !snapshot) return;
    const current = confirm;
    setConfirm(null);
    setBusy(current.kind);
    setError(null);
    try {
      if (current.kind === "dimension") {
        await callFunction("profile-privacy", {
          action: "delete_dimension",
          dimension: current.dimension,
          profile_revision: snapshot.profile_revision,
        });
        window.localStorage.removeItem(`kaleido_dim_${current.dimension}`);
        useHome.setState((state) => {
          const next = { ...state.filledDims };
          delete next[current.dimension];
          return { filledDims: next };
        });
      } else {
        await callFunction("profile-privacy", {
          action: "clear_profile",
          profile_revision: snapshot.profile_revision,
        });
        for (const key of DIMENSION_KEYS) {
          window.localStorage.removeItem(`kaleido_dim_${key}`);
        }
        useHome.setState({ filledDims: {}, remotePersona: null });
      }
      await refreshProfileCaches();
      await load();
    } catch {
      setError("操作失败，画像可能已更新；请刷新后重试。");
    } finally {
      setBusy(null);
    }
  };

  const exportProfile = async () => {
    setBusy("export");
    setError(null);
    try {
      const payload = await callFunction<Record<string, unknown>>("profile-privacy", {
        action: "export",
      });
      const blob = new Blob([JSON.stringify(payload, null, 2)], {
        type: "application/json;charset=utf-8",
      });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `possibility-profile-${new Date().toISOString().slice(0, 10)}.json`;
      link.click();
      URL.revokeObjectURL(url);
    } catch {
      setError("导出失败，请稍后重试。");
    } finally {
      setBusy(null);
    }
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-[90] flex justify-center bg-black/70 backdrop-blur-sm"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <motion.div
            /* 原为 bg-page：主题里没有该 token，实际渲染成透明，面板一直靠父层蒙版凑合 */
            className="screen-bg flex h-full w-full max-w-measure flex-col border-x border-line"
            initial={{ y: 28, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 28, opacity: 0 }}
          >
            <div className="flex items-center border-b border-line px-5 py-4">
              <div className="flex flex-col">
                <span className="text-title font-bold text-ink">个人档案与 AI 隐私</span>
                <span className="text-micro text-faint">每条事实只分为公开或私人</span>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="ml-auto flex h-9 w-9 items-center justify-center rounded-full bg-raised text-lg text-sub"
                aria-label="关闭"
              >
                ×
              </button>
            </div>

            <div className="flex-1 overflow-y-auto px-5 py-5">
              {loading && !snapshot ? (
                <div className="py-16 text-center text-footnote text-faint">正在读取个人档案…</div>
              ) : (
                <div className="flex flex-col gap-5">
                  {error && (
                    <div className="rounded-tile border border-orange/30 bg-orange/10 px-3.5 py-3 text-caption text-orange">
                      {error}
                    </div>
                  )}

                  <section className="flex flex-col gap-3">
                    <div className="flex items-end justify-between">
                      <div className="flex flex-col">
                        <span className="text-callout font-bold text-ink">画像事实</span>
                        <span className="text-micro text-faint">
                          版本 {snapshot?.profile_revision ?? 0} · 只显示当前有效事实
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => void load()}
                        className="text-caption text-brand"
                      >
                        刷新
                      </button>
                    </div>

                    {Object.keys(grouped).length === 0 ? (
                      <div className="kaleido-card py-8 text-center text-footnote text-faint">
                        还没有画像事实
                      </div>
                    ) : (
                      DIMENSION_KEYS.filter((key) => grouped[key]?.length).map((dimension) => (
                        <div key={dimension} className="kaleido-card flex flex-col gap-3 p-4">
                          <div className="flex items-center justify-between">
                            <span className="text-body font-bold text-ink">
                              {DIMENSION_LABELS[dimension]}
                            </span>
                            <button
                              type="button"
                              onClick={() => setConfirm({ kind: "dimension", dimension })}
                              className="text-micro text-orange"
                            >
                              删除整个维度
                            </button>
                          </div>
                          {grouped[dimension].map((fact) => (
                            <div key={fact.id} className="rounded-field bg-raised px-3 py-2.5">
                              <div className="flex items-start gap-3">
                                <div className="min-w-0 flex-1">
                                  <div className="text-footnote font-medium leading-relaxed text-ink">
                                    {fact.value}
                                  </div>
                                  <div className="mt-1 text-micro text-faint">
                                    {SOURCE_LABELS[fact.source] ?? fact.source} · 置信度{" "}
                                    {Math.round(Number(fact.confidence) * 100)}%
                                  </div>
                                </div>
                                {fact.user_confirmed ? (
                                  <span className="shrink-0 rounded-chip bg-teal/12 px-2 py-1 text-micro text-teal-lite">
                                    已确认
                                  </span>
                                ) : (
                                  <button
                                    type="button"
                                    disabled={busy === `fact:${fact.id}`}
                                    onClick={() => void confirmFact(fact)}
                                    className="shrink-0 rounded-chip bg-brand/12 px-2 py-1 text-micro text-brand disabled:opacity-50"
                                  >
                                    确认准确
                                  </button>
                                )}
                                <button
                                  disabled={busy === `visibility:${fact.id}`}
                                  onClick={() => void setVisibility(fact)}
                                  className={`shrink-0 rounded-chip px-2 py-1 text-micro disabled:opacity-50 ${
                                    fact.visibility === "public"
                                      ? "bg-teal/12 text-teal-lite"
                                      : "bg-white/[0.06] text-sub"
                                  }`}
                                >
                                  {fact.visibility === "public" ? "公开" : "私人"}
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      ))
                    )}
                  </section>

                  <section className="flex flex-col gap-3">
                    <div className="flex flex-col">
                      <span className="text-callout font-bold text-ink">待你确认的理解</span>
                      <span className="text-micro text-faint">
                        Chat 和日记只能提出候选，不会直接覆盖正式画像
                      </span>
                    </div>
                    {(snapshot?.proposals ?? []).length === 0 ? (
                      <div className="kaleido-card py-7 text-center text-footnote text-faint">
                        暂无待确认内容
                      </div>
                    ) : (
                      (snapshot?.proposals ?? []).map((proposal) => (
                        <div key={proposal.id} className="kaleido-card flex flex-col gap-3 p-4">
                          <div>
                            <div className="text-footnote font-medium text-ink">{proposal.value}</div>
                            <div className="mt-1 text-micro text-faint">
                              {DIMENSION_LABELS[proposal.dimension] ?? proposal.dimension}
                              {" · "}
                              {SOURCE_LABELS[proposal.source_type] ?? proposal.source_type}
                              {" · "}置信度 {Math.round(Number(proposal.confidence) * 100)}%
                            </div>
                          </div>
                          <div className="flex gap-2">
                            <button
                              disabled={busy === `proposal:${proposal.id}`}
                              onClick={() => void reviewProposal(proposal, false)}
                              className="flex-1 rounded-chip border border-line py-2 text-caption text-sub disabled:opacity-50"
                            >
                              不是这样
                            </button>
                            <button
                              disabled={busy === `proposal:${proposal.id}`}
                              onClick={() => void reviewProposal(proposal, true)}
                              className="flex-1 rounded-chip bg-brand py-2 text-caption font-semibold text-white disabled:opacity-50"
                            >
                              确认加入
                            </button>
                          </div>
                        </div>
                      ))
                    )}
                  </section>

                  <section className="flex flex-col gap-3">
                    <div className="flex flex-col">
                      <span className="text-callout font-bold text-ink">最近 AI 使用记录</span>
                      <span className="text-micro text-faint">
                        仅记录用途和维度，不保存发送给模型的原文
                      </span>
                    </div>
                    {(snapshot?.access_receipts ?? []).length === 0 ? (
                      <div className="kaleido-card py-7 text-center text-footnote text-faint">
                        暂无长期画像使用记录
                      </div>
                    ) : (
                      <div className="kaleido-card divide-y divide-line">
                        {snapshot!.access_receipts.slice(0, 20).map((receipt) => (
                          <div key={receipt.id} className="flex flex-col gap-1.5 px-4 py-3">
                            <div className="flex items-center justify-between">
                              <span className="text-footnote font-semibold text-ink">
                                {PURPOSE_LABELS[receipt.purpose] ?? receipt.purpose}
                              </span>
                              <span className="text-micro text-faint">
                                {new Date(receipt.created_at).toLocaleString("zh-CN")}
                              </span>
                            </div>
                            <span className="text-micro text-sub">
                              使用：{receipt.dimensions.map((d) => DIMENSION_LABELS[d] ?? d).join("、")}
                              {" · "}版本 {receipt.profile_revision}
                            </span>
                            <span className="text-micro text-faint">
                              公开 {receipt.public_fact_count} 条 · 私人 {receipt.private_fact_count} 条
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </section>

                  <section className="flex flex-col gap-3 pb-8">
                    <div className="flex flex-col">
                      <span className="text-callout font-bold text-ink">数据管理</span>
                      <span className="text-micro text-faint">
                        公开事实会进入公开主页；私人事实只服务于你本人
                      </span>
                    </div>
                    <div className="kaleido-card flex flex-col divide-y divide-line">
                      <PrivacyAction
                        title="导出完整个人档案"
                        detail="下载 JSON，包含事实、来源和 AI 使用记录"
                        disabled={busy !== null}
                        onClick={() => void exportProfile()}
                      />
                      <PrivacyAction
                        title="清空全部画像"
                        detail="删除公开和私人事实、卡牌结果及 AI 形象；主页基础资料保留"
                        destructive
                        disabled={busy !== null}
                        onClick={() => setConfirm({ kind: "clear" })}
                      />
                    </div>
                  </section>
                </div>
              )}
            </div>

            {confirm && (
              <div className="absolute inset-0 flex items-center justify-center bg-black/70 px-7">
                <div className="w-full max-w-[360px] rounded-card border border-line bg-card p-5">
                  <div className="text-lead font-bold text-ink">确认操作</div>
                  <p className="mt-2 text-caption leading-relaxed text-sub">
                    {confirm.kind === "dimension"
                      ? `将永久删除“${DIMENSION_LABELS[confirm.dimension]}”及其来源记录。`
                      : "全部画像事实将永久删除，主页基础资料不会受到影响。"}
                  </p>
                  <div className="mt-5 flex gap-2.5">
                    <button
                      type="button"
                      onClick={() => setConfirm(null)}
                      className="flex-1 rounded-chip border border-line py-2.5 text-footnote text-sub"
                    >
                      取消
                    </button>
                    <button
                      type="button"
                      onClick={() => void runConfirmedAction()}
                      className="flex-1 rounded-chip bg-orange py-2.5 text-footnote font-semibold text-white"
                    >
                      确认
                    </button>
                  </div>
                </div>
              </div>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function PrivacyAction({
  title,
  detail,
  destructive = false,
  disabled,
  onClick,
}: {
  title: string;
  detail: string;
  destructive?: boolean;
  disabled: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className="flex items-center gap-3 px-4 py-3.5 text-left disabled:opacity-50"
    >
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <span className={`text-footnote font-semibold ${destructive ? "text-orange" : "text-ink"}`}>
          {title}
        </span>
        <span className="text-micro text-faint">{detail}</span>
      </div>
      <span className="text-faint">›</span>
    </button>
  );
}
