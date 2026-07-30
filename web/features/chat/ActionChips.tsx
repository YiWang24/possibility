"use client";
/* 验证反馈 chips —— 移植自 iOS ChatView.actionChips（原型 .chat-actions）
 * 「嗯，比较接近 / 这次准确了」续接确认；「还不太对 / 我再补充一点」触发纠正循环。 */

export function ActionChips({
  confirmLabel,
  correctLabel,
  onConfirm,
  onCorrect,
}: {
  confirmLabel: string;
  correctLabel: string;
  onConfirm: () => void;
  onCorrect: () => void;
}) {
  return (
    <div className="flex gap-2.5 pt-3.5">
      <button
        onClick={onConfirm}
        className="text-[12.5px] font-semibold text-white px-4 py-[9px] rounded-chip bg-btn-g transition active:scale-[0.96]"
      >
        {confirmLabel}
      </button>
      <button
        onClick={onCorrect}
        className="text-[12.5px] text-sub px-4 py-[9px] rounded-chip bg-raised border border-line transition active:scale-[0.96]"
      >
        {correctLabel}
      </button>
    </div>
  );
}
