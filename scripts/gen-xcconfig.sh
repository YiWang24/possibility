#!/usr/bin/env bash
# 由 Doppler 注入的环境变量生成 ios/Config/Config.xcconfig（gitignore，不进仓库）
# 用法：doppler run -- scripts/gen-xcconfig.sh
set -euo pipefail
cd "$(dirname "$0")/.."

: "${SUPABASE_URL:?需要 SUPABASE_URL（用 doppler run -- 执行本脚本）}"
: "${SUPABASE_ANON_KEY:?需要 SUPABASE_ANON_KEY}"

# xcconfig 中 // 是注释，URL 需转义为 /$()/
ESCAPED_URL="${SUPABASE_URL//\/\///\$()/}"

cat > ios/Config/Config.xcconfig <<EOF
// 本文件由 scripts/gen-xcconfig.sh 生成，请勿手改；来源：Doppler possibility/${DOPPLER_CONFIG:-?}
SUPABASE_URL = ${ESCAPED_URL}
SUPABASE_ANON_KEY = ${SUPABASE_ANON_KEY}
EOF

echo "✓ ios/Config/Config.xcconfig（Doppler ${DOPPLER_CONFIG:-?}）"
