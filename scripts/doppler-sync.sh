#!/usr/bin/env bash
# 将 Doppler 中的服务端密钥单向同步到 Supabase Edge Functions Secrets
# 用法：scripts/doppler-sync.sh <stg|prd> [supabase-project-ref]
# 过滤 DOPPLER_* / SUPABASE_* 前缀（Supabase 禁止 SUPABASE_ 前缀，且客户端配置无需上传）
set -euo pipefail
cd "$(dirname "$0")/.."

CONFIG="${1:?用法: doppler-sync.sh <stg|prd> [project-ref]}"
PROJECT_REF="${2:-}"

REF_ARGS=()
if [ -n "$PROJECT_REF" ]; then
  REF_ARGS=(--project-ref "$PROJECT_REF")
fi

# CI 装的是 supabase 二进制；本地无全局安装时回退 npx
SUPABASE="supabase"
command -v supabase >/dev/null || SUPABASE="npx supabase"

doppler secrets download --no-file --format env \
  --project possibility --config "$CONFIG" |
  grep -v -E '^(DOPPLER_|SUPABASE_)' |
  $SUPABASE secrets set "${REF_ARGS[@]}" --env-file /dev/stdin

echo "✓ Doppler possibility/$CONFIG → Supabase Edge Functions Secrets"
