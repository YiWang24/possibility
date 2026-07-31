"use client";
/* 专注模式外壳 —— 用于有明确开始与结束的任务流：测评、卡牌游戏局中、推演结果。

   这类界面本质是「模式」而不是「页面」。它们原来各自顶着一条
   「返回按钮 + 标题 + 全宽 border」的横条，紧贴全站导航之下，
   于是屏幕上出现两条 navbar，而两条都在鼓励用户中途走开 —— 恰好与任务目标相反。

   做法与 Typeform / Google Forms / Stripe Checkout 一致：收起全站导航，
   顶部只留一条极简条 —— 左边说明在做什么，中间是进度，右边一个退出。
   退出用 ✕ 而不是 ‹：用户要的是「离开这个任务」，不是「回到上一屏」。

   全站导航的收起由 AppShell 依 lib/nav 的 isFocusRoute 判定；
   lab 的推演结果是 /lab 内的阶段态而非独立路由，用 overlay 显式声明。 */

interface FocusShellProps {
  children: React.ReactNode;
  /** 任务名，如「大五人格」「人生卡牌」 */
  title: string;
  subtitle?: string;
  /** 0–1；给出时显示进度条 */
  progress?: number;
  /** 进度文案，如「12/120」 */
  progressLabel?: string;
  onExit: () => void;
  exitLabel?: string;
  /** 底部常驻操作区（继续 / 提交），sticky 在视口底沿 */
  footer?: React.ReactNode;
  /** 阶段态用：不是独立路由时铺成全屏浮层，盖住 /lab 自己的内容 */
  overlay?: boolean;
  /** 任务条中段的上下文（轮次、已选张数等）。窄屏隐藏，避免把任务名挤没 */
  meta?: React.ReactNode;
  /** 固定视口高度。牌桌这类「一屏内的交互台面」需要它；
      文档式任务流（测评）不要，那会退回内部滚动条。 */
  fullHeight?: boolean;
  /** 覆盖底衬（卡牌局用 card-game-stage 而不是通用 screen-bg） */
  stageClassName?: string;
}

export function FocusShell({
  children,
  title,
  subtitle,
  progress,
  progressLabel,
  onExit,
  exitLabel = "退出",
  footer,
  overlay = false,
  meta,
  fullHeight = false,
  stageClassName = "screen-bg",
}: FocusShellProps) {
  const frame = overlay
    ? `fixed inset-0 z-[70] flex flex-col overflow-y-auto ${stageClassName}`
    : `flex flex-col ${fullHeight ? "h-dvh" : "min-h-dvh"} ${stageClassName}`;

  return (
    <div className={frame}>
      {/* 任务条：没有 border-b，靠留白与视口顶端分隔，避免又长成一条 navbar */}
      <div className="shell-gutter mx-auto flex w-full max-w-shell shrink-0 items-center gap-4 pb-2 pt-5 md:pt-6">
        <div className="flex min-w-0 flex-col gap-0.5">
          <span className="truncate text-[15px] font-semibold tracking-[0.5px] text-ink xl:text-[17px]">
            {title}
          </span>
          {subtitle ? (
            <span className="truncate text-[11px] text-faint">{subtitle}</span>
          ) : null}
        </div>

        {meta ? (
          <div className="hidden min-w-0 flex-1 items-center gap-6 text-[10.5px] text-faint lg:flex">
            {meta}
          </div>
        ) : null}

        {typeof progress === "number" ? (
          <div className="flex min-w-0 items-center justify-end gap-3">
            <div className="hidden h-1 w-[min(240px,28vw)] overflow-hidden rounded-chip bg-raised sm:block">
              <div
                className="h-full rounded-chip bg-aurora transition-all duration-300"
                style={{ width: `${Math.round(Math.min(Math.max(progress, 0), 1) * 100)}%` }}
              />
            </div>
            {progressLabel ? (
              <span className="shrink-0 text-[11px] tabular-nums text-faint">{progressLabel}</span>
            ) : null}
          </div>
        ) : meta ? null : (
          <div className="flex-1" />
        )}

        <button
          onClick={onExit}
          aria-label={exitLabel}
          title={exitLabel}
          className="grid size-9 shrink-0 place-items-center rounded-full border border-line bg-raised/70 text-[15px] text-sub transition hover:border-white/20 hover:text-ink focus-visible:ring-2 focus-visible:ring-brand/45"
        >
          ✕
        </button>
      </div>

      <div className="flex w-full min-h-0 flex-1 flex-col">{children}</div>

      {footer ? <div className="sticky bottom-0 z-20 shrink-0">{footer}</div> : null}
    </div>
  );
}
