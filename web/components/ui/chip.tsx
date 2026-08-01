"use client";
import { cva, type VariantProps } from "class-variance-authority";
import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";

/* 可选中胶囊（原 ChipToggle / .chip / .seg）。选中态语义走 aria-pressed。 */
const chipVariants = cva(
  "shrink-0 rounded-chip border outline-none transition active:scale-[0.97] focus-visible:ring-2 focus-visible:ring-brand/45",
  {
    variants: {
      selected: {
        true: "border-brand-bright/60 bg-brand-deep font-medium text-white",
        false: "border-line bg-raised text-sub hover:text-ink",
      },
      size: {
        sm: "px-3 py-1.5 text-caption",
        md: "px-4 py-2 text-footnote",
      },
    },
    defaultVariants: { selected: false, size: "md" },
  },
);

function Chip({
  className,
  selected = false,
  size,
  ...props
}: Omit<ComponentProps<"button">, "type"> & Omit<VariantProps<typeof chipVariants>, "selected"> & {
  selected?: boolean;
}) {
  return (
    <button
      type="button"
      data-slot="chip"
      aria-pressed={selected}
      className={cn(chipVariants({ selected, size }), className)}
      {...props}
    />
  );
}

export { Chip, chipVariants };
