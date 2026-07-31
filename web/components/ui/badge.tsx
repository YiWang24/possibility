import { cva, type VariantProps } from "class-variance-authority";
import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";

/* 彩色小标签（原 TagPill 及散落在各 feature 的 6 套 ad-hoc chip 样式）。
   tint 背景统一 /13、描边统一 /30，文字用对应的 -lite 文字色 token。 */
const badgeVariants = cva(
  "inline-flex shrink-0 items-center gap-1 rounded-chip border whitespace-nowrap",
  {
    variants: {
      tone: {
        brand: "border-brand/30 bg-brand/13 text-brand-lite",
        teal: "border-teal/40 bg-teal/13 text-teal-lite",
        violet: "border-violet-soft/35 bg-violet-soft/13 text-violet-soft",
        orange: "border-orange/35 bg-orange/13 text-apricot",
        neutral: "border-line bg-raised text-sub",
      },
      size: {
        sm: "px-2 py-0.5 text-micro",
        md: "px-2.5 py-1 text-caption",
      },
    },
    defaultVariants: { tone: "brand", size: "md" },
  },
);

function Badge({
  className,
  tone,
  size,
  ...props
}: ComponentProps<"span"> & VariantProps<typeof badgeVariants>) {
  return (
    <span data-slot="badge" className={cn(badgeVariants({ tone, size }), className)} {...props} />
  );
}

export { Badge, badgeVariants };
