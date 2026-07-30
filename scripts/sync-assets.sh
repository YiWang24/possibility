#!/usr/bin/env bash
# 把 docs/design/assets 下的图片母版分发到各消费端。
#
# 为什么要复制而不是共用一份：Xcode 的 .xcassets 必须是目录内的真实文件（imageset +
# Contents.json），静态托管（GitHub Pages / Netlify）默认也不跟随符号链接。所以母版留一份在
# docs/design/assets/，其余都是由本脚本生成的副本 —— 改图只改母版，然后跑一次本脚本。
#
# 用法：bash scripts/sync-assets.sh [--check]
#   无参数  写入副本
#   --check 只比对不写入，有漂移则以非 0 退出（可挂 CI）

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_ROOT"

SRC_AVATARS="docs/design/assets/community-avatars"
IOS_XCASSETS="ios/Possibility/Resources/Assets.xcassets"
WEB_AVATARS="web/assets/community-avatars"

CHECK_ONLY=0
[[ "${1:-}" == "--check" ]] && CHECK_ONLY=1

drift=0
copied=0

# 复制 src -> dst；--check 模式下只报告差异。
sync_file() {
  local src="$1" dst="$2"
  if [[ -f "$dst" ]] && cmp -s "$src" "$dst"; then
    return 0
  fi
  if (( CHECK_ONLY )); then
    echo "漂移: $dst 与母版 $src 不一致"
    drift=1
    return 0
  fi
  mkdir -p "$(dirname "$dst")"
  cp "$src" "$dst"
  copied=$((copied + 1))
}

if [[ ! -d "$SRC_AVATARS" ]]; then
  echo "找不到母版目录 $SRC_AVATARS" >&2
  exit 1
fi

for src in "$SRC_AVATARS"/*.png; do
  name="$(basename "$src" .png)"        # avatar-01

  # iOS：每张图一个 imageset，Contents.json 缺失时按 universal 单尺寸补齐
  imageset="$IOS_XCASSETS/$name.imageset"
  sync_file "$src" "$imageset/$name.png"
  if [[ ! -f "$imageset/Contents.json" ]]; then
    if (( CHECK_ONLY )); then
      echo "缺失: $imageset/Contents.json"
      drift=1
    else
      cat > "$imageset/Contents.json" <<JSON
{
  "images" : [
    {
      "filename" : "$name.png",
      "idiom" : "universal"
    }
  ],
  "info" : {
    "author" : "xcode",
    "version" : 1
  }
}
JSON
    fi
  fi

  # web：静态站直接按文件名引用
  sync_file "$src" "$WEB_AVATARS/$name.png"
done

if (( CHECK_ONLY )); then
  if (( drift )); then
    echo "副本与 docs/design/assets 母版不同步，跑 bash scripts/sync-assets.sh 修复。" >&2
    exit 1
  fi
  echo "副本与母版一致。"
else
  echo "同步完成，写入 ${copied} 个文件（母版 ${SRC_AVATARS}）。"
fi
