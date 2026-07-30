#!/usr/bin/env bash
# 从 Supabase 生成各端类型：TS → packages/shared-types，Swift → ios/Possibility/Generated
# 用法：scripts/gen-types.sh [--linked]   默认 --local（需要 supabase start）
set -euo pipefail
cd "$(dirname "$0")/.."

SOURCE="${1:---local}"

npx supabase gen types --lang typescript "$SOURCE" > packages/shared-types/src/database.types.ts
echo "✓ packages/shared-types/src/database.types.ts"

mkdir -p ios/Possibility/Generated
npx supabase gen types --lang swift "$SOURCE" > ios/Possibility/Generated/Database.swift
echo "✓ ios/Possibility/Generated/Database.swift"
