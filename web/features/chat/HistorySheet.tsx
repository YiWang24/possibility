"use client";
/* 历史探索列表 —— 移植自 iOS ChatHistorySheet（list-conversations → restore 续聊）
 * 移动端底部抽屉，md 起居中卡片。 */

import { useState } from "react";
import { TagPill } from "@/components/ui/Basics";
import { timeLabel } from "./ChatChrome";
import type { ChatModel } from "./store";

export function ChatHistorySheet({ model, onClose }: { model: ChatModel; onClose: () => void }) {
  const [restoringId, setRestoringId] = useState<string | null>(null);
  const entries = model.historyEntries;

  return (
    <div className="fixed inset-0 z-[80] flex items-end md:items-center md:justify-center">
      <button aria-label="关闭" onClick={onClose} className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
      <div className="relative z-10 flex max-h-[80dvh] w-full flex-col screen-bg rounded-t-sheet md:max-w-[560px] md:rounded-sheet md:border md:border-line overflow-hidden">
        <div className="flex items-center gap-3 px-[22px] pt-5 pb-3">
          <div className="flex flex-col gap-0.5">
            <span className="text-[16px] font-semibold tracking-[0.8px] text-ink">历史探索</span>
            <span className="text-[11px] text-faint">选一段继续想下去</span>
          </div>
        </div>
        <div className="flex-1 overflow-y-auto no-scrollbar px-5 pt-1.5 pb-5">
          <div className="flex flex-col gap-2.5">
            {entries.map((convo) => {
              const ready = convo.crossroads?.ready === true;
              return (
                <button
                  key={convo.id}
                  disabled={restoringId != null}
                  onClick={async () => {
                    if (restoringId != null) return;
                    setRestoringId(convo.id);
                    await model.restore(convo);
                    setRestoringId(null);
                    onClose();
                  }}
                  className="text-left rounded-[18px] bg-card border border-line p-[15px] transition active:scale-[0.98]"
                >
                  <div className="flex items-center gap-2">
                    <TagPill text={convo.topic} />
                    {ready ? <span className="text-[9px] tracking-[1px] text-teal">岔路口已成形</span> : null}
                    <div className="flex-1" />
                    {restoringId === convo.id ? (
                      <span className="w-3 h-3 rounded-full border-2 border-faint border-t-transparent animate-spin" />
                    ) : (
                      <span className="text-[10px] text-faint">{timeLabel(convo.created_at)}</span>
                    )}
                  </div>
                  <p className="text-[13.5px] font-semibold leading-[1.5] text-ink mt-2.5 line-clamp-2">
                    {convo.crossroads?.summary ?? "还在澄清中的对话"}
                  </p>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
