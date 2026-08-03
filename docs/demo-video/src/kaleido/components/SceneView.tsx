import {
  AbsoluteFill,
  interpolate,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { accents, motion } from "../theme";
import { resolveLayout } from "../layout";
import type { PlacedScene } from "../script";
import { Backdrop } from "./Backdrop";
import { DeviceScreen } from "./DeviceScreen";
import { Statement } from "./Statement";

interface SceneViewProps {
  scene: PlacedScene;
}

export function SceneView({ scene }: SceneViewProps) {
  const frame = useCurrentFrame();
  const { width, height, durationInFrames } = useVideoConfig();

  const accent = accents[scene.accent];
  const showDevice = Boolean(scene.clip);
  const layout = resolveLayout({
    width,
    height,
    showDevice,
    emphasis: Boolean(scene.emphasis),
    flip: Boolean(scene.flip),
  });

  // Scenes overlap by `crossfade` frames, so fading both ends dissolves
  // cleanly into the neighbour without a black flash between them.
  const fade = interpolate(
    frame,
    [
      0,
      motion.crossfade,
      durationInFrames - motion.crossfade,
      durationInFrames,
    ],
    [0, 1, 1, 0],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
  );

  return (
    <AbsoluteFill style={{ opacity: fade }}>
      {/* Anchor the bloom behind the device so the glow reads as screen light. */}
      <Backdrop
        accent={accent}
        glowOnLeft={showDevice ? Boolean(scene.flip) : false}
      />

      {scene.clip && layout.device ? (
        <DeviceScreen
          clip={scene.clip}
          trim={scene.trim ?? 0}
          box={layout.device}
          accent={accent}
        />
      ) : null}

      <Statement
        kicker={scene.kicker}
        lines={scene.lines}
        accent={accent}
        box={layout.text}
        headlineSize={layout.headlineSize}
      />
    </AbsoluteFill>
  );
}
