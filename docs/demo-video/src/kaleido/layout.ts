import { captureAspect } from "./theme";

/**
 * Layout is resolved from the composition size rather than hardcoded per
 * scene, so one script drives both the landscape master and the vertical cut.
 *
 * Landscape frames the capture as a device on one side with the statement on
 * the other. Vertical drops the device entirely — a 9:19.5 screen inside a
 * 9:16 frame can be either large or captioned, not both — and instead runs the
 * capture full-bleed with the statement over a scrim.
 */

export type Format = "landscape" | "vertical";

export interface DeviceBox {
  readonly width: number;
  readonly height: number;
  readonly left: number;
  readonly top: number;
  readonly radius: number;
  /** Whether to draw the bezel, hairline and glow. */
  readonly framed: boolean;
}

export interface TextBox {
  readonly left: number;
  readonly top: number;
  readonly width: number;
  readonly height: number;
  readonly justify: "center" | "flex-end";
  /** Vertical cuts need a scrim so the statement survives a busy screen. */
  readonly scrim: boolean;
}

export interface Layout {
  readonly format: Format;
  readonly device: DeviceBox | null;
  readonly text: TextBox;
  /**
   * Headline size in px. Fixed per format rather than derived from the text
   * column, so type stays the same size across every scene — a column that
   * narrows when the device grows must not shrink the headline with it.
   */
  readonly headlineSize: number;
}

export interface LayoutRequest {
  readonly width: number;
  readonly height: number;
  readonly showDevice: boolean;
  readonly emphasis: boolean;
  readonly flip: boolean;
}

/**
 * Headline size as a fraction of frame width. Vertical needs a much larger
 * fraction: the frame is narrower but the text still has to read on a phone
 * held at arm's length.
 */
const HEADLINE_RATIO = {
  landscape: { withDevice: 0.05, titleOnly: 0.06 },
  vertical: { withDevice: 0.078, titleOnly: 0.092 },
} as const;

export function formatOf(width: number, height: number): Format {
  return height > width ? "vertical" : "landscape";
}

function headlineSizeFor(
  format: Format,
  width: number,
  showDevice: boolean,
): number {
  const ratio = HEADLINE_RATIO[format];
  return Math.round(width * (showDevice ? ratio.withDevice : ratio.titleOnly));
}

export function resolveLayout(req: LayoutRequest): Layout {
  const format = formatOf(req.width, req.height);
  return format === "vertical" ? verticalLayout(req) : landscapeLayout(req);
}

function landscapeLayout(req: LayoutRequest): Layout {
  const { width, height, showDevice, emphasis, flip } = req;
  const margin = Math.round(width * 0.078);

  if (!showDevice) {
    return {
      format: "landscape",
      device: null,
      headlineSize: headlineSizeFor("landscape", width, false),
      text: {
        left: Math.round(width * 0.104),
        top: 0,
        width: Math.round(width * 0.68),
        height,
        justify: "center",
        scrim: false,
      },
    };
  }

  const deviceHeight = Math.round(height * (emphasis ? 1.195 : 0.907));
  const deviceWidth = Math.round(deviceHeight * captureAspect);
  const gutter = Math.round(width * 0.057);
  const deviceLeft = flip ? margin : width - margin - deviceWidth;
  const textLeft = flip ? deviceLeft + deviceWidth + gutter : margin;
  const textRight = flip ? width - margin : deviceLeft - gutter;

  return {
    format: "landscape",
    headlineSize: headlineSizeFor("landscape", width, true),
    device: {
      width: deviceWidth,
      height: deviceHeight,
      left: deviceLeft,
      top: Math.round((height - deviceHeight) / 2),
      radius: Math.round(width * 0.024),
      framed: true,
    },
    text: {
      left: textLeft,
      top: 0,
      width: Math.max(0, textRight - textLeft),
      height,
      justify: "center",
      scrim: false,
    },
  };
}

function verticalLayout(req: LayoutRequest): Layout {
  const { width, height, showDevice } = req;
  const margin = Math.round(width * 0.067);

  if (!showDevice) {
    return {
      format: "vertical",
      device: null,
      headlineSize: headlineSizeFor("vertical", width, false),
      text: {
        left: margin,
        top: 0,
        width: width - margin * 2,
        height,
        justify: "center",
        scrim: false,
      },
    };
  }

  const deviceHeight = Math.round(width / captureAspect);
  // Take the overflow mostly off the bottom: that strip sits under the scrim
  // anyway, whereas cropping the top would decapitate each screen's header.
  const overflow = deviceHeight - height;

  return {
    format: "vertical",
    headlineSize: headlineSizeFor("vertical", width, true),
    device: {
      width,
      height: deviceHeight,
      left: 0,
      top: -Math.round(overflow * 0.25),
      radius: 0,
      framed: false,
    },
    text: {
      left: margin,
      top: Math.round(height * 0.6),
      width: width - margin * 2,
      height: Math.round(height * 0.4) - margin,
      justify: "flex-end",
      scrim: true,
    },
  };
}
