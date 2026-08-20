#!/bin/bash
# possibility-mark.svg / possibility-social-preview.svg → 各尺寸 PNG。
# 与 docs/marketing/posters/render.sh 同套路：不装任何依赖，直接用本机 Chrome 截图。
# 换标记时只改 SVG 母版，然后跑一次这个脚本。
set -e
CHROME="${CHROME:-/Applications/Google Chrome.app/Contents/MacOS/Google Chrome}"
DIR="$(cd "$(dirname "$0")" && pwd)"
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

shot(){ # svg W H out
  # 包一层 HTML 是为了去掉 body 的 8px 边距，并把 SVG 拉到精确像素尺寸——
  # Chrome 直接开 SVG 会按 intrinsic size 渲染并留白，截出来是偏的。
  cat > "$TMP/page.html" <<HTML
<style>html,body{margin:0;padding:0}img{display:block;width:${2}px;height:${3}px}</style>
<img src="file://$DIR/$1">
HTML
  "$CHROME" --headless --disable-gpu --no-sandbox --hide-scrollbars \
    --allow-file-access-from-files --force-device-scale-factor=1 \
    --window-size="$2,$3" --screenshot="$DIR/$4" "$TMP/page.html" >/dev/null 2>&1
  echo "  $4  ($2×$3)  $(du -h "$DIR/$4" | cut -f1)"
}

shot possibility-mark.svg           1024 1024 possibility-mark-1024.png
shot possibility-mark.svg            512  512 possibility-mark-512.png
shot possibility-mark.svg            256  256 possibility-mark-256.png
shot possibility-mark.svg             32   32 possibility-mark-32.png
shot possibility-social-preview.svg 1280  640 possibility-social-preview.png

for f in "$DIR"/candidates/*.svg; do
  shot "candidates/$(basename "$f")" 512 512 "candidates/$(basename "${f%.svg}").png"
done

# 有些 Chromium 构建的新版 headless 会把视口截矮一截（底部留白）。
# 出图明显不对时改指 headless_shell：
#   CHROME=/path/to/headless_shell ./render.sh
