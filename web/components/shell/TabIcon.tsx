"use client";

/* 4 个 Tab 的线性图标（对齐 iOS SF Symbols 语义） */
export function TabIcon({
  name,
  active,
  size = 24,
}: {
  name: string;
  active: boolean;
  size?: number;
}) {
  const stroke = active ? "#5E96FF" : "#5A6172";
  const common = {
    width: size,
    height: size,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke,
    strokeWidth: 1.7,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
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
    default:
      return null;
  }
}
