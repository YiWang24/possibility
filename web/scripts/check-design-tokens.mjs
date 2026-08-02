#!/usr/bin/env node
/* 设计 token 护栏 —— 存量 ratchet 模式。
 *
 * 背景：token 体系（globals.css @theme + components/ui 基元）建立之前，
 * 视图层积累了大量绕过 token 的写法。全部一次修完不现实，
 * 所以按文件记录存量基线：每个文件的违规数只许减少、不许增加；
 * 新文件必须为零。存量修掉后跑 --update 收紧基线，债务只降不升。
 *
 * 检查项（都只针对 .tsx 视图代码）：
 *   hex      —— 裸十六进制颜色（应使用 --color-* token / tailwind 色类）
 *   fontPx   —— text-[..px] 任意字号（应使用字阶：text-micro..text-heading/display）
 *   radius   —— rounded-[..] 任意圆角（应使用 rounded-field/tile/card/sheet/chip）
 *   shadow   —— shadow-[..] 任意阴影（应使用 shadow-card/pop/glow）
 *
 * 另有一项零容忍硬检查（不走 ratchet）：
 *   死宽度类 —— max-w-<名字> 引用了 globals.css 里并不存在的容器 token。
 *   Tailwind 对未知 utility 不报错、直接不生成 CSS，于是 max-width 静默变成
 *   none：元素铺满视口，页面看起来「还能用」，只是宽得离谱。
 *   PR #93 删掉 --container-board 时漏改 AuthWall，登录墙在 2560px 屏上
 *   内容宽 2432px 上线，就是这么来的。存量必须为零。
 *
 * 用法：
 *   node scripts/check-design-tokens.mjs           # 校验（CI 与本地）
 *   node scripts/check-design-tokens.mjs --update  # 修完存量后收紧基线
 */
import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, relative, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const WEB_ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const SCAN_DIRS = ["app", "components", "features"];
const BASELINE_PATH = join(WEB_ROOT, "scripts", "design-token-baseline.json");

const RULES = {
  hex: {
    pattern: /#[0-9a-fA-F]{6}\b|#[0-9a-fA-F]{3}\b/g,
    hint: "裸 hex 颜色 → 使用 globals.css 的 --color-* token（如 text-brand / bg-raised / border-line）",
  },
  fontPx: {
    pattern: /\btext-\[[0-9.]+px\]/g,
    hint: "任意字号 → 使用字阶 text-micro/caption/footnote/body/callout/lead/subtitle/title/heading/display",
  },
  radius: {
    pattern: /\brounded(?:-(?:t|b|l|r|tl|tr|bl|br|s|e|ss|se|es|ee))?-\[[^\]]+\]/g,
    hint: "任意圆角 → 使用圆角阶梯 rounded-field/tile/card/sheet/chip",
  },
  shadow: {
    pattern: /\bshadow-\[[^\]]+\]/g,
    hint: "任意阴影 → 使用 shadow-card/pop/glow",
  },
};

function listTsx(dir) {
  const out = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) out.push(...listTsx(full));
    else if (entry.name.endsWith(".tsx")) out.push(full);
  }
  return out;
}

function countViolations(file) {
  const source = readFileSync(file, "utf8");
  const counts = {};
  for (const [name, rule] of Object.entries(RULES)) {
    const matches = source.match(rule.pattern);
    if (matches?.length) counts[name] = matches.length;
  }
  return counts;
}

const current = {};
for (const dir of SCAN_DIRS) {
  for (const file of listTsx(join(WEB_ROOT, dir))) {
    const counts = countViolations(file);
    if (Object.keys(counts).length) current[relative(WEB_ROOT, file)] = counts;
  }
}

if (process.argv.includes("--update")) {
  const sorted = Object.fromEntries(Object.entries(current).sort(([a], [b]) => a.localeCompare(b)));
  writeFileSync(BASELINE_PATH, JSON.stringify(sorted, null, 2) + "\n");
  const total = Object.values(sorted).reduce(
    (acc, counts) => acc + Object.values(counts).reduce((a, b) => a + b, 0),
    0,
  );
  console.log(`基线已更新：${Object.keys(sorted).length} 个文件，共 ${total} 处存量违规。`);
  process.exit(0);
}

let baseline = {};
try {
  baseline = JSON.parse(readFileSync(BASELINE_PATH, "utf8"));
} catch {
  console.error(`缺少基线文件 ${relative(WEB_ROOT, BASELINE_PATH)}，先运行 --update 生成。`);
  process.exit(1);
}

/* ---- 零容忍：死宽度类 ---------------------------------------------------
   Tailwind 内置的 max-w 关键字 + globals.css 定义的容器 token 之外的写法，
   都会生成不出 CSS。任意值 max-w-[..] / max-w-(..) 不在此列，它们总能生成。 */
const TAILWIND_MAX_W = new Set([
  "none", "xs", "sm", "md", "lg", "xl", "2xl", "3xl", "4xl", "5xl", "6xl", "7xl",
  "full", "min", "max", "fit", "prose", "screen",
]);

function definedContainerTokens() {
  const css = readFileSync(join(WEB_ROOT, "app", "globals.css"), "utf8");
  const names = new Set();
  for (const m of css.matchAll(/--container-([a-z0-9-]+)\s*:/g)) names.add(m[1]);
  return names;
}

const allowedMaxW = new Set([...TAILWIND_MAX_W, ...definedContainerTokens()]);

/** 单个文件里引用了但生成不出 CSS 的 max-w 类 */
function deadWidthClassesIn(file) {
  const source = readFileSync(file, "utf8");
  const names = [...source.matchAll(/\bmax-w-([a-z0-9][a-z0-9-]*)\b/g)].map((m) => m[1]);
  return names
    .filter((name) => !name.startsWith("screen-") && !allowedMaxW.has(name))
    .map((name) => ({ file: relative(WEB_ROOT, file), cls: `max-w-${name}` }));
}

const deadWidthClasses = SCAN_DIRS.flatMap((dir) =>
  listTsx(join(WEB_ROOT, dir)).flatMap(deadWidthClassesIn),
);

if (deadWidthClasses.length) {
  console.error("❌ 死宽度类：引用了 globals.css 里不存在的容器 token\n");
  for (const { file, cls } of deadWidthClasses) {
    console.error(`  ${file}\n    ${cls} 生成不出 CSS，max-width 静默变成 none\n`);
  }
  console.error(
    `当前可用：${[...allowedMaxW].filter((n) => !TAILWIND_MAX_W.has(n)).map((n) => `max-w-${n}`).join(" / ") || "（无自定义容器 token）"}\n` +
      "删除或改名容器 token 时，务必同步全部调用点。",
  );
  process.exit(1);
}

const failures = [];
for (const [file, counts] of Object.entries(current)) {
  for (const [rule, count] of Object.entries(counts)) {
    const allowed = baseline[file]?.[rule] ?? 0;
    if (count > allowed) failures.push({ file, rule, count, allowed });
  }
}

if (failures.length) {
  console.error("❌ 设计 token 违规超出基线：\n");
  for (const { file, rule, count, allowed } of failures) {
    console.error(`  ${file}\n    [${rule}] ${allowed} → ${count}：${RULES[rule].hint}\n`);
  }
  console.error(
    "新增代码必须走 design token（见 docs/engineering/web-design-system.md）。\n" +
      "若这次改动确实清理了其他存量、总量在下降，跑 `pnpm run lint:tokens -- --update` 收紧基线并一并提交。",
  );
  process.exit(1);
}

const debt = Object.values(current).reduce(
  (acc, counts) => acc + Object.values(counts).reduce((a, b) => a + b, 0),
  0,
);
console.log(`✅ 设计 token 检查通过（存量债务 ${debt} 处，只降不升）。`);
