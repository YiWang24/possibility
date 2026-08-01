"use client";
/* 登录弹层 —— AuthGate 的兜底形态：会话过期后在关键动作处就地补登录。
   冷启动无会话走的是 AuthWall 全屏登录墙，不是这里。
   移动端为底部全宽 sheet，桌面端为居中 modal。 */
import { AnimatePresence, motion } from "framer-motion";
import { EmailPasswordForm } from "./EmailPasswordForm";

export function LoginSheet({
  open,
  onClose,
  onSuccess,
}: {
  open: boolean;
  /** 用户放弃登录（点背景 / 关闭按钮） */
  onClose: () => void;
  /** 登录成功回调（AuthGate 继续被拦截的动作） */
  onSuccess?: () => void;
}) {
  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-70 flex items-end justify-center md:items-center md:p-6">
          {/* 背景遮罩：点击即放弃登录 */}
          <motion.div
            className="absolute inset-0 bg-black/60"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
          />
          {/* 移动全宽 sheet / 桌面居中 modal */}
          <motion.div
            className="relative w-full md:w-[420px] max-h-[85vh] overflow-y-auto no-scrollbar bg-card border border-line rounded-t-sheet md:rounded-sheet shadow-pop"
            initial={{ y: 48, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 48, opacity: 0 }}
            transition={{ type: "spring", stiffness: 380, damping: 34 }}
          >
            {/* 拖拽指示条（移动端） */}
            <div className="mx-auto mt-3 h-1 w-10 rounded-chip bg-white/20 md:hidden" />

            <div className="flex flex-col gap-4 px-[22px] pt-6 pb-7">
              <div className="flex items-start justify-between">
                <div className="flex flex-col gap-1.5">
                  <div className="text-title font-bold text-ink">登录 Possibility</div>
                  <div className="text-caption text-sub">
                    会话已过期，重新登录后继续刚才的操作。
                  </div>
                </div>
                <button
                  onClick={onClose}
                  aria-label="关闭"
                  className="shrink-0 w-7 h-7 -mr-1 rounded-chip bg-raised border border-line text-sub text-body leading-none transition active:scale-[0.97]"
                >
                  ✕
                </button>
              </div>

              <EmailPasswordForm onSuccess={onSuccess} />
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
