import { loadFont } from "@remotion/fonts";
import { staticFile } from "remotion";

/**
 * A deliberate two-family pairing rather than one do-everything face:
 * Inter carries the tracked-out Latin micro-labels the app already uses
 * (LIKELY / KALEIDOSCOPE / SYNCED LIVE FORM), while Noto Sans CJK Light
 * carries the Chinese statements at editorial weight.
 *
 * Both faces are self-hosted. Nothing here touches the network at render
 * time, and that is the whole point: web-served fonts cost one request per
 * unicode-range chunk (~98 for CJK), any one of which failing kills the frame
 * being rendered. On a flaky connection that lost roughly a third of renders.
 *
 * Regenerate after changing copy: `npm run font` (see scripts/build-font.py).
 */

const LATIN_FAMILY = "Kaleido Latin";
const HAN_FAMILY = "Kaleido Han";

/** Locally installed faces, so a missing glyph degrades instead of tofu-ing. */
const HAN_FALLBACK = '"Noto Sans CJK SC", "Source Han Sans SC", "PingFang SC"';

const latin = loadFont({
  family: LATIN_FAMILY,
  url: staticFile("fonts/inter-latin.woff2"),
  format: "woff2",
  // Inter ships as a variable font; declare the full axis so the browser
  // interpolates rather than synthesising a faux weight.
  weight: "100 900",
});

const han = loadFont({
  family: HAN_FAMILY,
  url: staticFile("fonts/kaleido-han.woff2"),
  format: "woff2",
  weight: "300",
});

export const latinFamily = `"${LATIN_FAMILY}", system-ui, sans-serif`;

export const hanFamily = `"${HAN_FAMILY}", "${LATIN_FAMILY}", ${HAN_FALLBACK}, sans-serif`;

/** Await in `calculateMetadata` so no frame renders with a fallback face. */
export function waitForFonts(): Promise<unknown> {
  return Promise.all([latin, han]);
}
