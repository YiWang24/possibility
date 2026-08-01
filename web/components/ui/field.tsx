"use client";
import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";

/* 表单输入行：抬升底 + 聚焦描边。input/textarea 本体透明，由 Field 承载外观，
   这样「输入框 + 尾随小按钮」（如密码可见性切换）天然同框。 */
function Field({ className, ...props }: ComponentProps<"div">) {
  return (
    <div
      data-slot="field"
      className={cn(
        "flex items-center gap-2.5 rounded-field border border-line bg-raised px-3.5 py-3 transition-colors focus-within:border-brand-bright/60",
        className,
      )}
      {...props}
    />
  );
}

function Input({ className, ...props }: ComponentProps<"input">) {
  return (
    <input
      data-slot="input"
      className={cn(
        "w-full bg-transparent text-callout text-ink outline-none placeholder:text-faint",
        className,
      )}
      {...props}
    />
  );
}

function Textarea({ className, ...props }: ComponentProps<"textarea">) {
  return (
    <textarea
      data-slot="textarea"
      className={cn(
        "w-full resize-none bg-transparent text-callout leading-relaxed text-ink outline-none placeholder:text-faint",
        className,
      )}
      {...props}
    />
  );
}

export { Field, Input, Textarea };
