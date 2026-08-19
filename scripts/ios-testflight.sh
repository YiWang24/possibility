#!/usr/bin/env bash
#
# Possibility · iOS → TestFlight 一键构建上传
#
# 用法：
#   scripts/ios-testflight.sh                  # 归档 + 导出 + 上传（构建号取 project.yml）
#   BUILD_NUMBER=7 scripts/ios-testflight.sh   # 覆盖构建号（TestFlight 要求同版本号下唯一）
#   SKIP_UPLOAD=1 scripts/ios-testflight.sh    # 只产出 ipa，不上传
#
# 上传凭证（二选一，都没有则跳过上传并提示改用 Xcode Organizer 手动传）：
#   A. App Store Connect API Key（推荐，可进 CI）：
#        ASC_KEY_ID / ASC_ISSUER_ID / ASC_KEY_PATH(.p8 路径)
#   B. Apple ID + App 专用密码（appleid.apple.com 生成）：
#        ASC_APPLE_ID / ASC_APP_PASSWORD
#
# 前置：Config.xcconfig 需先由 Doppler 生成 ——
#   doppler run --project possibility --config prd -- scripts/gen-xcconfig.sh
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

log() { printf '\n\033[1;36m▸ %s\033[0m\n' "$*"; }
die() { printf '\n\033[1;31m✗ %s\033[0m\n' "$*" >&2; exit 1; }

# ── 前置检查：密钥文件缺失时 Supabase 会回落到 AppConfig 内置值，PostHog/Sentry 直接不注册。
# 发到 TestFlight 的包没埋点等于线上瞎跑，所以这里出声而不是静默通过。
[ -f ios/Config/Config.xcconfig ] || cat <<'WARN' >&2

⚠ ios/Config/Config.xcconfig 不存在。
  Supabase 会回落到 AppConfig 内置的线上值（能跑），但 PostHog / Sentry 不会注册。
  先跑：doppler run --project possibility --config prd -- scripts/gen-xcconfig.sh

WARN

log "重新生成 Xcode 工程（project.yml 是唯一真相源）"
( cd ios && xcodegen generate )

log "归档 $SCHEME（Release）"
rm -rf "$ARCHIVE" "$EXPORT_DIR"
mkdir -p "$BUILD_DIR"
xcodebuild archive \
  -project ios/Possibility.xcodeproj \
  -scheme "$SCHEME" \
  -configuration Release \
  -destination 'generic/platform=iOS' \
  -archivePath "$ARCHIVE" \
  -allowProvisioningUpdates \
  ${BUILD_NUMBER:+CURRENT_PROJECT_VERSION="$BUILD_NUMBER"}

log "导出 ipa（app-store-connect）"
xcodebuild -exportArchive \
  -archivePath "$ARCHIVE" \
  -exportOptionsPlist ios/ExportOptions.plist \
  -exportPath "$EXPORT_DIR" \
  -allowProvisioningUpdates

[ -f "$IPA" ] || die "导出没产出 $IPA"
PLIST="$ARCHIVE/Info.plist"
VERSION=$(/usr/libexec/PlistBuddy -c 'Print :ApplicationProperties:CFBundleShortVersionString' "$PLIST")
BUILD=$(/usr/libexec/PlistBuddy -c 'Print :ApplicationProperties:CFBundleVersion' "$PLIST")
log "已产出 $IPA（$BUNDLE_ID $VERSION ($BUILD)）"

if [ -n "${SKIP_UPLOAD:-}" ]; then
  echo "SKIP_UPLOAD 已设置，到此为止。"
  exit 0
fi

# ── 上传 ──────────────────────────────────────────────────────────────────────
if [ -n "${ASC_KEY_ID:-}" ] && [ -n "${ASC_ISSUER_ID:-}" ] && [ -n "${ASC_KEY_PATH:-}" ]; then
  [ -f "$ASC_KEY_PATH" ] || die "ASC_KEY_PATH 指向的 .p8 不存在：$ASC_KEY_PATH"
  # altool 只认 ~/.appstoreconnect/private_keys 或 --apiKey 搭配 API_PRIVATE_KEYS_DIR
  export API_PRIVATE_KEYS_DIR
  API_PRIVATE_KEYS_DIR="$(dirname "$ASC_KEY_PATH")"
  log "上传 TestFlight（API Key $ASC_KEY_ID）"
  xcrun altool --upload-app -f "$IPA" -t ios \
    --apiKey "$ASC_KEY_ID" --apiIssuer "$ASC_ISSUER_ID"
elif [ -n "${ASC_APPLE_ID:-}" ] && [ -n "${ASC_APP_PASSWORD:-}" ]; then
  log "上传 TestFlight（Apple ID $ASC_APPLE_ID）"
  xcrun altool --upload-app -f "$IPA" -t ios \
    -u "$ASC_APPLE_ID" -p "$ASC_APP_PASSWORD"
else
  cat <<EOF

⚠ 没有上传凭证，ipa 已就绪但未上传：
    $IPA

  三条路任选：
    1. Xcode → Window → Organizer → 选中归档 → Distribute App → App Store Connect
       归档位置：$ARCHIVE
    2. 配 API Key 后重跑：
       ASC_KEY_ID=xxx ASC_ISSUER_ID=xxx ASC_KEY_PATH=~/AuthKey_xxx.p8 scripts/ios-testflight.sh
    3. 配 App 专用密码后重跑：
       ASC_APPLE_ID=you@example.com ASC_APP_PASSWORD=xxxx-xxxx-xxxx-xxxx scripts/ios-testflight.sh

EOF
  exit 0
fi

log "上传完成。App Store Connect → TestFlight，等处理完成（通常 5–30 分钟）后分发给测试员。"
