import { AbsoluteFill, Sequence, useVideoConfig } from "remotion";
import { SceneView } from "./components/SceneView";
import {
  buildTimeline,
  masterScript,
  teaserScript,
  type Scene,
} from "./script";
import { motion, palette } from "./theme";

export type Variant = "master" | "teaser";

/**
 * A type alias rather than an interface on purpose: Remotion's `<Composition>`
 * constrains props to `Record<string, unknown>`, and interfaces do not pick up
 * the implicit index signature that makes them assignable to it.
 */
export type DemoVideoProps = {
  variant: Variant;
};

const scripts: Record<Variant, readonly Scene[]> = {
  master: masterScript,
  teaser: teaserScript,
};

/**
 * Assembles the film from the edit decision list. Nothing about the frame
 * size is decided here — `SceneView` resolves layout from the composition,
 * so the same variant renders correctly landscape or vertical.
 */
export function DemoVideo({ variant }: DemoVideoProps) {
  const { fps } = useVideoConfig();
  const { scenes } = buildTimeline(scripts[variant], fps, motion.crossfade);

  return (
    <AbsoluteFill style={{ backgroundColor: palette.ink }}>
      {scenes.map((scene) => (
        <Sequence
          key={scene.id}
          name={scene.id}
          from={scene.from}
          durationInFrames={scene.durationInFrames}
        >
          <SceneView scene={scene} />
        </Sequence>
      ))}
    </AbsoluteFill>
  );
}

export function durationFor(variant: Variant, fps: number): number {
  return buildTimeline(scripts[variant], fps, motion.crossfade).totalFrames;
}
