"use client";
/* 发布悬赏浮层 —— 移植 iOS BountyComposeView。
   问题（必填 ≤200）/ 详情（选填）/ 标签（空格或逗号分隔 ≤5）/ 悬赏金额（选填）→ community create_bounty。
   发布是关键动作，登录门控在父视图 FAB 处（useAuthGate().require）已完成。 */

import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/Toast";
import { callFunction } from "@/lib/supabase";

/** 空格 / 逗号 / 顿号 / # / 换行 分隔为标签 */
function parseTags(text: string): string[] {
  return text
    .split(/[\s,，、#]+/)
    .map((t) => t.trim())
    .filter(Boolean);
}

/** 金额规整：纯数字 → 「¥N 悬赏」；空 → 「¥0 悬赏」；其余原样 */
function normalizeReward(raw: string): string {
  const value = raw.trim();
  if (!value) return "¥0 悬赏";
  if (/^\d+(?:\.\d{1,2})?$/.test(value)) return `¥${value} 悬赏`;
  return value;
}

export function BountyCompose({
  onClose,
  onPublished,
}: {
  onClose: () => void;
  onPublished: () => void;
}) {
  const show = useToast((s) => s.show);
  const [question, setQuestion] = useState("");
  const [detail, setDetail] = useState("");
  const [tagText, setTagText] = useState("");
  const [reward, setReward] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [errorText, setErrorText] = useState<string | null>(null);

  const trimmedQuestion = question.trim();
  const tags = useMemo(() => parseTags(tagText), [tagText]);
  const questionValid = trimmedQuestion.length > 0 && trimmedQuestion.length <= 200;
  const tagsValid = tags.length <= 5;
  const canSubmit = questionValid && tagsValid && !submitting;

  const submit = async () => {
    if (!canSubmit) return;
    setSubmitting(true);
    setErrorText(null);
    try {
      await callFunction<{ ok: boolean; id: number }>("community", {
        action: "create_bounty",
        question: trimmedQuestion.slice(0, 200),
        tags: tags.slice(0, 5).map((t) => t.slice(0, 30)),
        detail: (detail.trim() || "（发帖人暂未补充具体情况）").slice(0, 2000),
        reward: normalizeReward(reward).slice(0, 50),
      });
      onPublished();
      onClose();
      show("悬赏已发布");
    } catch {
      setErrorText("发布失败，请检查网络后重试");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <motion.div
      className="fixed inset-0 z-[70] flex items-end justify-center md:items-center"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      <button
        aria-label="关闭"
        onClick={onClose}
        className="absolute inset-0 bg-black/55 backdrop-blur-sm"
      />
      <motion.div
        initial={{ y: "6%", opacity: 0.6 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: "6%", opacity: 0 }}
        transition={{ type: "spring", stiffness: 300, damping: 30 }}
        className="relative max-h-[88dvh] w-full max-w-[560px] overflow-y-auto no-scrollbar rounded-t-sheet border border-line bg-[#10131C] px-[22px] pb-8 pt-6 md:rounded-sheet"
      >
        <div className="mx-auto mb-4 h-1 w-10 rounded-chip bg-white/20 md:hidden" />
        <div className="flex flex-col gap-3.5">
          <div>
            <h2 className="text-title font-bold text-ink">发布悬赏</h2>
            <p className="mt-1 text-caption text-sub">向亲历者征集真实经历，而不是抽象建议。</p>
          </div>

          <Field label="你想问什么？（必填，≤200 字）">
            <ComposeInput
              value={question}
              onChange={setQuestion}
              placeholder="例如：有没有人从设计转数据分析？想听第一年最难的是什么"
              rows={2}
            />
          </Field>
          {trimmedQuestion.length > 200 && (
            <Hint text={`问题最多 200 字，当前 ${trimmedQuestion.length} 字`} />
          )}

          <Field label="想了解的具体情况（选填）">
            <ComposeInput
              value={detail}
              onChange={setDetail}
              placeholder="补充背景、真正的顾虑，让亲历者知道从哪里讲起。"
              rows={3}
            />
          </Field>

          <Field label="标签（选填，空格或逗号分隔，≤5 个）">
            <ComposeInput
              value={tagText}
              onChange={setTagText}
              placeholder="例如：职业转型 数据分析 设计背景"
              rows={1}
            />
          </Field>
          {tags.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {tags.map((tag, i) => (
                <Badge key={`${tag}-${i}`}>{tag}</Badge>
              ))}
            </div>
          )}
          {!tagsValid && <Hint text={`标签最多 5 个，当前 ${tags.length} 个`} />}

          <Field label="悬赏金额（选填）">
            <ComposeInput
              value={reward}
              onChange={setReward}
              placeholder="例如：29 或 ¥29"
              rows={1}
            />
          </Field>

          {errorText && <Hint text={errorText} />}

          <Button size="lg" className="mt-1 w-full" onClick={submit} disabled={!canSubmit}>
            {submitting ? "发布中…" : "发布悬赏"}
          </Button>
        </div>
      </motion.div>
    </motion.div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-caption text-sub">{label}</span>
      {children}
    </label>
  );
}

function ComposeInput({
  value,
  onChange,
  placeholder,
  rows,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  rows: number;
}) {
  return (
    <textarea
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      rows={rows}
      className="w-full resize-none rounded-field border border-line bg-raised px-3 py-3 text-footnote text-ink placeholder:text-faint focus:border-brand/50 focus:outline-none"
    />
  );
}

function Hint({ text }: { text: string }) {
  return <p className="text-caption text-apricot">{text}</p>;
}
