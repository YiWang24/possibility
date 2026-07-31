"use client";

/* 导航图标（对齐 iOS SF Symbols 语义）。
   描边走 currentColor，颜色交给父级的 text-* 控制 —— 桌面侧栏需要 hover/active
   两态平滑过渡，原来把色值写死在 svg 里做不到。 */
export function TabIcon({ name, active = false, size = 24 }: {
  name: string;
  active?: boolean;
  size?: number;
}) {
  const common = {
    width: size,
    height: size,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.7,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    "aria-hidden": true,
  };
  switch (name) {
    case "home": // 认识你自己 —— 人形光点
      return (
        <svg {...common}>
          <circle cx="12" cy="8" r="3.4" />
          <path d="M5.5 19.5c1.2-3.4 3.6-5.1 6.5-5.1s5.3 1.7 6.5 5.1" />
          <path d="M12 2.2v1.2M18.8 5l-.9.9M5.2 5l.9.9" opacity={active ? 1 : 0.55} />
        </svg>
      );
    case "lab": // 人生实验室 —— 烧瓶
      return (
        <svg {...common}>
          <path d="M9.5 3h5M10.5 3v5.2L5.8 16.6A2.4 2.4 0 0 0 8 20h8a2.4 2.4 0 0 0 2.2-3.4L13.5 8.2V3" />
          <path d="M8.2 14.5h7.6" />
        </svg>
      );
    case "community": // 万花筒社区 —— 六瓣万花筒
      return (
        <svg {...common}>
          <circle cx="12" cy="12" r="8.5" />
          <path d="M12 3.5v17M4.6 7.8l14.8 8.4M4.6 16.2l14.8-8.4" opacity={0.8} />
        </svg>
      );
    case "me": // 我的主页 —— 名片
      return (
        <svg {...common}>
          <rect x="3.5" y="5" width="17" height="14" rx="3" />
          <circle cx="9" cy="11" r="2" />
          <path d="M6.5 15.6c.6-1.4 1.5-2 2.5-2s1.9.6 2.5 2M14.5 9.5h3M14.5 13h3" />
        </svg>
      );
    case "chat": // 探索对话 —— 气泡
      return (
        <svg {...common}>
          <path d="M20.5 12.4c0 3.9-3.8 7-8.5 7-1 0-2-.14-2.9-.4L4 20.5l1.6-3.7a6.5 6.5 0 0 1-2.1-4.6c0-3.87 3.8-7 8.5-7s8.5 3.13 8.5 7Z" />
          <path d="M8.8 12h6.4" opacity={0.75} />
        </svg>
      );
    case "cards": // 人生卡牌 —— 扇形牌堆
      return (
        <svg {...common}>
          <rect x="9" y="4.5" width="10" height="14" rx="2.4" />
          <path d="M6.6 6.9 4.7 7.6a2 2 0 0 0-1.2 2.6l3 8.2a2 2 0 0 0 2.6 1.2l1.9-.7" />
        </svg>
      );
    case "studio": // 画像工作室 —— 棱镜
      return (
        <svg {...common}>
          <path d="M12 3.2 21 19.4H3L12 3.2Z" />
          <path d="M12 3.2V19.4M7.5 11.3h9" opacity={0.7} />
        </svg>
      );
    case "diary": // 语音日记 —— 声波
      return (
        <svg {...common}>
          <rect x="9.2" y="2.8" width="5.6" height="11" rx="2.8" />
          <path d="M5.5 11.4a6.5 6.5 0 0 0 13 0M12 17.9v3.3" />
        </svg>
      );
    default:
      return null;
  }
}
