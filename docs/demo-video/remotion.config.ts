/**
 * Note: When using the Node.JS APIs, the config file
 * doesn't apply. Instead, pass options directly to the APIs.
 *
 * All configuration options: https://remotion.dev/docs/config
 */

import { Config } from "@remotion/cli/config";

// The source is a dark UI capture: PNG frames avoid the JPEG banding that
// shows up across the app's large gradient fields (orb, crystal, backdrop).
Config.setVideoImageFormat("png");
Config.setOverwriteOutput(true);
Config.setCodec("h264");
Config.setCrf(18);

// Each Chromium worker loads the two self-hosted fonts before rendering its
// first frame. Keep concurrency bounded so a cold render does not starve the
// local asset server, and leave enough time for slower CI machines.
Config.setConcurrency(4);
Config.setDelayRenderTimeoutInMilliseconds(120_000);
