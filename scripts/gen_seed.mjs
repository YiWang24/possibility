// SEEDGEN — 从原型 HTML 抽取 USERS/PROFILE_META/BOUNTIES/PROFILE_SERVICES，
// 生成 supabase/seed.sql（幂等 insert ... on conflict do nothing）。
// 用法：node scripts/gen_seed.mjs
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";

const HTML = "design/prototype/万花筒-认识自己-原型.html";
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

// 原型 PROFILE_META 只覆盖旅人 1–5；6–12 的详情按各自 bio/tags 补齐，风格与 1–5 一致。
const EXTRA_META = {
  6: {
    age: 33, city: "深圳", from: "管理咨询", to: "用户研究", years: "转型 2 年",
    intro:
      "在咨询公司做了四年行业研究和高管访谈后，我发现自己真正着迷的是访谈里具体的人，而不是 PPT 里抽象的市场。31 岁转型用户研究，把最擅长的访谈和结构化分析原样带了过来，只是服务对象从甲方变成了产品。",
    full:
      "转型时最大的心理关卡是头衔落差：从给 CEO 汇报变成给产品经理提供输入。前六个月我刻意补了两件事：一是学会把研究结论翻译成可执行的产品建议，而不是交付一份漂亮报告；二是接受研究只是决策输入之一，结论被推翻是常态。咨询训练出的假设驱动和快速拆解，在互联网里依然是稀缺能力，真正要换掉的是交付心态。",
    advice: {
      decision: [
        "先分清你喜欢的是「研究」还是「咨询的光环」，两者的日常完全不同。",
        "用一次真实的用户访谈项目试水，再决定是否离开咨询。",
        "接受第一份研究岗位的头衔和薪资可能回调，把它当学费。",
      ],
      ability: [
        "把行业分析框架转译成用户研究计划，方法论是通用的。",
        "补齐问卷设计与定量分析，咨询背景的人常常只擅长定性。",
        "练习把研究结论写成一页纸的产品建议，而非四十页报告。",
      ],
      interview: [
        "准备一个「研究改变了产品决策」的完整案例。",
        "说明你如何面对结论被挑战，而不是只讲方法严谨。",
        "展示对业务指标的理解，研究岗最怕被当成学院派。",
      ],
    },
    result: "2 年完成转型，现负责一条产品线的用户研究",
    consulted: 23, response: "通常当天回复",
  },
  7: {
    age: 36, city: "大理", from: "互联网运营", to: "民宿主理人", years: "经营 2 年",
    intro:
      "29 岁做到大厂运营负责人，34 岁搬到大理开民宿。离开不是冲动：我提前一年做了预算表，算清了改造成本、淡旺季现金流和最坏情况下的退路，才递的辞职信。",
    full:
      "第一年是真实的祛魅期：选址谈租约、盯装修、通下水道、半夜接投诉，运营大盘的方法论帮不上忙，但大厂练出的用户思维和内容能力成了获客的核心——我的客源七成来自自己写的内容。第二年才开始谈得上生活方式：收入大约是原来的四成，但时间和情绪是自己的。如果你把小城生活当逃离，大概率会失望；把它当一门要认真经营的小生意，它才养得活你。",
    advice: {
      decision: [
        "先按最坏情况做十二个月现金流测算，再决定要不要离开。",
        "保留一项可远程的技能或副业，作为回不去时的缓冲。",
        "先以旅居方式住满三个月，再考虑签长租约。",
      ],
      ability: [
        "把运营的内容和用户思维迁移到获客，小生意最缺的就是这个。",
        "学会看租约、算毛利、盯施工，这些没人替你做。",
        "建立本地的手艺人与供应商网络，比线上流量更救急。",
      ],
      interview: [
        "如果考虑回大城市，把经营民宿讲成完整的业务操盘经历。",
        "用数据说明你独立完成了获客、定价和复购。",
        "坦诚说明离开的原因和这两年的取舍，不要包装成度假。",
      ],
    },
    result: "民宿第二年实现盈利，客源七成来自自有内容",
    consulted: 29, response: "通常 8 小时内回复",
  },
  8: {
    age: 29, city: "广州", from: "财务分析", to: "数据分析师", years: "转型 2 年",
    intro:
      "我没有裸辞去报班，而是先把财务共享中心里没人愿意整理的报表数据变成了自动化脚本和第一个数据项目。27 岁在原公司完成内部转岗，路径慢，但几乎没有风险。",
    full:
      "转岗第一年最难的不是技术，而是把「会写 SQL」变成「能回答业务问题」。我给自己定了一个标准：每个分析都要指向一个可执行的决策建议。财务背景反而成了优势——我天然懂成本结构和利润口径，很多纯技术背景的分析师要花一年才补上。作品集全部来自公司真实数据的脱敏版本，面试时比任何证书都有说服力。",
    advice: {
      decision: [
        "优先评估内部转岗的可能性，它比裸辞学习风险低得多。",
        "把「想转数据」拆成一个可验证的小项目，先做再说。",
        "观察目标岗位的日常，确认你喜欢的是分析而不是想象中的高薪。",
      ],
      ability: [
        "SQL 和一门脚本语言是底线，但业务理解才是差异化。",
        "用自动化解决自己手头的重复工作，就是最好的第一个项目。",
        "作品集讲清业务问题、分析过程和落地结果，不要堆技术名词。",
      ],
      interview: [
        "准备一个「分析改变了业务动作」的案例，哪怕很小。",
        "财务背景要主动讲成对指标口径的天然优势。",
        "被问基础技术题时诚实说边界，再展示学习速度。",
      ],
    },
    result: "内部转岗成功，薪资持平，第二年开始带数据专项",
    consulted: 38, response: "通常 4 小时内回复",
  },
  9: {
    age: 38, city: "北京", from: "全职妈妈", to: "生涯咨询师", years: "重返 2 年",
    intro:
      "30 岁暂停工作照顾家庭，36 岁重新出发成为生涯咨询师。重返职场时我没有隐藏那五年，而是把它讲成真实的能力：多线程协调、预算管理、和在极度受限条件下保持行动。",
    full:
      "最难的不是技能生疏，而是自我怀疑：简历上的五年空白像一道要不断解释的伤口。转机是我把「解释空白」变成「陈述能力」——五年里我组织过社区互助小组、管理过家庭的全部财务，这些都是真实的项目经验。选择生涯咨询也不是退而求其次：我系统读完了课程、完成督导时数，从同伴互助个案做起。现在我的来访者一半是重返职场的女性，那五年成了我最重要的专业资产。",
    advice: {
      decision: [
        "重返的方向不必是原岗位，先盘点这几年真实长出的能力。",
        "给自己六个月的过渡期预算，降低「必须马上成功」的压力。",
        "和家人明确重返后的分工边界，否则会被默认状态拖回去。",
      ],
      ability: [
        "把育儿期的协调、预算、危机处理翻译成职场语言。",
        "选一个有系统训练和认证路径的方向，让投入可见。",
        "从低价或公益个案开始积累案例，不要等「准备好」。",
      ],
      interview: [
        "主动、平静地讲空白期，你越坦然，对方越放心。",
        "用具体事例证明你的多线程协调能力。",
        "准备好回答「会不会再次离开」，给出真实的边界安排。",
      ],
    },
    result: "完成认证并稳定接案，来访者以重返职场女性为主",
    consulted: 26, response: "通常当天回复",
  },
  10: {
    age: 31, city: "上海", from: "建筑设计", to: "UX 设计师", years: "转型 2 年",
    intro:
      "在建筑事务所画了五年图，习惯了三年才能落成的项目，也厌倦了永远等不到的用户反馈。29 岁用半年时间做了三个真实数字产品项目，转型 UX，现在负责一家 SaaS 的企业端体验。",
    full:
      "建筑转 UX 最大的红利是处理复杂约束的能力：动线、规范、结构、预算之间的权衡，和企业软件里角色、权限、流程的纠缠是同构的。最大的坑是节奏——建筑的严谨会让你想把方案打磨到完美再拿出来，而数字产品要求你先拿半成品去验证。作品集我没有做概念图，而是找了两个真实小企业和一个开源项目做免费改版，每个案例都有上线前后的对比。这三个项目就是我的敲门砖。",
    advice: {
      decision: [
        "先用业余时间完成一个真实项目，验证你喜欢的是设计还是逃离建筑。",
        "算清收入回调的幅度和恢复周期，UX 起薪可能低于你的年资。",
        "关注企业级产品方向，建筑背景在复杂系统里最有优势。",
      ],
      ability: [
        "把空间叙事能力转译成信息架构和用户流程。",
        "补齐可用性测试和数据意识，学会用反馈代替直觉。",
        "作品集要真实项目加上线结果，概念稿说服不了面试官。",
      ],
      interview: [
        "用建筑案例讲清你如何在多重约束下做取舍。",
        "展示快速迭代的作品，打消「建筑背景节奏慢」的疑虑。",
        "说明你理解数字产品的协作方式，设计不再是最终交付物。",
      ],
    },
    result: "半年三个真实项目完成转型，现负责企业端体验",
    consulted: 33, response: "通常 6 小时内回复",
  },
  11: {
    age: 42, city: "苏州", from: "广告策划", to: "独立书店主理人", years: "经营 2 年",
    intro:
      "做了十五年广告，35 岁当上创意总监，40 岁开了社区书店。这不是浪漫冲动：我用一年时间算清了租金、库存周转和现金流，确认单纯卖书活不下来之后，才设计了会员制加活动策划的模式。",
    full:
      "书店第一年的真相是：卖书的毛利撑不起房租，真正养活书店的是会员制、场地活动和策展合作——而这些恰恰是我做了十五年的老本行。广告训练出的能力没有浪费：给品牌讲故事变成给社区做内容，提案变成活动策划，比稿变成谈异业合作。最大的心态转变是从「大预算大曝光」回到「一场活动来三十个人」的尺度，但这三十个人我叫得出名字。实体创业不是逃离职场，它是把你的全部专业能力押在一个更小但更真实的场景里。",
    advice: {
      decision: [
        "先算账再谈情怀：租金、库存、人力，按最坏情况算十八个月。",
        "确认你的老本行能否成为新生意的差异化，而不是从零开始。",
        "用快闪或市集先试三个月，验证选品和社区反应。",
      ],
      ability: [
        "把内容和策划能力变成书店的经营核心，卖书只是入口。",
        "学会库存管理和现金流表，创意人最容易死在账上。",
        "经营社区关系，回头客和会员才是实体店的护城河。",
      ],
      interview: [
        "如果重回职场，把开店讲成完整的小生意操盘经历。",
        "用数据讲清你如何用有限预算获客和留存。",
        "展示从服务甲方到直接面对用户的视角变化。",
      ],
    },
    result: "书店第二年靠会员与活动实现收支平衡",
    consulted: 21, response: "通常当天回复",
  },
  12: {
    age: 34, city: "北京", from: "后端工程师", to: "产品营销", years: "转型 2 年",
    intro:
      "写了六年后端，我发现自己最兴奋的时刻不是上线，而是给客户讲清楚这个功能为什么值得用。32 岁从技术布道切入转型产品营销，现在负责一条开发者产品线的定位、内容和上市。",
    full:
      "技术转市场最反直觉的一课是：解释技术不是降维，而是另一门专业。写代码时我以为「讲清楚」是天赋，做营销后才明白定位、叙事、渠道各有方法论，要像当年学算法一样系统补课。工程师背景给了我两个真实优势：开发者受众能一眼识别你是不是自己人；我能直接读代码和文档，内容不需要二手转译。转型路径上，技术布道是最平滑的跳板——一半时间写代码做 demo，一半时间做内容和演讲，让我在不离开技术的情况下验证了自己真的喜欢面向人的工作。",
    advice: {
      decision: [
        "先在现岗位争取写文档、做分享的机会，验证你是否享受表达。",
        "考虑技术布道或开发者关系作为过渡，不必一步跳到营销。",
        "想清楚放弃技术晋升通道的机会成本，转回去会越来越难。",
      ],
      ability: [
        "系统学习定位和内容方法论，别靠「我懂技术」硬写。",
        "把 demo、文档和演讲变成作品集，这是技术背景独有的证据。",
        "补齐渠道和数据侧知识，营销不只是写得好。",
      ],
      interview: [
        "准备一个「技术内容带来真实增长」的案例。",
        "展示你能在工程和市场两种语言之间双向翻译。",
        "说明你理解营销的被衡量方式，别只谈热爱表达。",
      ],
    },
    result: "经技术布道完成转型，现负责开发者产品营销",
    consulted: 25, response: "通常 6 小时内回复",
  },
};
for (const [id, m] of Object.entries(EXTRA_META)) {
  if (META[id]) throw new Error("EXTRA_META overlaps PROFILE_META: " + id);
  META[id] = m;
}

// 最新原型已移除 PROFILE_SERVICES 常量；服务模态框仍使用这三类固定产品。
const SERVICES = [
  {
    id: "consult",
    type: "1 对 1 咨询",
    title: "针对你的具体问题深聊",
    price: 29,
    unit: "/ 小时",
    desc: "围绕转型选择、能力差距、作品集或求职准备，结合亲历给出针对性建议。",
    tags: ["实时文字沟通", "1 小时", "24 小时内可追问"],
  },
  {
    id: "materials",
    type: "资料工具包",
    title: "海外学校申请材料包",
    price: 9.9,
    unit: "",
    desc: "包含选校比较表、申请时间线、文书自查清单和材料命名模板，购买后即可查看。",
    tags: ["4 份模板", "申请清单", "永久查看"],
  },
  {
    id: "companion",
    type: "阶段陪跑",
    title: "申请陪跑服务",
    price: 599,
    unit: "/ 期",
    desc: "从目标拆解到材料提交的 4 周陪跑，每周复盘进度并提供关键节点反馈。",
    tags: ["4 周", "每周复盘", "材料反馈"],
  },
  // 旅人 6–12 的个人服务，与各自 bio/详情一致。
  {
    id: "consult-t6", tid: 6,
    type: "1 对 1 咨询",
    title: "咨询转用户研究路径复盘",
    price: 39, unit: "/ 小时",
    desc: "结合行业研究与访谈经验，帮你评估从咨询/分析岗转用户研究的可行路径与作品集准备。",
    tags: ["实时文字沟通", "1 小时", "24 小时内可追问"],
  },
  {
    id: "consult-t7", tid: 7,
    type: "1 对 1 咨询",
    title: "小城开店与现金流测算",
    price: 35, unit: "/ 小时",
    desc: "从选址、改造预算到淡旺季现金流，用真实经营数据帮你把「想去小城生活」算成一笔明白账。",
    tags: ["实时文字沟通", "1 小时", "含测算模板"],
  },
  {
    id: "materials-t8", tid: 8,
    type: "资料工具包",
    title: "内部转岗数据作品集清单",
    price: 12.9, unit: "",
    desc: "包含自动化脚本选题清单、业务分析案例框架和转岗沟通话术，帮你用现有工作数据低风险转型。",
    tags: ["3 份模板", "案例框架", "永久查看"],
  },
  {
    id: "consult-t9", tid: 9,
    type: "1 对 1 咨询",
    title: "重返职场节奏规划",
    price: 29, unit: "/ 小时",
    desc: "面向职业空白期后的重启：盘点隐性能力、设计过渡期节奏，并演练空白期的面试表达。",
    tags: ["实时文字沟通", "1 小时", "24 小时内可追问"],
  },
  {
    id: "materials-t10", tid: 10,
    type: "资料工具包",
    title: "UX 转型作品集自查表",
    price: 15.9, unit: "",
    desc: "包含真实项目选题思路、作品集结构自查清单和常见面试追问整理，适合传统设计背景转数字产品。",
    tags: ["3 份模板", "自查清单", "永久查看"],
  },
  {
    id: "companion-t11", tid: 11,
    type: "阶段陪跑",
    title: "实体开店筹备 4 周陪跑",
    price: 499, unit: "/ 期",
    desc: "从算账、选址评估到开业活动策划的 4 周陪跑，每周复盘一次，帮你在签约前把风险想清楚。",
    tags: ["4 周", "每周复盘", "预算模板"],
  },
  {
    id: "consult-t12", tid: 12,
    type: "1 对 1 咨询",
    title: "技术转市场定位梳理",
    price: 32, unit: "/ 小时",
    desc: "帮技术背景的你评估布道/营销转型路径，梳理个人定位并规划第一批内容作品。",
    tags: ["实时文字沟通", "1 小时", "24 小时内可追问"],
  },
];

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

// traveler_services（通用服务 traveler_id 为 null，个人服务挂对应旅人）
out.push("insert into traveler_services (id,traveler_id,kind,title,price,unit,description,tags) values");
out.push(
  SERVICES.map((s) =>
    `  (${q(s.id)},${nullable(s.tid, num)},${q(s.type)},${q(s.title)},${num(s.price)},${q(s.unit ?? "")},${q(s.desc)},${arr(s.tags)})`
  ).join(",\n") + "\non conflict (id) do nothing;"
);
out.push("");

// bounties（reward 由原型 amount 组装成中文悬赏文案；带 id 保证幂等）
out.push("insert into bounties (id,question,reward,responses,tags,detail) values");
out.push(
  BOUNTIES.map((b) =>
    `  (${num(b.id)},${q(b.q)},${q(`¥${b.amount} 悬赏`)},${q(b.n)},${arr(b.tags)},${q(b.detail)})`
  ).join(",\n") + "\non conflict (id) do nothing;"
);
out.push("select setval('bounties_id_seq', greatest((select max(id) from bounties), 1));");
out.push("");

out.push("commit;");
out.push("");

mkdirSync("supabase", { recursive: true });
writeFileSync(OUT, out.join("\n"), "utf8");
console.log(
  `seed.sql 生成完毕：travelers=${USERS.length} details=${Object.keys(META).length} ` +
  `services=${SERVICES.length} bounties=${BOUNTIES.length}`
);
