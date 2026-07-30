export type Hue = {
  id: number;
  gradient: string;
  accent: string;
};

export const HUES: Hue[] = [
  {
    id: 0,
    gradient: "linear-gradient(135deg,#0F1F52 0%,#2E5EDB 55%,#6FA5FF 100%)",
    accent: "#3D6EF0",
  },
  {
    id: 1,
    gradient: "linear-gradient(135deg,#3A1035 0%,#B03390 55%,#F06ACD 100%)",
    accent: "#C445A4",
  },
  {
    id: 2,
    gradient: "linear-gradient(135deg,#0E2A22 0%,#1F8A66 60%,#8FD84B 100%)",
    accent: "#2FA98C",
  },
  {
    id: 3,
    gradient: "linear-gradient(135deg,#3A140C 0%,#D14A24 60%,#FF8A54 100%)",
    accent: "#E85A34",
  },
  {
    id: 4,
    gradient: "linear-gradient(135deg,#171243 0%,#4A3BD1 60%,#8F7BFF 100%)",
    accent: "#6E58E8",
  },
];

export function hue(index: number): Hue {
  return HUES[((index % HUES.length) + HUES.length) % HUES.length];
}

/* LLM 卡点缀色板 —— 任意颜色吸附到最近的品牌色，避免随机彩虹色 */
export const CARD_ACCENTS = ["#5E96FF", "#8F7BFF", "#E35CC1", "#FFB067", "#3ED9A4"];

function parseHue(color: string): { h: number; s: number; v: number } | null {
  const m = color.match(/^#?([0-9a-f]{6})$/i);
  if (!m) return null;
  const n = parseInt(m[1], 16);
  const r = ((n >> 16) & 255) / 255;
  const g = ((n >> 8) & 255) / 255;
  const b = (n & 255) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const d = max - min;
  let h = 0;
  if (d !== 0) {
    if (max === r) h = ((g - b) / d + 6) % 6;
    else if (max === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
    h /= 6;
  }
  return { h, s: max === 0 ? 0 : d / max, v: max };
}

const ACCENT_HUES = CARD_ACCENTS.map((c) => parseHue(c)!.h);

function hueDistance(a: number, b: number) {
  const d = Math.abs(a - b);
  return Math.min(d, 1 - d);
}

export function cardAccent(color: string | null | undefined, index: number): string {
  const rotated = CARD_ACCENTS[((index % CARD_ACCENTS.length) + CARD_ACCENTS.length) % CARD_ACCENTS.length];
  const hsb = color ? parseHue(color.trim()) : null;
  if (!hsb || hsb.s <= 0.15 || hsb.v <= 0.12) return rotated;
  let best = 0;
  let bestDist = Infinity;
  ACCENT_HUES.forEach((h, i) => {
    const dist = hueDistance(h, hsb.h);
    if (dist < bestDist) {
      bestDist = dist;
      best = i;
    }
  });
  return CARD_ACCENTS[best];
}

/* mock 数据头像：按 id / 文本稳定映射到 /assets/community-avatars/avatar-01..16 */
export const MOCK_AVATAR_COUNT = 16;

export function mockAvatarById(id: number): string {
  const index = ((Math.abs(id) - 1) % MOCK_AVATAR_COUNT) + 1;
  return `/assets/community-avatars/avatar-${String(index).padStart(2, "0")}.png`;
}

export function mockAvatarByText(text: string): string {
  let acc = 0;
  for (const ch of text) acc = (Math.imul(acc, 31) + ch.codePointAt(0)!) | 0;
  const index = (Math.abs(acc) % MOCK_AVATAR_COUNT) + 1;
  return `/assets/community-avatars/avatar-${String(index).padStart(2, "0")}.png`;
}
