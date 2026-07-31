"use client";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";

/* 全站按钮单一真源。此前 bg-btn-g 在 24 个文件里被手写 33 次，
   py/字号/disabled 语义各不相同 —— 变体一律收敛到这里，不在调用点再拼样式。
   注意：不设默认 type，在 <form> 里保持浏览器默认的 submit 行为。 */
const buttonVariants = cva(
  "inline-flex shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-chip outline-none transition active:scale-[0.97] focus-visible:ring-2 focus-visible:ring-brand/60 disabled:pointer-events-none disabled:opacity-40",
  {
    variants: {
      variant: {
        /* 主 CTA：品牌渐变 + 辉光（原型 .btn-ink） */
        primary: "bg-btn-g font-semibold text-white shadow-glow hover:brightness-110",
        /* 次级：底色抬升面（原 bg-raised 手写按钮） */
        tonal: "border border-line bg-raised font-medium text-ink hover:bg-accent",
        /* 描边幽灵（原型 .btn-ghost） */
        ghost: "border-[1.5px] border-brand/45 font-medium text-brand hover:bg-brand/10",
        /* 纯文字 */
        plain: "font-medium text-sub hover:text-ink",
      },
      size: {
        sm: "px-4 py-2 text-footnote",
        md: "px-5 py-2.5 text-body",
        lg: "px-8 py-3.5 text-lead tracking-[0.8px]",
      },
    },
    defaultVariants: { variant: "primary", size: "md" },
  },
);

function Button({
  className,
  variant,
  size,
  asChild = false,
  ...props
}: ComponentProps<"button"> & VariantProps<typeof buttonVariants> & { asChild?: boolean }) {
  const Comp = asChild ? Slot : "button";
  return (
    <Comp
      data-slot="button"
      className={cn(buttonVariants({ variant, size }), className)}
      {...props}
    />
  );
}

export { Button, buttonVariants };
