"use client";
import type { ComponentProps, ReactNode } from "react";
import { cn } from "@/lib/utils";

/* 弹层底板。此前 12 个文件各写一遍 `fixed inset-0 …`，z-index 用了 5 个不同值；
   统一 z 阶：navbar 50 < sheet 70 < toast 90。
   移动端贴底、桌面居中；内容层样式通过 className 扩展。 */
function SheetShell({
  onClose,
  closeLabel = "关闭弹层",
  className,
  children,
  ...props
}: ComponentProps<"div"> & { onClose?: () => void; closeLabel?: string; children: ReactNode }) {
  return (
    <div
      className="fixed inset-0 z-70 flex items-end justify-center md:items-center"
      {...props}
    >
      <button
        type="button"
        aria-label={closeLabel}
        onClick={onClose}
        className="absolute inset-0 cursor-default bg-black/60 backdrop-blur-sm"
      />
      <div
        role="dialog"
        aria-modal="true"
        className={cn(
          "relative flex max-h-[86dvh] w-full max-w-[520px] flex-col overflow-hidden rounded-t-sheet border border-line bg-paper shadow-pop md:rounded-sheet",
          className,
        )}
      >
        {children}
      </div>
    </div>
  );
}

export { SheetShell };
