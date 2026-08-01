import { cva, type VariantProps } from "class-variance-authority";
import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";

/* 卡片容器。elevation=raised 即 iOS kaleidoCard()；flat 对应此前 22 处
   手写的 `rounded-[..] border border-line bg-card`，圆角吸附到 tile/card/sheet 三档。 */
const cardVariants = cva("overflow-hidden border border-line bg-card", {
  variants: {
    elevation: {
      flat: "",
      raised: "shadow-card",
    },
    radius: {
      tile: "rounded-tile",
      card: "rounded-card",
      sheet: "rounded-sheet",
    },
  },
  defaultVariants: { elevation: "raised", radius: "card" },
});

function Card({
  className,
  elevation,
  radius,
  ...props
}: ComponentProps<"div"> & VariantProps<typeof cardVariants>) {
  return (
    <div data-slot="card" className={cn(cardVariants({ elevation, radius }), className)} {...props} />
  );
}

export { Card, cardVariants };
