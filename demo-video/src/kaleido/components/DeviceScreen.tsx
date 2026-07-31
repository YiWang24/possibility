import {
  OffthreadVideo,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
  interpolate,
} from "remotion";
import { capture, palette, type Accent } from "../theme";
import type { DeviceBox } from "../layout";

interface DeviceScreenProps {
  clip: string;
  /** In-point within the clip, in seconds. */
  trim: number;
  box: DeviceBox;
  accent: Accent;
}

/**
 * The capture, cropped and framed.
 *
 * The recording carries an iOS status bar with a live screen-recording dot,
 * so the top `capture.cropTop` source pixels are cropped away by oversizing
 * the video and clipping it, rather than covered with a patch.
 */
export function DeviceScreen({ clip, trim, box, accent }: DeviceScreenProps) {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();

  // Oversize so that the *visible* region exactly fills the device box.
  const videoWidth = box.width;
  const videoHeight = videoWidth * (capture.height / capture.width);
  const videoTop = -videoWidth * (capture.cropTop / capture.width);

  const settle = interpolate(frame, [0, 14], [1.012, 1], {
    extrapolateRight: "clamp",
  });
  const breathe = interpolate(frame, [0, durationInFrames], [0, 0.018], {
    extrapolateRight: "clamp",
  });

  return (
    <div
      style={{
        position: "absolute",
        left: box.left,
        top: box.top,
        width: box.width,
        height: box.height,
        borderRadius: box.radius,
        overflow: "hidden",
        transform: `scale(${settle + breathe})`,
        backgroundColor: palette.inkDeep,
        border: box.framed ? `1px solid ${palette.hairline}` : undefined,
        boxShadow: box.framed
          ? `0 40px 120px -30px ${palette.inkDeep}, 0 0 90px -20px ${accent.base}55`
          : undefined,
      }}
    >
      <OffthreadVideo
        src={staticFile(`clips/${clip}`)}
        trimBefore={Math.round(trim * fps)}
        muted
        style={{
          position: "absolute",
          left: 0,
          top: videoTop,
          width: videoWidth,
          height: videoHeight,
        }}
      />
      {box.framed ? <ScreenSheen radius={box.radius} /> : null}
    </div>
  );
}

/** A single diagonal highlight so the glass reads as glass, not as a rectangle. */
function ScreenSheen({ radius }: { radius: number }) {
  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        borderRadius: radius,
        background:
          "linear-gradient(148deg, rgba(255,255,255,0.07) 0%, rgba(255,255,255,0) 34%)",
        pointerEvents: "none",
      }}
    />
  );
}
