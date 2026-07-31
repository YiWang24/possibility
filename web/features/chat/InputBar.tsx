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
    <div className="border-t border-line bg-paper/80 backdrop-blur px-[18px] pt-3 pb-2">
      <div className="mx-auto flex w-full max-w-measure items-center gap-2.5">
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
