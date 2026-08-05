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

# supabase CLI ≥2.110 从 --env-file /dev/stdin 读到的是空内容，直接报
# LegacySecretsNoArgumentsError；必须落成真实文件再传。文件只在内存盘之外存在几毫秒，
# 用 umask 077 + trap 保证它不会以可读权限留在磁盘上。
umask 077
ENV_FILE="$(mktemp -t doppler-sync)"
trap 'rm -f "$ENV_FILE"' EXIT

doppler secrets download --no-file --format env \
  --project possibility --config "$CONFIG" |
  grep -v -E '^(DOPPLER_|SUPABASE_)' > "$ENV_FILE"

# 空文件会把"同步成功"变成静默的 no-op，宁可在这里失败。
[ -s "$ENV_FILE" ] || { echo "✗ Doppler 未返回任何可同步的密钥" >&2; exit 1; }

$SUPABASE secrets set "${REF_ARGS[@]}" --env-file "$ENV_FILE"

echo "✓ Doppler possibility/$CONFIG → Supabase Edge Functions Secrets"
