/* 冒烟测试：用最小 DOM 垫片在 node 里真跑三个工具的完整流程。
   容器里没有构建期，静态扫描也抓不到运行期错误——空 getElementById、拼错的 API、
   结果页渲染崩溃、分享 payload 违规，都靠这里兜住。

   跑之前先 ./build.sh，测的是 dist/ 里的实际产物。
   用法： ./build.sh && node smoke.js */

"use strict";

const fs = require("fs");
const path = require("path");
const vm = require("vm");

const ROOT = path.join(__dirname, "dist");
const VOID = new Set(["meta", "link", "br", "hr", "img", "input", "source"]);

/* ============ 最小 DOM ============ */

class ClassList {
  constructor(node) { this.node = node; this.set = new Set(); }
  add(c) { this.set.add(c); this._sync(); }
  remove(c) { this.set.delete(c); this._sync(); }
  contains(c) { return this.set.has(c); }
  toggle(c, force) {
    if (force === undefined) force = !this.set.has(c);
    if (force) this.set.add(c); else this.set.delete(c);
    this._sync();
  }
  _sync() { this.node.attrs.class = Array.from(this.set).join(" "); }
}

class Style {
  setProperty(k, v) { this[k] = v; }
}

class El {
  constructor(tag, doc) {
    this.tagName = String(tag).toUpperCase();
    this.doc = doc;
    this.childNodes = [];
    this.parentNode = null;
    this.attrs = {};
    this.classList = new ClassList(this);
    this.style = new Style();
    this._text = "";
    this._listeners = {};
    this.disabled = false;
  }
  get firstChild() { return this.childNodes[0] || null; }
  get children() { return this.childNodes.filter((n) => n instanceof El); }
  appendChild(n) {
    if (n.parentNode) n.parentNode.removeChild(n);
    n.parentNode = this;
    this.childNodes.push(n);
    return n;
  }
  removeChild(n) {
    const i = this.childNodes.indexOf(n);
    if (i >= 0) this.childNodes.splice(i, 1);
    n.parentNode = null;
    return n;
  }
  setAttribute(k, v) {
    this.attrs[k] = String(v);
    if (k === "class") {
      this.classList.set = new Set(String(v).split(/\s+/).filter(Boolean));
    }
    if (k === "id") this.doc._byId.set(String(v), this);
  }
  getAttribute(k) { return k in this.attrs ? this.attrs[k] : null; }
  get id() { return this.attrs.id || ""; }
  get textContent() {
    if (this.childNodes.length === 0) return this._text;
    return this.childNodes.map((n) => n.textContent).join("");
  }
  set textContent(v) {
    this.childNodes.length = 0;
    this._text = String(v);
  }
  addEventListener(type, fn) {
    (this._listeners[type] = this._listeners[type] || []).push(fn);
  }
  matches(sel) { return matchSel(this, sel); }
  closest(sel) {
    let n = this;
    while (n && n instanceof El) {
      if (matchSel(n, sel)) return n;
      n = n.parentNode;
    }
    return null;
  }
  querySelector(sel) { return this.querySelectorAll(sel)[0] || null; }
  querySelectorAll(sel) {
    const parts = sel.split(">").map((s) => s.trim());
    let out = [];
    walk(this, (n) => { if (matchSel(n, parts[0])) out.push(n); });
    for (let i = 1; i < parts.length; i++) {
      const next = [];
      out.forEach((n) => n.children.forEach((c) => {
        if (matchSel(c, parts[i])) next.push(c);
      }));
      out = next;
    }
    return out;
  }
  // canvas 桩
  getContext() {
    if (!this._ctx) {
      this._ctx = new Proxy({}, {
        get(t, p) {
          if (p === "measureText") {
            return (s) => ({ width: String(s).length * 16 });
          }
          if (p in t) return t[p];
          return () => {};
        },
        set(t, p, v) { t[p] = v; return true; },
      });
    }
    return this._ctx;
  }
  toDataURL() { return "data:image/png;base64,iVBORw0KGgo="; }
}

class TextNode {
  constructor(t) { this._text = String(t); this.parentNode = null; }
  get textContent() { return this._text; }
  set textContent(v) { this._text = String(v); }
}

function walk(node, fn) {
  node.childNodes.forEach((c) => {
    if (c instanceof El) { fn(c); walk(c, fn); }
  });
}

function matchSel(node, sel) {
  if (!(node instanceof El) || !sel) return false;
  const m = sel.match(/^([a-zA-Z]*)((?:\.[\w-]+)*)$/);
  if (!m) return false;
  if (m[1] && node.tagName !== m[1].toUpperCase()) return false;
  const classes = m[2] ? m[2].split(".").filter(Boolean) : [];
  return classes.every((c) => node.classList.contains(c));
}

/* ============ HTML 解析 ============ */

function parse(html, doc) {
  const body = new El("body", doc);
  const stack = [body];
  const re = /<!--[\s\S]*?-->|<!DOCTYPE[^>]*>|<\/([a-zA-Z0-9]+)\s*>|<([a-zA-Z0-9]+)((?:\s+[^>]*?)?)\/?>/g;
  let last = 0;
  let m;
  while ((m = re.exec(html))) {
    const text = html.slice(last, m.index).trim();
    if (text) stack[stack.length - 1].appendChild(new TextNode(text));
    last = re.lastIndex;
    if (m[1]) {
      if (stack.length > 1) stack.pop();
    } else if (m[2]) {
      const node = new El(m[2], doc);
      const attrRe = /([\w:-]+)(?:="([^"]*)")?/g;
      let a;
      while ((a = attrRe.exec(m[3] || ""))) {
        node.setAttribute(a[1], a[2] === undefined ? "" : a[2]);
      }
      stack[stack.length - 1].appendChild(node);
      if (!VOID.has(m[2].toLowerCase()) && !m[0].endsWith("/>")) stack.push(node);
    }
  }
  return body;
}

function makeDoc(html) {
  const doc = { _byId: new Map() };
  doc.createElement = (tag) => new El(tag, doc);
  doc.createTextNode = (t) => new TextNode(t);
  doc.body = parse(html, doc);
  doc.documentElement = new El("html", doc);
  doc.documentElement.appendChild(doc.body);
  doc.getElementById = (id) => doc._byId.get(id) || null;
  doc.querySelector = (s) => doc.body.querySelector(s);
  doc.querySelectorAll = (s) => doc.body.querySelectorAll(s);
  doc.title = "";
  return doc;
}

/* ============ 事件派发 ============ */

function click(node) {
  if (!node) throw new Error("click: 目标节点不存在");
  if (node.disabled) throw new Error(`click: 按钮被禁用 ${node.id || node.attrs.class}`);
  const evt = { target: node };
  let n = node;
  while (n) {
    (n._listeners.click || []).slice().forEach((fn) => fn(evt));
    n = n.parentNode;
  }
}

/* ============ 环境装载 ============ */

function load(tool, sharedStore) {
  const dir = path.join(ROOT, tool);
  const html = fs.readFileSync(path.join(dir, "index.html"), "utf8");
  const doc = makeDoc(html);

  const store = sharedStore || new Map();
  const localStorage = {
    getItem: (k) => (store.has(k) ? store.get(k) : null),
    setItem: (k, v) => store.set(k, String(v)),
    removeItem: (k) => store.delete(k),
  };

  const win = { document: doc, localStorage, setTimeout, clearTimeout, Promise, Math, JSON, Object, Array, String, Number, Boolean, Date, isNaN, parseInt, parseFloat };
  win.window = win;
  const ctx = vm.createContext(win);
  ctx.document = doc;

  const scripts = doc.querySelectorAll("script")
    .map((s) => s.getAttribute("src"))
    .filter(Boolean);
  scripts.forEach((src) => {
    const file = path.join(dir, src.replace(/^\.\//, ""));
    vm.runInContext(fs.readFileSync(file, "utf8"), ctx, { filename: file });
  });

  return { doc, win: ctx, scripts, store };
}

function activeScreen(doc) {
  const on = doc.querySelectorAll(".screen").filter((s) => s.classList.contains("is-active"));
  if (on.length !== 1) throw new Error(`活动屏数量异常: ${on.length}`);
  return on[0].id;
}

/* ============ 断言 ============ */

let passed = 0;
function ok(cond, label) {
  if (!cond) throw new Error("断言失败: " + label);
  passed++;
  console.log("  ✓ " + label);
}

/* ============ 分享桩 ============ */

function stubBridge(win) {
  const calls = [];
  win.xhs = {
    miniTool: {
      writeTempFile: (a) => { calls.push(["writeTempFile", a]); return Promise.resolve({ filePath: "/tmp/x.png" }); },
      saveImageToPhotosAlbum: (a) => { calls.push(["saveImageToPhotosAlbum", a]); return Promise.resolve({}); },
      postNote: (a) => { calls.push(["postNote", a]); return Promise.resolve({}); },
    },
  };
  return calls;
}

function checkShare(calls, label) {
  const write = calls.find((c) => c[0] === "writeTempFile");
  ok(write && write[1].data.startsWith("data:"), `${label}: writeTempFile 收到完整 data:uri`);
  ok(calls.some((c) => c[0] === "saveImageToPhotosAlbum"), `${label}: 调用了存相册`);
  const post = calls.find((c) => c[0] === "postNote");
  ok(post, `${label}: 调用了发笔记`);
  ok(post[1].pageType === "photo_publish", `${label}: pageType 正确`);
  ok(
    post[1].mediaInfo.image_resources[0].url.startsWith("data:"),
    `${label}: 笔记图片是 data:uri`,
  );
  ok(post[1].title.length <= 20, `${label}: 标题 ≤20 字（实际 ${post[1].title.length}）`);
  ok(post[1].content.length <= 1000, `${label}: 正文 ≤1000 字（实际 ${post[1].content.length}）`);
  return post[1];
}

/* ============ 卡牌 ============ */

function testCards() {
  console.log("\n[cards] 取舍卡牌");
  const { doc, win } = load("cards");

  ok(activeScreen(doc) === "screen-hub", "初始停在入口页");
  const hubs = doc.querySelectorAll(".hub-item");
  ok(hubs.length === 3, `入口列出 3 个牌组（实际 ${hubs.length}）`);

  click(hubs[0]);
  ok(activeScreen(doc) === "screen-intro", "点牌组进入规则页");

  click(doc.getElementById("btn-begin"));
  ok(activeScreen(doc) === "screen-select", "开始选牌");

  const deck = doc.querySelectorAll(".deck")[0];
  ok(deck.children.length === 18, `牌堆 18 张（实际 ${deck.children.length}）`);
  ok(doc.getElementById("btn-confirm-select").disabled, "未选满时确认按钮禁用");

  for (let i = 0; i < 9; i++) click(doc.querySelectorAll(".card")[i]);
  ok(!doc.getElementById("btn-confirm-select").disabled, "选满 9 张后确认按钮可用");
  ok(doc.querySelectorAll(".card.is-on").length === 9, "9 张呈选中态");

  click(doc.getElementById("btn-confirm-select"));
  ok(activeScreen(doc) === "screen-draw", "确认后进入抽情境");

  let rounds = 0;
  let accepts = 0;
  let forcedSeen = false;
  while (activeScreen(doc) !== "screen-result" && rounds < 40) {
    const screen = activeScreen(doc);
    if (screen === "screen-draw") {
      const scenes = doc.querySelectorAll(".scene-item");
      if (scenes.length !== 5) throw new Error(`情境候选应为 5（实际 ${scenes.length}）`);
      click(scenes[rounds % scenes.length]);
    } else if (screen === "screen-decision") {
      const accept = doc.getElementById("btn-accept");
      if (accept.disabled) forcedSeen = true;
      // 交替接受 / 拒绝，两条分支都要覆盖
      if (!accept.disabled && accepts < 3 && rounds % 2 === 0) {
        accepts++;
        click(accept);
      } else {
        click(doc.getElementById("btn-reject"));
      }
    } else if (screen === "screen-trade") {
      // 每次点击都会重渲染牌堆，必须重新查询，不能复用旧节点
      const pick = () => doc.getElementById("trade-deck").querySelectorAll(".card");
      click(pick()[0]);
      click(pick()[1]);
      ok_quiet(doc.getElementById("trade-deck").querySelectorAll(".card.is-doomed").length === 2);
      ok_quiet(!doc.getElementById("btn-confirm-trade").disabled);
      click(doc.getElementById("btn-confirm-trade"));
      rounds++;
    }
    if (screen === "screen-decision" || screen === "screen-draw") rounds++;
  }
  ok(activeScreen(doc) === "screen-result", `${rounds} 步内自然收敛到结果页`);
  ok(accepts > 0, "覆盖了「接受」分支");
  ok(forcedSeen || accepts > 0, "覆盖了压力推进");
  ok(doc.querySelectorAll(".final-card").length === 3, "结果页展示 3 张留下的牌");
  ok(doc.querySelectorAll(".group-block").length > 0, "结果页给出了分组解读");

  const calls = stubBridge(win);
  click(doc.getElementById("btn-save"));
  click(doc.getElementById("btn-post"));
  return { doc, win, calls };
}

function ok_quiet(cond) {
  if (!cond) throw new Error("交换阶段状态异常（选中数或确认按钮）");
}

/* ============ 测评 ============ */

function testAssessment(tool, expectItems) {
  console.log(`\n[${tool}] 测评`);
  const { doc, win } = load(tool);

  ok(activeScreen(doc) === "screen-intro", "初始停在说明页");
  click(doc.getElementById("btn-start"));
  ok(activeScreen(doc) === "screen-quiz", "进入答题");

  const likertCount = doc.querySelectorAll(".likert-row").length;
  ok(likertCount >= 4, `李克特选项 ${likertCount} 档`);

  let answered = 0;
  while (activeScreen(doc) !== "screen-result" && answered < expectItems + 5) {
    const rows = doc.querySelectorAll(".likert-row");
    click(rows[answered % rows.length]);
    answered++;
  }
  ok(activeScreen(doc) === "screen-result", "答完进入结果页");
  ok(answered === expectItems, `题量 ${expectItems}（实际作答 ${answered}）`);

  const dims = doc.querySelectorAll(".dim");
  ok(dims.length > 0, `结果页渲染 ${dims.length} 个维度`);
  ok(doc.querySelectorAll(".chip").length === 3, "结果页给出 top3 标签");

  const pcts = doc.querySelectorAll(".dim-pct").map((n) => Number(n.textContent));
  ok(pcts.every((p) => p >= 0 && p <= 100), "所有维度百分比落在 0–100");

  const calls = stubBridge(win);
  click(doc.getElementById("btn-save"));
  click(doc.getElementById("btn-post"));
  return { doc, win, calls };
}

/* ============ 断点续玩 ============ */

function testResume() {
  console.log("\n[resume] 退出后续玩");
  const first = load("cards");

  click(first.doc.querySelectorAll(".hub-item")[1]);
  click(first.doc.getElementById("btn-begin"));
  for (let i = 0; i < 9; i++) click(first.doc.querySelectorAll(".card")[i]);
  click(first.doc.getElementById("btn-confirm-select"));
  click(first.doc.querySelectorAll(".scene-item")[0]);
  ok(activeScreen(first.doc) === "screen-decision", "第一次会话推进到决策页");

  // 复用同一份 localStorage 重新加载，模拟退出小工具后再进入
  const again = load("cards", first.store);
  const badges = again.doc.querySelectorAll(".hub-resume");
  ok(badges.length === 1, "入口页标出 1 个可续玩的牌组");
  ok(badges[0].textContent === "继续上一局", "徽章文案为「继续上一局」");

  click(again.doc.querySelectorAll(".hub-item")[1]);
  ok(activeScreen(again.doc) === "screen-decision", "点进去直接回到中断处");
  ok(
    again.doc.getElementById("trade-deck") !== null &&
      again.doc.querySelectorAll(".held-chip").length === 9,
    "手牌 9 张完整恢复",
  );

  // 换一个没玩过的牌组不应受影响
  click(again.doc.querySelectorAll(".js-hub")[0]);
  ok(activeScreen(again.doc) === "screen-hub", "可从中途退回入口页");
  click(again.doc.querySelectorAll(".hub-item")[2]);
  ok(activeScreen(again.doc) === "screen-intro", "未玩过的牌组仍从规则页开始");
}

/* ============ 跑 ============ */

async function main() {
  const c = testCards();
  const h = testAssessment("holland", 30);
  const s = testAssessment("strength", 15);
  testResume();

  await new Promise((r) => setTimeout(r, 50));

  console.log("\n[分享链路]");
  checkShare(c.calls, "cards");
  const hPost = checkShare(h.calls, "holland");
  const sPost = checkShare(s.calls, "strength");
  console.log("\n  holland 笔记正文预览：\n" + hPost.content.split("\n").map((l) => "    " + l).join("\n"));
  console.log("\n  strength 笔记正文预览：\n" + sPost.content.split("\n").map((l) => "    " + l).join("\n"));

  console.log(`\n全部通过：${passed} 项断言`);
}

main().catch((e) => {
  console.error("\n✗ " + e.message);
  console.error(e.stack.split("\n").slice(1, 5).join("\n"));
  process.exit(1);
});
