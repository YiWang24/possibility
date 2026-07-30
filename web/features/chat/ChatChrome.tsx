"use client";
/* 对话页公共小组件：返回按钮 + 历史入口图标按钮（移植自 iOS BackButton / 顶栏历史按钮） */

export function BackButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      aria-label="返回"
      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-raised border border-line text-ink transition active:scale-95"
    >
      <svg width="15" height="15" viewBox="0 0 15 15" fill="none" aria-hidden>
        <path d="M9.5 3 5 7.5 9.5 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </button>
  );
}

export function HistoryButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      aria-label="历史探索"
      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-raised border border-line text-ink transition active:scale-95"
    >
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden>
        <path
          d="M12 7v5l3 2M3.05 11a9 9 0 1 1 .5 4M3 11V6m0 5h5"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </button>
  );
}

/** 历史会话相对时间标签（简化版 SupabaseTimestamp.timeLabel） */
export function timeLabel(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const ts = Date.parse(raw);
  if (Number.isNaN(ts)) return null;
  const diff = Date.now() - ts;
  const min = Math.floor(diff / 60000);
  if (min < 1) return "刚刚";
  if (min < 60) return `${min} 分钟前`;
  const hour = Math.floor(min / 60);
  if (hour < 24) return `${hour} 小时前`;
  const day = Math.floor(hour / 24);
  if (day < 30) return `${day} 天前`;
  const d = new Date(ts);
  return `${d.getMonth() + 1}月${d.getDate()}日`;
}
