import type { ReactNode } from "react";

/* 页眉与分区标题 —— 从 Basics.tsx 迁入，字号走 token 字阶。 */

/* 页眉：eyebrow + 大标题（+ 可选副文案 / 右侧动作区）。
   字号走 text-display 流体字阶：手机 27px，桌面放大到 40px。 */
export function PageHeader({
  eyebrow,
  title,
  description,
  actions,
}: {
  eyebrow: string;
  title: string;
  description?: string;
  /** 右侧动作区：桌面上把移动端的浮动按钮收编成正经的页眉按钮 */
  actions?: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between md:gap-8">
      <div className="flex min-w-0 flex-col gap-1.5">
        <div className="text-eyebrow text-faint">{eyebrow}</div>
        <h1 className="text-display font-bold text-ink">{title}</h1>
        {description && (
          <p className="mt-1 max-w-[52ch] text-body text-sub">{description}</p>
        )}
      </div>
      {actions && <div className="flex shrink-0 items-center gap-2.5">{actions}</div>}
    </div>
  );
}

/* 分区标题：标题 + 右侧说明/链接 */
export function SectionHeader({
  title,
  trailing,
  isLink = false,
  onTrailing,
}: {
  title: string;
  trailing?: string;
  isLink?: boolean;
  onTrailing?: () => void;
}) {
  return (
    <div className="flex items-baseline justify-between gap-4">
      <h2 className="text-section font-semibold text-ink">{title}</h2>
      {trailing &&
        (onTrailing ? (
          <button
            onClick={onTrailing}
            className={`text-footnote ${isLink ? "text-brand" : "text-faint"}`}
          >
            {trailing}
          </button>
        ) : (
          <span className="text-footnote text-faint">{trailing}</span>
        ))}
    </div>
  );
}
