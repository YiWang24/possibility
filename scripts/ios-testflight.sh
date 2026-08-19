#!/usr/bin/env bash
#
# Possibility · iOS → TestFlight：归档 → 导出 → 上传
#
# 用法：
#   scripts/ios-testflight.sh                  # 全流程
#   BUILD_NUMBER=7 scripts/ios-testflight.sh   # 覆盖构建号（同版本号下必须唯一）
#   SKIP_UPLOAD=1 scripts/ios-testflight.sh    # 只产出 ipa
#
# 凭证（App Store Connect API Key，本地和 CI 同一套）：
#   ASC_KEY_ID / ASC_ISSUER_ID / ASC_KEY_PATH（默认 ~/.appstoreconnect/private_keys/AuthKey_$ASC_KEY_ID.p8）
# 没有 API Key 时：
#   - 归档/导出回落到 Xcode 已登录账号（只能在本机跑，CI 上必失败）
#   - 上传可改用 ASC_APPLE_ID / ASC_APP_PASSWORD（App 专用密码）
#   - 两者都没有则只产出 ipa，并提示改走 Xcode Organizer
#
# 前置见 ios/README.md「发布到 TestFlight」：Config.xcconfig 需先由 Doppler 生成；
# 团队里必须至少注册一台设备，否则归档拿不到开发描述文件。
#
set -euo pipefail
cd "$(dirname "$0")/.."
REPO="$PWD"

SCHEME=Possibility
TEAM_ID=985WPAR345
BUNDLE_ID=com.possibility.possibility
BUILD_DIR="${BUILD_DIR:-$REPO/ios/build}"
ARCHIVE="$BUILD_DIR/$SCHEME.xcarchive"
EXPORT_DIR="$BUILD_DIR/export"
IPA="$EXPORT_DIR/$SCHEME.ipa"

ASC_KEY_ID="${ASC_KEY_ID:-}"
ASC_ISSUER_ID="${ASC_ISSUER_ID:-}"
ASC_KEY_PATH="${ASC_KEY_PATH:-$HOME/.appstoreconnect/private_keys/AuthKey_${ASC_KEY_ID}.p8}"

log() { printf '\n\033[1;36m▸ %s\033[0m\n' "$*"; }
die() { printf '\n\033[1;31m✗ %s\033[0m\n' "$*" >&2; exit 1; }

# API Key 三件套齐了才用；缺任何一个都退回 Xcode 账号，不半途而废地传一半参数。
AUTH_ARGS=()
if [ -n "$ASC_KEY_ID" ] && [ -n "$ASC_ISSUER_ID" ] && [ -f "$ASC_KEY_PATH" ]; then
  AUTH_ARGS=(
    -authenticationKeyPath "$ASC_KEY_PATH"
    -authenticationKeyID "$ASC_KEY_ID"
    -authenticationKeyIssuerID "$ASC_ISSUER_ID"
  )
  log "签名凭证：App Store Connect API Key $ASC_KEY_ID"
else
  log "签名凭证：Xcode 已登录账号（未配 API Key —— CI 上会失败）"
fi

# 密钥文件缺失时 Supabase 回落到 AppConfig 内置值，PostHog/Sentry 直接不注册。
# 发上 TestFlight 的包没埋点等于线上瞎跑，所以出声而不是静默通过。
[ -f ios/Config/Config.xcconfig ] || cat <<'WARN' >&2

⚠ ios/Config/Config.xcconfig 不存在。
  Supabase 会回落到 AppConfig 内置的线上值（能跑），但 PostHog / Sentry 不会注册。
  先跑：doppler run --project possibility --config prd -- scripts/gen-xcconfig.sh

WARN

log "重新生成 Xcode 工程（project.yml 是唯一真相源）"
( cd ios && xcodegen generate )

log "归档 ${SCHEME}（Release）"
rm -rf "$ARCHIVE" "$EXPORT_DIR"
mkdir -p "$BUILD_DIR"
xcodebuild archive \
  -project ios/Possibility.xcodeproj \
  -scheme "$SCHEME" \
  -configuration Release \
  -destination 'generic/platform=iOS' \
  -archivePath "$ARCHIVE" \
  -allowProvisioningUpdates \
  "${AUTH_ARGS[@]}" \
  ${BUILD_NUMBER:+CURRENT_PROJECT_VERSION="$BUILD_NUMBER"}

log "导出 ipa（app-store-connect，此步才换上分发签名）"
xcodebuild -exportArchive \
  -archivePath "$ARCHIVE" \
  -exportOptionsPlist ios/ExportOptions.plist \
  -exportPath "$EXPORT_DIR" \
  -allowProvisioningUpdates \
  "${AUTH_ARGS[@]}"

[ -f "$IPA" ] || die "导出没产出 $IPA"
VERSION=$(/usr/libexec/PlistBuddy -c 'Print :ApplicationProperties:CFBundleShortVersionString' "$ARCHIVE/Info.plist")
BUILD=$(/usr/libexec/PlistBuddy -c 'Print :ApplicationProperties:CFBundleVersion' "$ARCHIVE/Info.plist")
log "已产出 ${IPA}（${BUNDLE_ID} ${VERSION} (${BUILD})）"

[ -n "${SKIP_UPLOAD:-}" ] && { echo "SKIP_UPLOAD 已设置，到此为止。"; exit 0; }

# ── 上传 ──────────────────────────────────────────────────────────────────────
if [ ${#AUTH_ARGS[@]} -gt 0 ]; then
  # altool 不接受任意路径，只在固定几个目录里按 AuthKey_<id>.p8 找；
  # API_PRIVATE_KEYS_DIR 是唯一能指定别处的开关。
  export API_PRIVATE_KEYS_DIR="$(dirname "$ASC_KEY_PATH")"
  log "上传 TestFlight（API Key ${ASC_KEY_ID}）"
  xcrun altool --upload-app -f "$IPA" -t ios \
    --apiKey "$ASC_KEY_ID" --apiIssuer "$ASC_ISSUER_ID"
elif [ -n "${ASC_APPLE_ID:-}" ] && [ -n "${ASC_APP_PASSWORD:-}" ]; then
  log "上传 TestFlight（Apple ID ${ASC_APPLE_ID}）"
  xcrun altool --upload-app -f "$IPA" -t ios \
    -u "$ASC_APPLE_ID" -p "$ASC_APP_PASSWORD"
else
  cat <<EOF

⚠ 没有上传凭证，ipa 已就绪但未上传：
    $IPA

  两条路任选：
    1. Xcode → Window → Organizer → 选中归档 → Distribute App → App Store Connect
       归档位置：$ARCHIVE
    2. 配好 ASC_KEY_ID / ASC_ISSUER_ID / ASC_KEY_PATH 后重跑本脚本

EOF
  exit 0
fi

log "上传完成。App Store Connect → TestFlight，处理完成（通常 5–30 分钟）后即可分发给测试员。"
