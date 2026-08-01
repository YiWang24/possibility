"use client";
/* 验证反馈 chips —— 移植自 iOS ChatView.actionChips（原型 .chat-actions）
 * 「嗯，比较接近 / 这次准确了」续接确认；「还不太对 / 我再补充一点」触发纠正循环。 */

import { Button } from "@/components/ui/button";

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
      <Button size="sm" onClick={onConfirm}>
        {confirmLabel}
      </Button>
      <Button variant="tonal" size="sm" onClick={onCorrect}>
        {correctLabel}
      </Button>
    </div>
  );
}
