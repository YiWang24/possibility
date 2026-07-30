#!/bin/bash
# 渲染 src/*.html -> out/*.png，2x 高清
CHROME="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
DIR="$(cd "$(dirname "$0")" && pwd)"
render(){ # name W H
  "$CHROME" --headless --disable-gpu --no-sandbox --hide-scrollbars \
    --force-device-scale-factor=2 --window-size=$2,$3 \
    --virtual-time-budget=2000 \
    --screenshot="$DIR/out/$1.png" "$DIR/src/$1.html" >/dev/null 2>&1
  echo "  out/$1.png  ($(( $2*2 ))x$(( $3*2 )))  $(du -h "$DIR/out/$1.png"|cut -f1)"
}
[ -n "$1" ] && { render "$1" "$2" "$3"; exit; }
render main 1080 1620
render feature-know 1080 1620
render feature-lab 1080 1620
render feature-community 1080 1620
render easel 800 2000
