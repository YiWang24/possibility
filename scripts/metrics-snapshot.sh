#!/usr/bin/env bash
# metrics-snapshot.sh — 拉取 Supabase 自带 Prometheus 指标端点，打印关键 gauge。
#
# 0 成本平台巡检：不接 Grafana / Datadog，直接 curl 项目自带的 Metrics API，抓一份
# CPU / 连接数 / 磁盘 / 内存 快照。适合本地或 CI 里按需体检；要长期趋势和告警时，
# 再把同一个端点接进 Grafana Cloud 免费档即可（本脚本无需改动）。
#
# 用法：
#   SUPABASE_PROJECT_REF=xxxx SUPABASE_METRICS_KEY=sb_secret_xxx bash scripts/metrics-snapshot.sh
#   bash scripts/metrics-snapshot.sh --ref xxxx --key sb_secret_xxx
#   doppler run -- bash scripts/metrics-snapshot.sh        # 若已用 Doppler 注入上述变量
#
# 鉴权（见 Metrics API 文档）：HTTP Basic Auth，用户名固定 service_role，
# 密码是一个 Secret API key（sb_secret_...，在 Project Settings → API Keys 生成）。
# 建议把它作为 SUPABASE_METRICS_KEY 存入密钥管理（如 Doppler），不要写进仓库。
set -euo pipefail

REF="${SUPABASE_PROJECT_REF:-}"
KEY="${SUPABASE_METRICS_KEY:-}"

while [[ $# -gt 0 ]]; do
  case "$1" in
    --ref) REF="$2"; shift 2 ;;
    --key) KEY="$2"; shift 2 ;;
    -h|--help)
      grep '^#' "$0" | grep -v '^#!' | sed 's/^# \{0,1\}//'
      exit 0 ;;
    *) echo "未知参数：$1（用 --help 查看用法）" >&2; exit 2 ;;
  esac
done

if [[ -z "$REF" || -z "$KEY" ]]; then
  echo "错误：需要 project ref 与 secret key。" >&2
  echo "  设 SUPABASE_PROJECT_REF / SUPABASE_METRICS_KEY，或传 --ref / --key。" >&2
  exit 2
fi

URL="https://${REF}.supabase.co/customer/v1/privileged/metrics"

# -f 让 HTTP 错误码变成非零退出；单独抓 4xx 给出更清楚的提示（最常见是 key 不对）。
HTTP_CODE=$(curl -s -o /tmp/sb-metrics.$$ -w '%{http_code}' \
  --user "service_role:${KEY}" "$URL" || true)

if [[ "$HTTP_CODE" == "401" || "$HTTP_CODE" == "403" ]]; then
  rm -f "/tmp/sb-metrics.$$"
  echo "鉴权失败（HTTP ${HTTP_CODE}）：用户名须为 service_role，密码须为 Secret API key（sb_secret_...）。" >&2
  exit 1
fi
if [[ "$HTTP_CODE" != "200" ]]; then
  rm -f "/tmp/sb-metrics.$$"
  echo "拉取失败（HTTP ${HTTP_CODE}）：确认 project ref 是否正确、项目是否在线。" >&2
  exit 1
fi

echo "== Supabase 指标快照  项目 ${REF}  $(date '+%Y-%m-%d %H:%M:%S') =="
echo

# 只挑一小组能一眼看懂健康度的 gauge。端点约有 200 个序列，全打出来没法看；
# 需要别的指标时按名字补进下面的正则即可（先跑 `grep -E '^# HELP' /tmp/sb-metrics.$$`
# 看有哪些）。这里匹配指标名前缀，忽略 # HELP/# TYPE 注释行。
grep -E '^(node_cpu_seconds_total|node_load1|node_memory_MemAvailable_bytes|node_memory_MemTotal_bytes|node_filesystem_avail_bytes|node_filesystem_size_bytes|pg_stat_database_num_backends|pg_settings_max_connections|pg_database_size_bytes)[ {]' \
  "/tmp/sb-metrics.$$" || echo "（未匹配到预设 gauge——端点指标名可能已调整，见脚本内注释自查）"

rm -f "/tmp/sb-metrics.$$"
