"use client";
/* 输入栏 —— 移植自 iOS ChatView.inputBar（回车/发送按钮续轮，流式时禁用发送） */

import { Button } from "@/components/ui/button";

export function InputBar({
  value,
  disabled,
  onChange,
  onSend,
}: {
  value: string;
  disabled: boolean;
  onChange: (text: string) => void;
  onSend: () => void;
}) {
  return (
    /* sticky 贴主栏底沿：页面滚动时输入栏始终在手边，但滚动条仍然是页面那一条，
       不像原来那样靠「外层 h-dvh + 消息区 overflow-y-auto」在页面里再造一个页面。
       负边距把毛玻璃底衬拉到主栏两侧留白外，气泡滚过去才不会从边缘漏出来。 */
    <div className="sticky bottom-0 z-20 -mx-[18px] border-t border-line bg-paper/80 px-[18px] pb-2 pt-3 backdrop-blur">
      <div className="flex w-full items-center gap-2.5">
        <input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.nativeEvent.isComposing) {
              e.preventDefault();
              onSend();
            }
          }}
          placeholder="想到什么，直接问…"
          enterKeyHint="send"
          className="flex-1 text-body text-ink placeholder:text-faint px-[18px] py-3 rounded-chip bg-raised border border-line outline-none focus:border-brand-bright/60"
        />
        <Button onClick={onSend} disabled={disabled}>
          发送
        </Button>
      </div>
    </div>
  );
}
