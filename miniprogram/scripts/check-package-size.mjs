#!/usr/bin/env node
/**
 * 包体护栏 —— 对应 web 的 `web/scripts/check-design-tokens.mjs`，在 CI 里拦住体积回归。
 *
 * 微信的硬限制：单个分包 ≤ 2MB，所有分包总和 ≤ 20MB。主包超限是提审时才会暴露的问题，
 * 那时候再回头拆分包代价很大，所以在 CI 里就卡住。
 *
 * 注意这里量的是**源文件原始体积之和**，比微信实际统计的编译后体积偏大（微信会压缩、
 * 剔除未引用文件）。所以阈值留了余量：主包 1.6MB 告警、2MB 失败。
 */

import { readdirSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = join(fileURLToPath(new URL('.', import.meta.url)), '..', 'src')

const LIMIT_BYTES = 2 * 1024 * 1024
const WARN_BYTES = 1.6 * 1024 * 1024
const TOTAL_LIMIT_BYTES = 20 * 1024 * 1024

/** 不计入包体的文件 */
const IGNORED = new Set(['.DS_Store'])

function walk(dir) {
  const out = []
  for (const name of readdirSync(dir)) {
    if (IGNORED.has(name)) continue
    const full = join(dir, name)
    const st = statSync(full)
    if (st.isDirectory()) out.push(...walk(full))
    else out.push({ path: full, size: st.size })
  }
  return out
}

function human(bytes) {
  return `${(bytes / 1024).toFixed(1)} KB`
}

const files = walk(ROOT)

/** 分包名 → 字节数；主包用 '(主包)' */
const buckets = new Map()
for (const file of files) {
  const rel = relative(ROOT, file.path)
  const parts = rel.split('/')
  const bucket = parts[0] === 'subpkg' ? `subpkg/${parts[1]}` : '(主包)'
  buckets.set(bucket, (buckets.get(bucket) ?? 0) + file.size)
}

const rows = [...buckets.entries()].sort((a, b) => b[1] - a[1])
const total = rows.reduce((sum, [, size]) => sum + size, 0)

console.log('包体统计（源文件原始体积，实际编译后会更小）\n')
let failed = false

for (const [name, size] of rows) {
  let mark = '  '
  if (size > LIMIT_BYTES) {
    mark = '✗ '
    failed = true
  } else if (size > WARN_BYTES) {
    mark = '! '
  }
  console.log(`${mark}${name.padEnd(24)} ${human(size).padStart(12)}`)
}

console.log(`\n  ${'总计'.padEnd(23)} ${human(total).padStart(12)}`)

if (total > TOTAL_LIMIT_BYTES) {
  console.error(`\n✗ 总体积超过 20MB 硬限制`)
  failed = true
}

if (failed) {
  console.error('\n包体超限。处理顺序：先把大图转 WebP，再把非首屏页面挪进分包。')
  process.exit(1)
}

console.log('\n✓ 包体检查通过')
