import { Composition } from "remotion";
import {
  DemoVideo,
  durationFor,
  type DemoVideoProps,
} from "./kaleido/DemoVideo";
import { waitForFonts } from "./kaleido/fonts";

const FPS = 30;

/**
 * Three cuts off one edit decision list:
 *   KaleidoDemo         — 16:9 master for the site, deck and demo day
 *   KaleidoDemoVertical — the same edit, reframed 9:16
 *   KaleidoTeaser       — a shorter social cut, vertical only
 */
export function RemotionRoot() {
  return (
    <>
      <Composition
        id="KaleidoDemo"
        component={DemoVideo}
        width={1920}
        height={1080}
        fps={FPS}
        durationInFrames={durationFor("master", FPS)}
        defaultProps={{ variant: "master" } satisfies DemoVideoProps}
        calculateMetadata={metadataFor("master")}
      />
      <Composition
        id="KaleidoDemoVertical"
        component={DemoVideo}
        width={1080}
        height={1920}
        fps={FPS}
        durationInFrames={durationFor("master", FPS)}
        defaultProps={{ variant: "master" } satisfies DemoVideoProps}
        calculateMetadata={metadataFor("master")}
      />
      <Composition
        id="KaleidoTeaser"
        component={DemoVideo}
        width={1080}
        height={1920}
        fps={FPS}
        durationInFrames={durationFor("teaser", FPS)}
        defaultProps={{ variant: "teaser" } satisfies DemoVideoProps}
        calculateMetadata={metadataFor("teaser")}
      />
    </>
  );
}

/**
 * Block until the webfonts have loaded, otherwise the first frames render in
 * a fallback face and the text reflows mid-shot.
 */
function metadataFor(variant: DemoVideoProps["variant"]) {
  return async () => {
    await waitForFonts();
    return { durationInFrames: durationFor(variant, FPS) };
  };
}
