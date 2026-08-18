#!/usr/bin/env bash
# 打包三个小红书小工具 zip。
# 每个工具的 index.html 必须位于 zip 根目录，所以统一先在 dist/<tool>/ 组装完整目录，
# 再进入该目录打包其「内容」（zip -r ... .），而不是打包目录本身。
#
#   用法： ./build.sh            打包全部
#          ./build.sh holland   只打包指定工具

set -euo pipefail

ROOT="$(cd "$(dirname "$0")" && pwd)"
DIST="$ROOT/dist"

# 两个测评工具共用的运行时（含共享 index.html 外壳）
ASSESS_SHARED=(
  base.css
  assessment.css
  bridge.js
  ui.js
  share-card.js
  assessment-engine.js
  assessment-view.js
)

# 卡牌工具共用的运行时（不需要测评相关脚本）
CARDS_SHARED=(
  base.css
  bridge.js
  ui.js
  share-card.js
)

command -v zip >/dev/null 2>&1 || {
  echo "缺少 zip 命令，请先安装（Debian/Ubuntu: apt install zip）" >&2
  exit 1
}

# 组装一个测评工具：共享外壳 + 共享运行时 + 自己的 data.js / main.js
build_assessment() {
  local name="$1" title="$2"
  local out="$DIST/$name"

  mkdir -p "$out/assets"
  for f in "${ASSESS_SHARED[@]}"; do
    cp "$ROOT/shared/$f" "$out/assets/$f"
  done
  cp "$ROOT/$name/assets/data.js" "$out/assets/data.js"
  cp "$ROOT/$name/assets/main.js" "$out/assets/main.js"

  # 外壳是两个工具共用的，标题在打包时按工具替换
  sed "s|<title>.*</title>|<title>${title}</title>|" \
    "$ROOT/shared/assessment-index.html" > "$out/index.html"
}

# 组装卡牌工具：自带 index.html 与 cards.css / data.js / engine.js / view.js
build_cards() {
  local out="$DIST/cards"

  mkdir -p "$out/assets"
  for f in "${CARDS_SHARED[@]}"; do
    cp "$ROOT/shared/$f" "$out/assets/$f"
  done
  cp "$ROOT/cards/assets/"*.css "$ROOT/cards/assets/"*.js "$out/assets/"
  cp "$ROOT/cards/index.html" "$out/index.html"
}

# 打包并校验：index.html 在根、体积可控
pack() {
  local name="$1"
  local out="$DIST/$name"
  local zipfile="$DIST/$name.zip"

  [ -f "$out/index.html" ] || { echo "$name: 缺少 index.html" >&2; exit 1; }

  rm -f "$zipfile"
  # 必须 cd 进目录再打包 "."，否则解压后会多一层目录、容器找不到入口
  (cd "$out" && zip -rqX "$zipfile" . -x '*.DS_Store' '__MACOSX/*')

  unzip -l "$zipfile" | grep -q ' index.html$' || {
    echo "$name: index.html 不在 zip 根目录" >&2
    exit 1
  }

  local bytes
  bytes="$(wc -c < "$zipfile")"
  printf '  %-10s %7s KB  %s\n' "$name" "$((bytes / 1024))" "$zipfile"
  [ "$bytes" -le 10485760 ] || { echo "$name: 超过 10MB 上限" >&2; exit 1; }
}

build_one() {
  case "$1" in
    holland)  build_assessment holland "霍兰德职业兴趣 · 六边形" ;;
    strength) build_assessment strength "优势线索 · 找到你的擅长" ;;
    cards)    build_cards ;;
    *)        echo "未知工具：$1（可选 holland / strength / cards）" >&2; exit 1 ;;
  esac
  pack "$1"
}

if [ "$#" -eq 0 ]; then
  # 全量打包时先清空 dist，避免上一次残留的文件被打进新包
  rm -rf "$DIST"
  targets=(holland strength cards)
else
  targets=("$@")
fi
mkdir -p "$DIST"

echo "打包产物："
for t in "${targets[@]}"; do
  build_one "$t"
done
