"use client";
/* 首页语音日记卡 —— 移植 iOS DiaryCard。
   Web 端录音改为「文字输入 + 保留麦克风 UI」：录音态展示波形装饰 + 文本输入框，
   完成后提交 analyze-diary（input_method:"text"）。 */

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useHome } from "./store";
import { emotionEmoji } from "@/lib/emotions";

const WEEKDAY_CHARS = ["日", "一", "二", "三", "四", "五", "六"];

/** 首页前 6 天固定使用 demo 心情；只有「今天」读取真实日记 */
function mockWeek(): { emoji: string; label: string; date: string }[] {
  const emojis = ["🙂", "😮‍💨", "😊", "😐", "🙂", "😌"];
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const out: { emoji: string; label: string; date: string }[] = [];
  for (let i = 0; i < 6; i++) {
    const offset = i - 6; // -6 .. -1
    const d = new Date(today);
    d.setDate(d.getDate() + offset);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    out.push({ emoji: emojis[i], label: WEEKDAY_CHARS[d.getDay()], date: `${y}-${m}-${day}` });
  }
  return out;
}

function DayCell({
  emoji,
  label,
  filled,
  today,
}: {
  emoji: string;
  label: string;
  filled: boolean;
  today: boolean;
}) {
  return (
    <div className="flex flex-col items-center gap-1.5">
      <div className="relative flex h-[30px] w-[30px] items-center justify-center rounded-full text-[15px]">
        <span
          className="absolute inset-0 rounded-full"
          style={{
            background: filled
              ? "linear-gradient(135deg,#3E77F2,#B03390)"
              : "var(--color-raised)",
          }}
        />
        {today && (
          <span className="absolute -inset-0.5 rounded-full border-2 border-dashed border-[#5E96FF]/55" />
        )}
        <span className="relative">{emoji}</span>
      </div>
      <span className={`text-[10px] ${today ? "text-brand" : "text-faint"}`}>{label}</span>
    </div>
  );
}

export function DiaryCard() {
  const router = useRouter();
  const isRecording = useHome((s) => s.isRecording);
  const elapsed = useHome((s) => s.elapsed);
  const analyzing = useHome((s) => s.analyzing);
  const analysis = useHome((s) => s.analysis);
  const analysisError = useHome((s) => s.analysisError);
  const transcript = useHome((s) => s.transcript);
  const toggleRecording = useHome((s) => s.toggleRecording);
  const setTranscript = useHome((s) => s.setTranscript);
  const startAnalyze = useHome((s) => s.startAnalyze);
  const submitEdited = useHome((s) => s.submitEditedTranscript);
  const retry = useHome((s) => s.retryAnalysis);
  const cancel = useHome((s) => s.cancelAnalysis);
  const hasRecordedToday = useHome((s) => s.hasRecordedToday());
  const todayEmoji = useHome((s) => s.todayDisplayEmoji());

  const [expanded, setExpanded] = useState(false);
  const [editing, setEditing] = useState(false);

  const week = mockWeek();
  const elapsedText = `${Math.floor(elapsed / 60)}:${String(elapsed % 60).padStart(2, "0")}`;
  const transcriptIsLong = transcript.length > 48;

  const openDiary = () => router.push("/diary");

  return (
    <div className="kaleido-card px-5 py-[17px]">
      <div className="flex flex-col gap-3.5">
        {/* 头部 */}
        <div className="flex items-center justify-between">
          <button
            onClick={openDiary}
            className="flex items-center gap-[7px] transition active:scale-[0.97]"
            aria-label="查看全部语音日记详情"
          >
            <span className="text-[14.5px] font-semibold text-ink">我的语音日记</span>
            <span className="flex h-[18px] w-[18px] items-center justify-center rounded-full border border-white/18 bg-white/6 text-[14px] text-white/80">
              ›
            </span>
          </button>
          <button
            onClick={() => (isRecording ? startAnalyze() : toggleRecording())}
            disabled={analyzing}
            className="rounded-chip bg-[#5E96FF]/12 px-3 py-1.5 text-[12.5px] font-medium text-brand disabled:opacity-50"
          >
            {isRecording ? "■ 停止记录" : "◉ 记录今日"}
          </button>
        </div>

        {/* 周历 */}
        <div className="flex items-center justify-between">
          {week.map((day) => (
            <button key={day.date} onClick={openDiary} className="transition active:scale-[0.95]">
              <DayCell emoji={day.emoji} label={day.label} filled today={false} />
            </button>
          ))}
          <button onClick={openDiary} className="transition active:scale-[0.95]">
            <DayCell
              emoji={hasRecordedToday ? todayEmoji : ""}
              label="今天"
              filled={hasRecordedToday}
              today
            />
          </button>
        </div>

        {/* 录音态：文字输入 + 保留麦克风 UI */}
        {isRecording && (
          <div
            className="flex flex-col gap-2.5 rounded-[14px] p-3.5"
            style={{
              background:
                "linear-gradient(90deg, rgba(94,150,255,0.14), rgba(227,92,193,0.10))",
            }}
          >
            <div className="flex items-center gap-3">
              {/* 波形装饰 */}
              <div className="flex flex-1 items-center gap-[3px]">
                {Array.from({ length: 22 }).map((_, i) => (
                  <span
                    key={i}
                    className="w-[2px] rounded-full bg-brand/70"
                    style={{ height: `${6 + ((i * 7) % 18)}px` }}
                  />
                ))}
              </div>
              <span className="w-[38px] font-mono text-[12px] tabular-nums text-lime">
                {elapsedText}
              </span>
              <button
                onClick={startAnalyze}
                className="rounded-chip bg-btn-g px-3.5 py-[7px] text-[12.5px] font-medium text-white"
              >
                完成
              </button>
            </div>
            <textarea
              value={transcript}
              onChange={(e) => setTranscript(e.target.value)}
              rows={2}
              placeholder="说出或写下今天想记录的…（留空将用示例内容）"
              className="w-full resize-none rounded-[10px] border border-line bg-white/5 p-2 text-[13px] leading-relaxed text-ink placeholder:text-faint focus:outline-none"
            />
          </div>
        )}

        {/* 转写全文（未录音且有转写） */}
        {!isRecording && transcript && (
          <div className="rounded-[14px] border border-line bg-white/[0.035] p-3">
            <div className="flex items-center justify-between gap-3">
              <span className="text-[11px] text-faint">语音转写</span>
              <div className="flex items-center gap-3">
                {editing ? (
                  <>
                    <button
                      onClick={() => setEditing(false)}
                      className="text-[11px] text-faint"
                    >
                      取消
                    </button>
                    <button
                      onClick={() => {
                        setEditing(false);
                        submitEdited();
                      }}
                      disabled={analyzing || transcript.trim().length === 0}
                      className="text-[11px] font-medium text-brand disabled:opacity-40"
                    >
                      重新分析
                    </button>
                  </>
                ) : (
                  <>
                    <button
                      onClick={() => {
                        setExpanded(true);
                        setEditing(true);
                      }}
                      disabled={analyzing}
                      className="text-[11px] text-brand disabled:opacity-40"
                    >
                      编辑
                    </button>
                    {transcriptIsLong && (
                      <button
                        onClick={() => setExpanded((v) => !v)}
                        className="text-[11px] text-brand"
                      >
                        {expanded ? "收起" : "展开全文"}
                      </button>
                    )}
                  </>
                )}
              </div>
            </div>
            {editing ? (
              <textarea
                value={transcript}
                onChange={(e) => setTranscript(e.target.value)}
                className="mt-2 min-h-[96px] w-full resize-none rounded-[10px] border border-line bg-white/5 p-2 text-[12.5px] leading-relaxed text-ink focus:outline-none"
              />
            ) : (
              <p
                className={`mt-2 whitespace-pre-wrap text-[12.5px] leading-[1.9] text-[#C8CEDA] ${
                  !expanded && transcriptIsLong ? "line-clamp-3" : ""
                }`}
              >
                {transcript}
              </p>
            )}
          </div>
        )}

        {/* 分析中 */}
        {analyzing && (
          <div className="flex items-center gap-2.5 py-1.5">
            <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-brand border-t-transparent" />
            <span className="text-[11.5px] text-sub">正在转写并分析这次记录…</span>
            <button onClick={cancel} className="ml-auto text-[11.5px] font-medium text-faint">
              取消
            </button>
          </div>
        )}

        {/* 失败 */}
        {analysisError && !analyzing && (
          <div className="flex items-center justify-between py-1.5">
            <span className="text-[11.5px] text-sub">{analysisError}</span>
            <button onClick={retry} className="text-[11.5px] font-medium text-brand">
              重试
            </button>
          </div>
        )}

        {/* 结果 */}
        {analysis && !analyzing && (
          <div className="flex flex-col gap-2 pt-1">
            <div className="h-px w-full bg-line" />
            <span className="text-[11px] text-faint">这次记录里，我听见了</span>
            <div className="flex flex-wrap gap-1.5">
              {analysis.emotions.map((e) => (
                <span
                  key={`e-${e}`}
                  className="rounded-chip bg-lime px-[11px] py-1 text-[11.5px] font-semibold text-[#0B0F18]"
                >
                  {emotionEmoji(e, "")} {e}
                </span>
              ))}
              {analysis.keywords.map((k) => (
                <span
                  key={`k-${k}`}
                  className="rounded-chip border border-[#5E96FF]/30 bg-[#5E96FF]/13 px-[11px] py-1 text-[11.5px] text-[#9DBCFF]"
                >
                  {k}
                </span>
              ))}
            </div>
            <button onClick={openDiary} className="self-end text-[11px] text-brand">
              查看详情 ›
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
