// 入参校验 + 上限（防滥用；写库前裁剪）
export const LIMITS = {
  message: 2000,
  transcript: 8000,
  topic: 20,
  question: 200,
  choice: 120,
} as const;

export const TOPICS = ["职业", "家庭", "升学", "情感"] as const;

export function str(v: unknown, max: number): string | null {
  if (typeof v !== "string") return null;
  const t = v.trim();
  if (!t || t.length > max) return null;
  return t;
}

export function intIn(v: unknown, min: number, max: number): number | null {
  const n = typeof v === "number" ? v : Number(v);
  if (!Number.isInteger(n) || n < min || n > max) return null;
  return n;
}

export function oneOf<T extends readonly string[]>(
  v: unknown,
  allowed: T,
  fallback: T[number],
): T[number] {
  return typeof v === "string" && (allowed as readonly string[]).includes(v)
    ? (v as T[number])
    : fallback;
}
