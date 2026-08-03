import { spring, useCurrentFrame, useVideoConfig } from "remotion";
import { hanFamily, latinFamily } from "../fonts";
import { motion, palette, type, type Accent } from "../theme";
import type { TextBox } from "../layout";

interface StatementProps {
  kicker?: string;
  lines?: readonly string[];
  accent: Accent;
  box: TextBox;
  /** Resolved by `layout`, which owns every sizing decision. */
  headlineSize: number;
}

/**
 * A tracked-out Latin label over a light-weight Chinese statement — the same
 * pairing the app uses for LIKELY / KALEIDOSCOPE / SYNCED LIVE FORM.
 *
 * Lines reveal in sequence so the frame is never a wall of text, and each one
 * animates from its own layout slot (opacity + translate only).
 */
export function Statement({
  kicker,
  lines,
  accent,
  box,
  headlineSize,
}: StatementProps) {
  // Everything else in the block is proportional to the headline.
  const scale = headlineSize / type.headline;

  return (
    <div
      style={{
        position: "absolute",
        left: box.left,
        top: box.top,
        width: box.width,
        height: box.height,
        display: "flex",
        flexDirection: "column",
        justifyContent: box.justify,
        alignItems: "flex-start",
        gap: headlineSize * 0.42,
      }}
    >
      {box.scrim ? <Scrim /> : null}
      {kicker ? <Kicker text={kicker} accent={accent} scale={scale} /> : null}
      {lines && lines.length > 0 ? (
        <div style={{ position: "relative" }}>
          {lines.map((line, index) => (
            <Line
              key={line}
              text={line}
              delay={motion.textStagger * (index + 1) + 3}
              size={headlineSize}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}

function Kicker({
  text,
  accent,
  scale,
}: {
  text: string;
  accent: Accent;
  scale: number;
}) {
  const reveal = useReveal(0);

  return (
    <div
      style={{
        position: "relative",
        display: "flex",
        flexDirection: "column",
        gap: 18 * scale,
        opacity: reveal.opacity,
        transform: `translateY(${reveal.offset}px)`,
      }}
    >
      <div
        style={{ width: 54 * scale, height: 2, backgroundColor: accent.base }}
      />
      <span
        style={{
          fontFamily: latinFamily,
          fontWeight: 500,
          fontSize: type.kicker * scale,
          letterSpacing: type.kickerTracking,
          textTransform: "uppercase",
          color: accent.base,
        }}
      >
        {text}
      </span>
    </div>
  );
}

function Line({
  text,
  delay,
  size,
}: {
  text: string;
  delay: number;
  size: number;
}) {
  const reveal = useReveal(delay);

  return (
    <div
      style={{
        fontFamily: hanFamily,
        fontWeight: 300,
        fontSize: size,
        lineHeight: type.headlineLineHeight,
        letterSpacing: "0.02em",
        color: palette.textPrimary,
        opacity: reveal.opacity,
        transform: `translateY(${reveal.offset}px)`,
      }}
    >
      {text}
    </div>
  );
}

interface Reveal {
  opacity: number;
  offset: number;
}

function useReveal(delay: number): Reveal {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const progress = spring({
    frame: frame - delay,
    fps,
    config: { damping: motion.damping },
    durationInFrames: 26,
  });

  return { opacity: progress, offset: (1 - progress) * 26 };
}

/**
 * Keeps the statement legible over a busy screen recording.
 *
 * It has to reach full opacity *above* the first line, not merely dim the UI:
 * a half-dimmed card edge running behind a headline reads as a mistake, while
 * a solid band reads as a deliberate caption zone.
 */
function Scrim() {
  return (
    <div
      style={{
        position: "absolute",
        left: "-8%",
        right: "-8%",
        top: "-52%",
        bottom: "-40%",
        background: `linear-gradient(to bottom, transparent 0%, ${palette.inkDeep}c4 26%, ${palette.inkDeep} 52%, ${palette.inkDeep} 100%)`,
        pointerEvents: "none",
      }}
    />
  );
}
