"use client";
/* 输入栏 —— 移植自 iOS ChatView.inputBar（回车/发送按钮续轮，流式时禁用发送） */

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
      <div className="mx-auto flex w-full max-w-[760px] items-center gap-2.5">
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
          className="flex-1 text-[13.5px] text-ink placeholder:text-faint px-[18px] py-3 rounded-chip bg-raised border border-line outline-none focus:border-[#6FA5FF]/60"
        />
        <button
          onClick={onSend}
          disabled={disabled}
          className="text-[13px] font-semibold text-white px-[22px] py-3 rounded-chip bg-btn-g transition active:scale-[0.96] disabled:opacity-40"
        >
          发送
        </button>
      </div>
    </div>
  );
}
