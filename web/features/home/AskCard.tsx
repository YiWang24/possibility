"use client";
/* 首页 AI 发问卡 —— 移植 iOS HomeAskCard（原型 .ask）。
   熔岩灯光斑用 CSS 动画的模糊光球近似（对齐原型 glow/glow2/glow3）。 */

import { useRouter } from "next/navigation";
import { useHome } from "./store";
import { EXPLORE_TOPICS } from "@/lib/models";

export function AskCard() {
  const router = useRouter();
  const question = useHome((s) => s.question);
  const topic = useHome((s) => s.topic);
  const setQuestion = useHome((s) => s.setQuestion);
  const toggleTopic = useHome((s) => s.toggleTopic);
  const clearQuestion = useHome((s) => s.clearQuestion);
  const canSend = useHome((s) => s.question.trim().length > 0);

  const send = () => {
    const q = question.trim();
    if (!q) return;
    const params = new URLSearchParams();
    if (topic) params.set("topic", topic.topic);
    params.set("q", q);
    router.push(`/chat?${params.toString()}`);
  };

  return (
    <div className="relative overflow-hidden rounded-[28px] border border-[#7A9EFF]/30 px-[22px] pt-6 pb-[22px]">
      {/* 背景：深蓝渐变 + 光斑 */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(200px circle at 100% 0%, rgba(111,165,255,0.35), transparent), linear-gradient(135deg,#141A34 0%,#1A2350 50%,#10132A 100%)",
        }}
      />
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div
          className="animate-orb-a absolute -right-10 -top-16 h-[230px] w-[230px] rounded-full blur-[10px]"
          style={{
            background:
              "radial-gradient(circle, rgba(111,165,255,0.65) 0%, rgba(143,123,255,0.28) 52%, transparent 72%)",
          }}
        />
        <div
          className="animate-orb-b absolute -bottom-16 -left-12 h-[200px] w-[200px] rounded-full blur-[12px]"
          style={{
            background:
              "radial-gradient(circle, rgba(227,92,193,0.42) 0%, rgba(143,123,255,0.2) 55%, transparent 75%)",
          }}
        />
        <div
          className="animate-orb-c absolute left-[28%] top-[24%] h-[150px] w-[150px] rounded-full blur-[14px]"
          style={{
            background:
              "radial-gradient(circle, rgba(255,255,255,0.34) 0%, rgba(157,188,255,0.16) 55%, transparent 72%)",
          }}
        />
      </div>

      <div className="relative">
        <div className="relative pl-[26px] text-[11px] tracking-[3.5px] text-[#9DBCFF]">
          <span className="absolute left-0 top-1/2 h-[1.5px] w-[18px] -translate-y-1/2 bg-[#9DBCFF]/60" />
          今天想探索什么
        </div>

        <div className="mt-3 text-[22px] font-bold leading-[1.5] text-ink">
          说出那个
          <br />
          <span className="text-brand">在心里盘旋</span>的问题
        </div>

        {/* 输入盒 */}
        <div className="relative mt-4 rounded-[18px] border border-white/12 bg-[#060810]/45 px-[14px] py-3">
          {topic && (
            <div className="mb-1.5 inline-flex items-center gap-1.5 rounded-chip border border-[#5E96FF]/40 bg-[#5E96FF]/16 px-[11px] py-1 text-[11px] font-semibold text-[#9DBCFF]">
              <span>✦</span>
              {topic.topic}
            </div>
          )}
          <textarea
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            rows={2}
            placeholder="写下任何正在心里盘旋的问题…"
            className="w-full resize-none bg-transparent pr-6 text-[15px] leading-relaxed text-ink placeholder:text-faint focus:outline-none"
          />
          {question.trim() && (
            <button
              onClick={clearQuestion}
              aria-label="清空输入"
              className="absolute right-[13px] top-[11px] flex h-6 w-6 items-center justify-center rounded-full bg-white/8 text-[18px] leading-none text-[#AEB7CC]"
            >
              ×
            </button>
          )}
          <div className="mt-0.5 flex justify-end">
            <button
              onClick={send}
              disabled={!canSend}
              className="rounded-chip bg-btn-g px-6 py-[10px] text-[13.5px] font-semibold text-white shadow-[0_6px_10px_rgba(79,125,255,0.6)] transition active:scale-[0.96] disabled:opacity-40"
            >
              发送
            </button>
          </div>
        </div>

        {/* 话题 chips */}
        <div className="mt-3.5 flex flex-wrap gap-2">
          {EXPLORE_TOPICS.map((t) => {
            const on = topic?.topic === t.topic;
            return (
              <button
                key={t.topic}
                onClick={() => toggleTopic(t)}
                className={`rounded-chip border px-[15px] py-2 text-[12.5px] transition active:scale-[0.96] ${
                  on
                    ? "border-[#5E96FF]/50 bg-[#5E96FF]/14 text-[#9DBCFF]"
                    : "border-white/10 bg-white/7 text-sub"
                }`}
              >
                {t.topic}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
