"use client";

import type { CSSProperties } from "react";
import type { GameCard } from "./data";
import { withAlpha } from "./ui";

export interface ValueCardPalette {
  primary: string;
  secondary: string;
  deep: string;
}

const GROUP_PALETTES: Array<[string, ValueCardPalette]> = [
  ["关系", { primary: "#A67BFF", secondary: "#E36FCB", deep: "#18142E" }],
  ["内在", { primary: "#7C8CFF", secondary: "#A76CFF", deep: "#121833" }],
  ["价值", { primary: "#E77AB4", secondary: "#F2B45F", deep: "#2A1427" }],
  ["能力", { primary: "#62A4FF", secondary: "#55D6C6", deep: "#101D34" }],
  ["现实", { primary: "#43D2AA", secondary: "#5B9BFF", deep: "#102A2B" }],
  ["外部", { primary: "#F08B72", secondary: "#C975EA", deep: "#2A172A" }],
];

export function valueCardPalette(
  group: string,
  fallback = "#8F7BFF",
): ValueCardPalette {
  return GROUP_PALETTES.find(([key]) => group.includes(key))?.[1] ?? {
    primary: fallback,
    secondary: "#5E96FF",
    deep: "#14172F",
  };
}

function valueCardSurface(
  palette: ValueCardPalette,
  selected: boolean,
): CSSProperties {
  const washOpacity = selected ? 0.24 : 0.14;
  const borderOpacity = selected ? 0.88 : 0.42;
  return {
    background: `
      radial-gradient(circle at 18% 12%, ${withAlpha(palette.secondary, 0.2)}, transparent 30%),
      radial-gradient(circle at 88% 92%, ${withAlpha(palette.primary, 0.18)}, transparent 38%),
      linear-gradient(145deg, ${withAlpha(palette.primary, washOpacity)}, transparent 48%),
      linear-gradient(155deg, ${palette.deep}, #0C1020 76%)
    `,
    borderColor: withAlpha(palette.primary, borderOpacity),
    boxShadow: selected
      ? `0 0 0 1px ${withAlpha(palette.primary, 0.28)}, 0 16px 38px ${withAlpha(palette.primary, 0.22)}, inset 0 1px 0 rgba(255,255,255,0.1)`
      : `0 12px 30px rgba(0,0,0,0.24), inset 0 1px 0 rgba(255,255,255,0.07)`,
  };
}

export function ValueCardFace({
  card,
  accent,
  index,
  selected = false,
  variant = "selection",
  className = "",
}: {
  card: GameCard;
  accent: string;
  index?: number;
  selected?: boolean;
  variant?: "selection" | "result";
  className?: string;
}) {
  const palette = valueCardPalette(card.group, accent);
  const isResult = variant === "result";
  const surface = valueCardSurface(palette, selected);

  return (
    <div
      className={`group/card relative isolate flex h-full min-h-[150px] w-full overflow-hidden rounded-tile border text-left transition duration-300 hover:-translate-y-1 lg:min-h-[166px] ${
        isResult ? "min-h-[158px] lg:min-h-[178px]" : ""
      } ${className}`}
      style={surface}
    >
      <span
        aria-hidden
        className="pointer-events-none absolute -left-[42%] top-[-20%] h-[150%] w-[34%] rotate-[18deg] bg-gradient-to-r from-transparent via-white/[0.11] to-transparent opacity-0 blur-sm transition duration-700 group-hover/card:translate-x-[430%] group-hover/card:opacity-100"
      />
      <span aria-hidden className="pointer-events-none absolute inset-[7px] rounded-field border border-white/[0.07]" />
      <span
        aria-hidden
        className="pointer-events-none absolute right-[-22px] top-[-24px] h-24 w-24 rounded-full blur-2xl"
        style={{ background: withAlpha(palette.secondary, 0.16) }}
      />
      <span
        aria-hidden
        className="pointer-events-none absolute bottom-3 right-3 grid grid-cols-3 gap-1 opacity-30"
      >
        {[0, 1, 2, 3, 4, 5].map((dot) => (
          <span
            key={dot}
            className="h-[2px] w-[2px] rounded-full bg-white"
            style={{ opacity: 0.28 + dot * 0.1 }}
          />
        ))}
      </span>

      <div className={`relative z-10 flex w-full flex-col ${isResult ? "items-center justify-center px-3 py-4 text-center" : "justify-between p-3.5"}`}>
        <div className={`flex w-full items-center ${isResult ? "absolute inset-x-0 top-0 justify-center px-3 pt-3" : "justify-between"}`}>
          <span className="text-[7.5px] font-semibold tracking-[0.2em] text-white/38">
            {index === undefined ? "LIFE FOUNDATION" : `LIFE · ${String(index + 1).padStart(2, "0")}`}
          </span>
          {!isResult && (
            <span
              className="grid h-5 w-5 place-items-center rounded-full border text-micro font-bold transition"
              style={{
                color: selected ? "#fff" : withAlpha(palette.primary, 0.72),
                borderColor: withAlpha(palette.primary, selected ? 0.8 : 0.3),
                background: selected
                  ? `linear-gradient(135deg, ${palette.secondary}, ${palette.primary})`
                  : "rgba(255,255,255,0.035)",
              }}
            >
              {selected ? "✓" : "+"}
            </span>
          )}
        </div>

        <div className={isResult ? "mt-3 flex flex-col items-center" : "mt-3"}>
          <div
            className={`relative grid place-items-center rounded-field border ${
              isResult ? "h-14 w-14 lg:h-16 lg:w-16" : "h-11 w-11"
            }`}
            style={{
              color: palette.primary,
              borderColor: withAlpha(palette.primary, 0.36),
              background: `radial-gradient(circle, ${withAlpha(palette.primary, 0.2)}, ${withAlpha(palette.deep, 0.35)})`,
              boxShadow: `0 0 22px ${withAlpha(palette.primary, 0.16)}`,
            }}
          >
            <span className="absolute inset-[5px] rotate-45 rounded-[8px] border border-white/[0.07]" />
            <span className={isResult ? "text-[25px] lg:text-[29px]" : "text-[21px]"}>{card.glyph}</span>
          </div>
        </div>

        <div className="mt-3 w-full">
          <div className={`truncate font-semibold text-white ${isResult ? "text-footnote lg:text-callout" : "text-footnote"}`}>
            {card.name}
          </div>
          <div className="mt-1 flex items-center gap-1.5 text-micro text-white/42">
            <span className="h-px flex-1 bg-gradient-to-r from-transparent to-white/12" />
            <span className="truncate">{card.group}</span>
            <span className="h-px flex-1 bg-gradient-to-l from-transparent to-white/12" />
          </div>
        </div>
      </div>
    </div>
  );
}
