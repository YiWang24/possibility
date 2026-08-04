/**
 * Visual system for the KALEIDO demo video.
 *
 * Every colour here was sampled from the product's own screen recording
 * (ffmpeg palettegen over the orb / crystal / result frames) so the video
 * reads as part of the app rather than as a generic promo template.
 *
 * The two accents carry meaning and must not be used interchangeably:
 *   violet -> the AI half of the funnel (对话 · 推演 · 结果)
 *   cyan   -> the human half (同路人 · 社区 · 经验)
 * The switch between them is the narrative turn of the film.
 */

export const palette = {
  /** Near-black with a blue cast — the app's canvas. */
  ink: "#06080F",
  inkDeep: "#04050A",
  surface: "#12141A",
  surfaceRaised: "#171B26",
  hairline: "rgba(255, 255, 255, 0.09)",

  textPrimary: "#EDF0F7",
  textSecondary: "#97A1BA",
  textMuted: "#677593",

  violet: "#986EC2",
  violetLight: "#B79ADF",
  cyan: "#4DB0E1",
  cyanDeep: "#276DAF",
} as const;

export type AccentName = "violet" | "cyan";

export interface Accent {
  readonly base: string;
  readonly light: string;
}

export const accents: Record<AccentName, Accent> = {
  violet: { base: palette.violet, light: palette.violetLight },
  cyan: { base: palette.cyan, light: palette.cyanDeep },
};

/**
 * Type sizes are expressed for a 1920px-wide frame and scaled by the caller
 * via `scaleFor`, so the landscape and vertical cuts stay optically matched.
 */
export const type = {
  kicker: 23,
  kickerTracking: "0.3em",
  headline: 82,
  headlineLineHeight: 1.48,
  caption: 30,
} as const;

export const REFERENCE_WIDTH = 1920;

/** Scale the 1920px-referenced type ramp to the actual composition width. */
export function scaleFor(width: number): number {
  return width / REFERENCE_WIDTH;
}

export const motion = {
  /** Frames of overlap between adjacent scenes. */
  crossfade: 8,
  /** Frames a scene takes to settle its text. */
  textStagger: 5,
  damping: 200,
} as const;

/**
 * Source frames include the iOS status bar with a screen-recording dot.
 * Crop it away rather than covering it, in source pixels.
 */
export const capture = {
  width: 1180,
  height: 2556,
  cropTop: 108,
} as const;

export const visibleCaptureHeight = capture.height - capture.cropTop;
export const captureAspect = capture.width / visibleCaptureHeight;
