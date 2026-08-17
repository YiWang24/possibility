#!/usr/bin/env node
/**
 * 设计护栏 —— 对应 web 的 `web/scripts/check-design-tokens.mjs`。
 *
 * 小程序端是新起的，没有存量债务，所以不走 web 那套 ratchet 基线，直接零容忍。
 *
 * 检查项：
 *   1. 硬编码颜色 —— wxss/wxml 里的裸 hex 与 rgb()/rgba()，一律改引 tokens.wxss 变量。
 *      只管颜色：字号与圆角在 iOS 那边本来就是各视图内联的数字（Theme.swift 里没有
 *      字阶），这里跟着走，不另造一套基准里不存在的体系。
 *
 *   2. 安全区被 padding 简写覆盖 —— 用了 `.safe-top` / `.safe-bottom` 的元素，
 *      如果同一个文件里给它的另一个 class 写了 `padding:` 简写（或对应那一侧的
 *      长写法），会把全局的安全区 padding 覆盖掉：两者同为单类选择器，而页面样式
 *      排在 app.wxss 之后。表现是刘海机上顶栏钻进状态栏 / 底栏被小黑条压住，
 *      而在没有安全区的模拟器上一切正常 —— 正是最容易漏到线上的那类。
 */

import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = join(fileURLToPath(new URL('.', import.meta.url)), '..', 'src')
const TOKENS = join(ROOT, 'core', 'design', 'tokens.wxss')

let bad = 0
const fail = (file, msg) => {
  console.error(`✗ ${relative(ROOT, file)}\n  ${msg}`)
  bad++
}

function walk(dir, exts) {
  const out = []
  for (const name of readdirSync(dir)) {
    const full = join(dir, name)
    if (statSync(full).isDirectory()) out.push(...walk(full, exts))
    else if (exts.some((e) => name.endsWith(e))) out.push(full)
  }
  return out
}

/* ---- 1. 硬编码颜色 ---- */

// 排除 rpx/px 长度里的数字串不是问题：hex 必须带 #，rgb() 必须带函数名
const COLOR = /#[0-9a-fA-F]{3,8}\b|\brgba?\(/g

/**
 * Skyline 冒烟页不查颜色：它是渲染器探针而不是产品 UI，页面上那几个
 * 具体的 alpha 值（模糊光晕、半透明卡面）正是要验证的对象本身，
 * 换成 token 就测不出「这台机器把这个值渲染成什么样」了。
 */
const COLOR_EXEMPT = [join(ROOT, 'pages', 'dev-skyline-smoke')]

for (const file of walk(ROOT, ['.wxss', '.wxml'])) {
  if (file === TOKENS) continue // token 定义本身当然要写字面色值
  if (COLOR_EXEMPT.some((dir) => file.startsWith(dir))) continue
  const lines = readFileSync(file, 'utf8').split('\n')
  lines.forEach((line, i) => {
    if (line.trimStart().startsWith('/*') || line.trimStart().startsWith('*')) return
    const hits = line.match(COLOR)
    if (hits) {
      fail(file, `第 ${i + 1} 行硬编码颜色 ${hits.join(' ')} → 改引 tokens.wxss 的变量`)
    }
  })
}

/* ---- 2. 安全区被 padding 覆盖 ---- */

/** 找出 wxml 里与 safe-top / safe-bottom 同处一个 class 属性的其他 class 名 */
function safeAreaCompanions(wxml) {
  const found = { top: new Set(), bottom: new Set() }
  for (const m of wxml.matchAll(/class="([^"]*)"/g)) {
    const classes = m[1]
      .replace(/\{\{[^}]*\}\}/g, ' ') // 三元表达式里的动态 class 跳过
      .split(/\s+/)
      .filter(Boolean)
    const side = classes.includes('safe-top')
      ? 'top'
      : classes.includes('safe-bottom')
        ? 'bottom'
        : null
    if (!side) continue
    for (const c of classes) {
      if (c !== 'safe-top' && c !== 'safe-bottom') found[side].add(c)
    }
  }
  return found
}

/** 某个 class 的规则块里，是否写了会覆盖该侧安全区的 padding */
function overridesPadding(wxss, cls, side) {
  const rule = new RegExp(`(^|\\n)\\s*\\.${cls}\\s*\\{([^}]*)\\}`)
  const m = wxss.match(rule)
  if (!m) return null
  const body = m[2]
  if (/(^|\n|;)\s*padding\s*:/.test(body)) return 'padding 简写'
  if (new RegExp(`(^|\\n|;)\\s*padding-${side}\\s*:`).test(body)) return `padding-${side}`
  return null
}

for (const wxmlPath of walk(ROOT, ['.wxml'])) {
  const wxssPath = wxmlPath.replace(/\.wxml$/, '.wxss')
  let wxss
  try {
    wxss = readFileSync(wxssPath, 'utf8')
  } catch {
    continue // 没有同名 wxss 就没得覆盖
  }
  const companions = safeAreaCompanions(readFileSync(wxmlPath, 'utf8'))
  for (const [side, classes] of Object.entries(companions)) {
    for (const cls of classes) {
      const how = overridesPadding(wxss, cls, side)
      if (how) {
        fail(
          wxssPath,
          `.${cls} 的 ${how} 会覆盖 .safe-${side} 的安全区 padding（同为单类选择器，` +
            `页面样式在 app.wxss 之后）→ 改写成另外三侧的长写法，` +
            `需要额外留白时用 margin-${side}`,
        )
      }
    }
  }
}

if (bad === 0) {
  console.log('✓ 无硬编码颜色，安全区 padding 未被覆盖')
  process.exit(0)
}
console.error(`\n${bad} 处问题`)
process.exit(1)
