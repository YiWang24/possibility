import {
  AbsoluteFill,
  useCurrentFrame,
  useVideoConfig,
  interpolate,
} from "remotion";
import { palette, type Accent } from "../theme";

interface BackdropProps {
  accent: Accent;
  /** Anchor the glow away from the statement so text keeps its contrast. */
  glowOnLeft: boolean;
}

/**
 * Base canvas: the app's near-black, one soft accent bloom, and a vignette.
 * The bloom is a radial gradient rather than a blurred shape so rendering
 * stays cheap, and it only ever moves via transform.
 */
export function Backdrop({ accent, glowOnLeft }: BackdropProps) {
  const frame = useCurrentFrame();
  const { width, height, durationInFrames } = useVideoConfig();

  const drift = interpolate(frame, [0, durationInFrames], [0, 1], {
    extrapolateRight: "clamp",
  });
  const bloom = Math.max(width, height) * 1.05;

  return (
    <AbsoluteFill style={{ backgroundColor: palette.ink }}>
      <div
        style={{
          position: "absolute",
          width: bloom,
          height: bloom,
          left: glowOnLeft ? -bloom * 0.3 : width - bloom * 0.7,
          top: -bloom * 0.22,
          background: `radial-gradient(circle at center, ${accent.base}42 0%, ${accent.base}12 38%, transparent 68%)`,
          transform: `translateY(${drift * 34 - 17}px) scale(${1 + drift * 0.05})`,
        }}
      />
      <AbsoluteFill
        style={{
          background: `radial-gradient(ellipse at 50% 45%, transparent 30%, ${palette.inkDeep}cc 100%)`,
        }}
      />
    </AbsoluteFill>
  );
}
