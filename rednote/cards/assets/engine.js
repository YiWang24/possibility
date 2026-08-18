/* 取舍卡牌状态机 —— 移植自 web/features/card-game/engine.ts 的核心玩法语义：
   18 选 9 → 每轮抽情境 → 接受则压力 +1（满级后只能交换）/ 不接受则弃 2 张压力 -1
   → 手中自然剩 3 张时结束。情境候选按「与当前压力的距离 → 未出现过 → 稳定序」排序，
   全程无随机数，同样的操作序列可复现。经典脚本，挂 window.RN.CardGame。 */

window.RN = window.RN || {};

(function () {
  "use strict";

  var INITIAL_SELECT = 9;
  var FINAL_COUNT = 3;
  var DISCARD_PER_TRADE = 2;
  var SCENARIO_CHOICES = 5;
  var PRESSURE_MIN = 1;
  var PROGRESS_KEY = "kaleido_mini_cards_";

  function CardGame(config) {
    this.config = config;
    this.pressureMax = config.severityMeta.length;
    this.reset();
  }

  CardGame.prototype.reset = function () {
    this.phase = "intro";
    this.selected = [];
    this.held = [];
    this.accepted = [];
    this.traded = [];
    this.round = 0;
    this.pressure = PRESSURE_MIN;
    this.acceptStreak = 0;
    this.seenTitles = {};
    this.current = null;
    this.tradePick = [];
  };

  CardGame.prototype.card = function (id) {
    var found = null;
    this.config.cards.forEach(function (c) {
      if (c.id === id) found = c;
    });
    return found;
  };

  CardGame.prototype.heldCards = function () {
    var self = this;
    return this.held.map(function (id) {
      return self.card(id);
    });
  };

  CardGame.prototype.severityMeta = function () {
    var index = Math.max(
      0,
      Math.min(this.pressureMax - 1, this.pressure - PRESSURE_MIN),
    );
    return this.config.severityMeta[index];
  };

  /* ============ 流程 ============ */

  CardGame.prototype.start = function () {
    this.reset();
    this.phase = "select";
    this.save();
  };

  /** 选牌开关；已满时返回提示文案 */
  CardGame.prototype.toggleSelect = function (id) {
    var i = this.selected.indexOf(id);
    if (i >= 0) {
      this.selected.splice(i, 1);
    } else if (this.selected.length < INITIAL_SELECT) {
      this.selected.push(id);
    } else {
      return "这一局只能带走 " + INITIAL_SELECT + " 张底牌";
    }
    this.save();
    return null;
  };

  CardGame.prototype.confirmSelection = function () {
    if (this.selected.length !== INITIAL_SELECT) return;
    this.held = this.selected.slice();
    this.round = 0;
    this.pressure = PRESSURE_MIN;
    this.acceptStreak = 0;
    this.seenTitles = {};
    this.phase = "draw";
    this.save();
  };

  /** 候选情境：压力邻近优先、未出现过优先，再按稳定序打散 */
  CardGame.prototype.scenarioOptions = function () {
    var self = this;
    var candidates = this.config.scenarios.map(function (scenario, index) {
      return {
        scenario: scenario,
        distance: Math.abs(scenario.severity - self.pressure),
        seen: self.seenTitles[scenario.title] ? 1 : 0,
        order: (index * 7 + self.round * 11) % 23,
      };
    });
    candidates.sort(function (a, b) {
      if (a.distance !== b.distance) return a.distance - b.distance;
      if (a.seen !== b.seen) return a.seen - b.seen;
      return a.order - b.order;
    });
    return candidates.slice(0, SCENARIO_CHOICES).map(function (c) {
      return c.scenario;
    });
  };

  CardGame.prototype.draw = function (scenario) {
    this.current = scenario;
    this.seenTitles[scenario.title] = true;
    this.phase = "decision";
    this.save();
  };

  CardGame.prototype.canAccept = function () {
    return this.phase === "decision" && this.pressure < this.pressureMax;
  };

  CardGame.prototype.canTrade = function () {
    return this.held.length - DISCARD_PER_TRADE >= FINAL_COUNT;
  };

  /** 压力满级后不能再接受，只能交换 */
  CardGame.prototype.isForcedTrade = function () {
    return (
      (this.phase === "decision" || this.phase === "trade") &&
      this.pressure >= this.pressureMax
    );
  };

  CardGame.prototype.accept = function () {
    if (!this.current || !this.canAccept()) return;
    this.accepted.push({
      round: this.round,
      scenario: this.current,
      severity: this.pressure,
    });
    this.acceptStreak += 1;
    this.pressure = Math.min(this.pressureMax, this.pressure + 1);
    this.finishRound();
  };

  CardGame.prototype.beginTrade = function () {
    this.tradePick = [];
    this.phase = "trade";
    this.save();
  };

  CardGame.prototype.toggleTrade = function (id) {
    var i = this.tradePick.indexOf(id);
    if (i >= 0) {
      this.tradePick.splice(i, 1);
    } else if (this.tradePick.length < DISCARD_PER_TRADE) {
      this.tradePick.push(id);
    } else {
      return "这一轮需要交换 " + DISCARD_PER_TRADE + " 张底牌";
    }
    this.save();
    return null;
  };

  CardGame.prototype.confirmTrade = function () {
    if (this.tradePick.length !== DISCARD_PER_TRADE || !this.current) return;
    var picked = this.tradePick.slice();
    this.traded.push({
      round: this.round,
      scenario: this.current,
      ids: picked,
      decisionSource: this.isForcedTrade() ? "pressure_forced" : "voluntary_reject",
    });
    this.held = this.held.filter(function (id) {
      return picked.indexOf(id) === -1;
    });
    this.tradePick = [];
    this.acceptStreak = 0;
    this.pressure = Math.max(PRESSURE_MIN, this.pressure - 1);
    this.finishRound();
  };

  CardGame.prototype.cancelTrade = function () {
    this.tradePick = [];
    this.phase = "decision";
    this.save();
  };

  CardGame.prototype.finishRound = function () {
    this.round += 1;
    this.current = null;
    this.phase = this.held.length === FINAL_COUNT ? "result" : "draw";
    this.save();
  };

  /** 顶部进度条 0–1 */
  CardGame.prototype.progress = function () {
    if (this.phase === "intro") return 0;
    if (this.phase === "select") {
      return Math.max(0.04, this.selected.length * 0.02);
    }
    if (this.phase === "result") return 1;
    var releasable = INITIAL_SELECT - FINAL_COUNT;
    var released = (INITIAL_SELECT - this.held.length) / releasable;
    return Math.min(
      0.96,
      0.16 + released * 0.72 + Math.min(this.round, 8) * 0.015,
    );
  };

  /* ============ 结果解读 ============ */

  /** 留下的 3 张按分组聚合，返回 [{group, copy, cards}] 按张数降序 */
  CardGame.prototype.groupSummary = function () {
    var config = this.config;
    var buckets = {};
    var order = [];
    this.heldCards().forEach(function (c) {
      if (!buckets[c.group]) {
        buckets[c.group] = [];
        order.push(c.group);
      }
      buckets[c.group].push(c);
    });
    return order
      .map(function (group) {
        return {
          group: group,
          copy: config.groupCopy[group] || "",
          cards: buckets[group],
        };
      })
      .sort(function (a, b) {
        return b.cards.length - a.cards.length;
      });
  };

  /* ============ 持久化 ============ */

  CardGame.prototype.save = function () {
    try {
      window.localStorage.setItem(
        PROGRESS_KEY + this.config.kind,
        JSON.stringify({
          phase: this.phase,
          selected: this.selected,
          held: this.held,
          round: this.round,
          pressure: this.pressure,
          acceptStreak: this.acceptStreak,
          seenTitles: this.seenTitles,
          current: this.current,
          tradePick: this.tradePick,
          accepted: this.accepted,
          traded: this.traded,
        }),
      );
    } catch (e) {
      /* 隐私模式静默，不影响进行中的一局 */
    }
  };

  /** 读取存档；结构不完整时返回 false 并保持初始态 */
  CardGame.prototype.restore = function () {
    var raw = null;
    try {
      raw = window.localStorage.getItem(PROGRESS_KEY + this.config.kind);
    } catch (e) {
      return false;
    }
    if (!raw) return false;
    try {
      var s = JSON.parse(raw);
      if (!s || !s.phase || s.phase === "intro") return false;
      if (!Array.isArray(s.selected) || !Array.isArray(s.held)) return false;
      this.phase = s.phase;
      this.selected = s.selected;
      this.held = s.held;
      this.round = s.round || 0;
      this.pressure = s.pressure || PRESSURE_MIN;
      this.acceptStreak = s.acceptStreak || 0;
      this.seenTitles = s.seenTitles || {};
      this.current = s.current || null;
      this.tradePick = Array.isArray(s.tradePick) ? s.tradePick : [];
      this.accepted = Array.isArray(s.accepted) ? s.accepted : [];
      this.traded = Array.isArray(s.traded) ? s.traded : [];
      // decision 阶段没有 current 无法继续，退回抽牌
      if (this.phase === "decision" && !this.current) this.phase = "draw";
      if (this.phase === "trade" && !this.current) this.phase = "draw";
      return true;
    } catch (e) {
      return false;
    }
  };

  CardGame.prototype.clear = function () {
    try {
      window.localStorage.removeItem(PROGRESS_KEY + this.config.kind);
    } catch (e) {
      /* ignore */
    }
  };

  CardGame.INITIAL_SELECT = INITIAL_SELECT;
  CardGame.FINAL_COUNT = FINAL_COUNT;
  CardGame.DISCARD_PER_TRADE = DISCARD_PER_TRADE;

  window.RN.CardGame = CardGame;
})();
