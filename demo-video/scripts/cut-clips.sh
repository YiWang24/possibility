#!/usr/bin/env bash
#
# Regenerate public/clips from the raw screen recording.
#
# The clips are deliberately NOT committed — they are ~50MB of derived media.
# This script is the reproducible bridge: point it at the recording and the
# project renders identically on any machine.
#
# Usage: scripts/cut-clips.sh /path/to/Feishu20260725-105403.mp4
#
# Source recording: iPhone capture, 1180x2556, 58fps VFR, silent audio track,
# 5m57s. Each clip is normalised to 30fps CFR with the (empty) audio stripped
# so one clip second maps to one composition second.

set -euo pipefail

SRC="${1:-}"
OUT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)/public/clips"
FPS=30
CRF=18

if [[ -z "$SRC" ]]; then
  echo "usage: $(basename "$0") <path-to-source-recording.mp4>" >&2
  exit 64
fi

if [[ ! -f "$SRC" ]]; then
  echo "error: source recording not found: $SRC" >&2
  exit 66
fi

if ! command -v ffmpeg >/dev/null 2>&1; then
  echo "error: ffmpeg is required but not on PATH" >&2
  exit 69
fi

# name  start(s)  duration(s)   — start is an offset into the source recording
CLIPS=(
  "01-question    340 12"
  "02-ai-chat       0 16"
  "03-lab-cards    28 26"
  "04-orb          62  6"
  "05-result-likely 148 11"
  "06-result-best  157 10"
  "07-crystal    204.5  4"
  "08-community    185 12"
  "09-jianning     164 12"
  "10-profile      211 12"
)

mkdir -p "$OUT_DIR"

for entry in "${CLIPS[@]}"; do
  read -r name start duration <<<"$entry"
  ffmpeg -v error -y \
    -ss "$start" -i "$SRC" -t "$duration" \
    -an -r "$FPS" \
    -c:v libx264 -crf "$CRF" -preset veryfast -pix_fmt yuv420p \
    "$OUT_DIR/$name.mp4"
  echo "  ✓ $name.mp4  (source ${start}s +${duration}s)"
done

echo
echo "Wrote ${#CLIPS[@]} clips to $OUT_DIR"
