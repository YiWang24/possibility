// SEEDGEN — 从原型 HTML 抽取 USERS/PROFILE_META/BOUNTIES/PROFILE_SERVICES，
// 生成 supabase/seed.sql（幂等 insert ... on conflict do nothing）。
// 用法：node scripts/gen_seed.mjs
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";

const HTML = "万花筒-认识自己-原型.html";
const OUT = "supabase/seed.sql";

const src = readFileSync(HTML, "utf8");

// 平衡括号扫描，尊重字符串，抽取 `const NAME = <literal>` 的字面量并求值（可信自有数据）
function extractLiteral(name) {
  // 原型里每个声明都是 `const NAME = ...`，用纯字符串定位，避免动态 RegExp
  const marker = "const " + name + " =";
  const at = src.indexOf(marker);
  if (at < 0) throw new Error("literal not found: " + name);
  let i = at + marker.length;
  while (i < src.length && src[i] !== "[" && src[i] !== "{") i++;
  const open = src[i], close = open === "[" ? "]" : "}";
  const start = i;
  let depth = 0, inStr = null, esc = false;
  for (; i < src.length; i++) {
    const ch = src[i];
    if (inStr) {
      if (esc) esc = false;
      else if (ch === "\\") esc = true;
      else if (ch === inStr) inStr = null;
      continue;
    }
    if (ch === '"' || ch === "'" || ch === "`") { inStr = ch; continue; }
    if (ch === open) depth++;
    else if (ch === close) { depth--; if (depth === 0) { i++; break; } }
  }
  return (0, eval)("(" + src.slice(start, i) + ")");
}

// SQL 转义
const q = (s) => "'" + String(s).replace(/'/g, "''") + "'";
const arr = (a) => (a && a.length ? "ARRAY[" + a.map(q).join(",") + "]::text[]" : "'{}'::text[]");
const j = (o) => q(JSON.stringify(o ?? null)) + "::jsonb";
const num = (x) => Number(x);
const nullable = (x, f) => (x === undefined || x === null ? "null" : f(x));

const USERS = extractLiteral("USERS");
const META = extractLiteral("PROFILE_META");
const BOUNTIES = extractLiteral("BOUNTIES");
const SERVICES = extractLiteral("PROFILE_SERVICES");

const out = [];
out.push("-- seed.sql — 由 scripts/gen_seed.mjs 从原型 HTML 生成，请勿手改");
out.push("-- 重新生成：node scripts/gen_seed.mjs");
out.push("begin;");
out.push("");

// travelers
out.push("insert into travelers (id,name,initial,hue,is_similar,quote,bio,tags,dims,trajectory) values");
out.push(
  USERS.map((u) =>
    `  (${num(u.id)},${q(u.name)},${q(u.ini)},${num(u.hue)},${!!u.sim},` +
    `${q(u.quote)},${q(u.bio)},${arr(u.tags)},${j(u.dims)},${j(u.traj)})`
  ).join(",\n") + "\non conflict (id) do nothing;"
);
out.push("");

// traveler_details（PROFILE_META 以 id 为键）
const detailRows = Object.entries(META).map(([id, m]) =>
  `  (${num(id)},${nullable(m.age, num)},${nullable(m.city, q)},${nullable(m.from, q)},` +
  `${nullable(m.to, q)},${nullable(m.years, q)},${q(m.intro)},${q(m.full)},${j(m.advice)},` +
  `${nullable(m.result, q)},${nullable(m.consulted, num)},${nullable(m.response, q)})`
);
out.push("insert into traveler_details (traveler_id,age,city,from_role,to_role,years,intro,full_text,advice,result,consulted,response_time) values");
out.push(detailRows.join(",\n") + "\non conflict (traveler_id) do nothing;");
out.push("");

// traveler_services（原型是通用服务列表，traveler_id 置 null）
out.push("insert into traveler_services (id,traveler_id,kind,title,price,unit,description,tags) values");
out.push(
  SERVICES.map((s) =>
    `  (${q(s.id)},null,${q(s.type)},${q(s.title)},${num(s.price)},${q(s.unit ?? "")},${q(s.desc)},${arr(s.tags)})`
  ).join(",\n") + "\non conflict (id) do nothing;"
);
out.push("");

// bounties
out.push("insert into bounties (question,reward,responses) values");
out.push(BOUNTIES.map((b) => `  (${q(b.q)},${q(b.r)},${q(b.n)})`).join(",\n") + ";");
out.push("");

out.push("commit;");
out.push("");

mkdirSync("supabase", { recursive: true });
writeFileSync(OUT, out.join("\n"), "utf8");
console.log(
  `seed.sql 生成完毕：travelers=${USERS.length} details=${Object.keys(META).length} ` +
  `services=${SERVICES.length} bounties=${BOUNTIES.length}`
);
