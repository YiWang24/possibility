"use client";
import { hue } from "@/lib/theme";

export function TravelerAvatar({
  initial,
  hueIndex,
  size = 52,
  cornerRadius = 999,
  imageSrc,
}: {
  initial: string;
  hueIndex: number;
  size?: number;
  cornerRadius?: number;
  imageSrc?: string | null;
}) {
  const radius = Math.min(cornerRadius, size / 2);
  return (
    <div
      className="relative shrink-0 overflow-hidden border border-white/18 flex items-center justify-center"
      style={{
        width: size,
        height: size,
        borderRadius: radius,
        background: imageSrc ? undefined : hue(hueIndex).gradient,
      }}
    >
      {imageSrc ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={imageSrc} alt={initial} className="w-full h-full object-cover" />
      ) : (
        <span className="text-white font-semibold" style={{ fontSize: size * 0.36 }}>
          {initial}
        </span>
      )}
    </div>
  );
}

/* 卡片顶部渐变色带 + 悬挂小圆头像 */
export function HueBandHeader({
  initial,
  hueIndex,
  bandHeight = 64,
  avatarSize = 40,
  imageSrc,
}: {
  initial: string;
  hueIndex: number;
  bandHeight?: number;
  avatarSize?: number;
  imageSrc?: string | null;
}) {
  const h = hue(hueIndex);
  return (
    <div className="relative" style={{ height: bandHeight + avatarSize * 0.4 }}>
      <div style={{ height: bandHeight, background: h.gradient }} />
      <div
        className="absolute rounded-full overflow-hidden flex items-center justify-center border-[3px] border-card"
        style={{
          width: avatarSize,
          height: avatarSize,
          left: 14,
          top: bandHeight - avatarSize * 0.6,
          background: imageSrc ? undefined : h.accent,
        }}
      >
        {imageSrc ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={imageSrc} alt={initial} className="w-full h-full object-cover" />
        ) : (
          <span className="text-white font-semibold" style={{ fontSize: avatarSize * 0.38 }}>
            {initial}
          </span>
        )}
      </div>
    </div>
  );
}
