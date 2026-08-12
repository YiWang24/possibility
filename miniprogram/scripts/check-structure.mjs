#!/usr/bin/env node
/**
 * 工程结构护栏 —— 校验 app.json 的页面/分包声明，以及所有 json 里 usingComponents
 * 的路径是否真实存在。
 *
 * 为什么需要单独一条：这些错误 tsc 一个都抓不到（它们在 json/wxml 里，不在 ts 里），
 * 只有微信开发者工具编译时才会炸 —— 而 CI 里没有开发者工具。少一个页面文件、
 * 组件路径写错、preloadRule 引用了不存在的分包，全都属于这一类。
 */

import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { dirname, join, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = join(fileURLToPath(new URL('.', import.meta.url)), '..', 'src')
const app = JSON.parse(readFileSync(join(ROOT, 'app.json'), 'utf8'))

let bad = 0
const fail = (m) => { console.error(`✗ ${m}`); bad++ }

// ---- 1. 页面四件套 ----
const entries = [...app.pages]
for (const sub of app.subPackages ?? []) {
  for (const p of sub.pages) entries.push(`${sub.root}/${p}`)
}
if (app.tabBar?.custom) entries.push('custom-tab-bar/index')

for (const entry of entries) {
  for (const ext of ['.ts', '.json', '.wxml', '.wxss']) {
    if (!existsSync(join(ROOT, entry + ext))) fail(`缺失 ${entry}${ext}`)
  }
}

// ---- 2. tabBar / preloadRule 引用 ----
for (const item of app.tabBar?.list ?? []) {
  if (!app.pages.includes(item.pagePath)) fail(`tabBar 指向未注册页面：${item.pagePath}`)
}
const subNames = new Set((app.subPackages ?? []).map((s) => s.name))
for (const [page, rule] of Object.entries(app.preloadRule ?? {})) {
  if (!app.pages.includes(page)) fail(`preloadRule 指向未注册页面：${page}`)
  for (const pkg of rule.packages ?? []) {
    if (!subNames.has(pkg)) fail(`preloadRule 引用未声明分包：${pkg}`)
  }
}

// ---- 3. usingComponents 路径 ----
function walkJson(dir) {
  const out = []
  for (const name of readdirSync(dir)) {
    const full = join(dir, name)
    if (statSync(full).isDirectory()) out.push(...walkJson(full))
    else if (name.endsWith('.json')) out.push(full)
  }
  return out
}

let componentRefs = 0
for (const file of walkJson(ROOT)) {
  let json
  try {
    json = JSON.parse(readFileSync(file, 'utf8'))
  } catch (e) {
    fail(`${relative(ROOT, file)} 不是合法 JSON：${e.message}`)
    continue
  }
  for (const [tag, path] of Object.entries(json.usingComponents ?? {})) {
    componentRefs++
    // 绝对路径以 / 开头表示相对 miniprogramRoot，其余相对当前文件
    const base = path.startsWith('/') ? join(ROOT, path.slice(1)) : resolve(dirname(file), path)
    for (const ext of ['.json', '.wxml']) {
      if (!existsSync(base + ext)) {
        fail(`${relative(ROOT, file)} 的 <${tag}> 指向不存在的组件：${path}${ext}`)
      }
    }
    const cfgPath = base + '.json'
    if (existsSync(cfgPath)) {
      const cfg = JSON.parse(readFileSync(cfgPath, 'utf8'))
      if (cfg.component !== true) {
        fail(`${relative(ROOT, file)} 的 <${tag}> 目标未声明 "component": true`)
      }
    }
  }
}

if (bad === 0) {
  console.log(`✓ ${entries.length} 个页面/组件四件套齐全`)
  console.log(`✓ tabBar 与 preloadRule 引用一致`)
  console.log(`✓ ${componentRefs} 处 usingComponents 引用全部可解析`)
} else {
  console.error(`\n${bad} 处问题`)
}
process.exit(bad === 0 ? 0 : 1)
