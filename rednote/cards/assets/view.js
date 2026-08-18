/* 取舍卡牌视图 —— hub → 规则 → 选牌 → 抽情境 → 决策 → 交换 → 结果。
   单页内 JS 切换 .screen，事件全部 addEventListener 绑定。
   经典脚本，依赖 data.js / engine.js / ui.js / share-card.js。 */

(function () {
  "use strict";

  var el = window.RN.ui.el;
  var clear = window.RN.ui.clear;
  var showScreen = window.RN.ui.showScreen;
  var CardGame = window.RN.CardGame;

  var SEV_COLORS = ["#7DB5A0", "#D9B563", "#E7935C", "#E86A6A"];

  var state = { game: null };

  function sevColor(severity) {
    return SEV_COLORS[Math.max(0, Math.min(3, severity - 1))];
  }

  function setTint(color) {
    document.documentElement.style.setProperty("--tint", color);
  }

  /* ============ 入口 ============ */

  function renderHub() {
    var host = document.getElementById("hub-list");
    clear(host);
    setTint("#8F7BFF");

    window.RN.data.games.forEach(function (config) {
      var probe = new CardGame(config);
      var badge = null;
      if (probe.restore()) {
        badge = probe.phase === "result" ? "查看上次结果" : "继续上一局";
      }
      var item = el("button", {
        class: "hub-item",
        type: "button",
        style: "--tint:" + config.accent,
        "data-kind": config.kind,
      }, [
        el("div", { class: "hub-glyph", text: config.glyph }),
        el("div", { class: "hub-name", text: config.title }),
        el("p", { class: "hub-copy", text: config.selectTitle }),
        badge ? el("span", { class: "hub-resume", text: badge }) : null,
      ]);
      host.appendChild(item);
    });
  }

  function openGame(kind) {
    var config = window.RN.data.byKind[kind];
    if (!config) return;
    var game = new CardGame(config);
    state.game = game;
    setTint(config.accent);
    document.title = config.title;

    if (game.restore() && game.phase !== "intro") {
      route();
      return;
    }
    renderIntro();
    showScreen("screen-intro");
  }

  /* ============ 规则 ============ */

  function renderIntro() {
    var config = state.game.config;
    var host = document.getElementById("intro-body");
    clear(host);

    host.appendChild(el("p", { class: "kicker", text: config.eyebrow }));
    host.appendChild(el("h1", { class: "display", text: config.introTitle }));
    host.appendChild(el("p", { class: "lede", text: config.introCopy }));

    var list = el("ol", { class: "rules" });
    config.rules.forEach(function (rule) {
      list.appendChild(
        el("li", { class: "rule-item" }, [
          el("div", {}, [
            el("div", { class: "rule-title", text: rule[0] }),
            el("p", { class: "rule-copy", text: rule[1] }),
          ]),
        ]),
      );
    });
    host.appendChild(list);
    window.RN.ui.setRail(0);
  }

  /* ============ 选牌 ============ */

  function renderSelect() {
    var game = state.game;
    var head = document.getElementById("select-head");
    clear(head);
    head.appendChild(el("p", { class: "kicker", text: "STEP 01 · 选择底牌" }));
    head.appendChild(
      el("h2", { class: "display", text: game.config.selectTitle }),
    );
    head.appendChild(
      el("p", { class: "lede", text: "凭直觉选 9 张，不必反复权衡。" }),
    );

    var deck = document.getElementById("select-deck");
    clear(deck);
    game.config.cards.forEach(function (c) {
      var order = game.selected.indexOf(c.id);
      deck.appendChild(
        el("button", {
          class: "card" + (order >= 0 ? " is-on" : ""),
          type: "button",
          "data-id": c.id,
        }, [
          order >= 0
            ? el("span", { class: "card-index", text: String(order + 1) })
            : null,
          el("span", { class: "card-glyph", text: c.glyph }),
          el("span", { class: "card-name", text: c.name }),
        ]),
      );
    });
    updateSelectDock();
  }

  function updateSelectDock() {
    var game = state.game;
    var need = CardGame.INITIAL_SELECT;
    document.getElementById("select-count").textContent =
      "已选 " + game.selected.length + " / " + need;
    document.getElementById("btn-confirm-select").disabled =
      game.selected.length !== need;
    window.RN.ui.setRail(game.progress());
  }

  /* ============ 抽情境 ============ */

  function pressureNode() {
    var game = state.game;
    var meta = game.severityMeta();
    var bars = el("span", { class: "pressure-bars" });
    for (var i = 1; i <= game.pressureMax; i++) {
      bars.appendChild(el("i", { class: i <= game.pressure ? "is-on" : "" }));
    }
    return el("div", { class: "pressure" }, [
      bars,
      el("span", { class: "pressure-name", text: meta.name }),
    ]);
  }

  function renderDraw() {
    var game = state.game;
    var host = document.getElementById("draw-body");
    clear(host);

    host.appendChild(
      el("p", {
        class: "kicker",
        text: game.config.pressureLabel + " · 第 " + (game.round + 1) + " 轮",
      }),
    );
    host.appendChild(pressureNode());
    host.appendChild(
      el("h2", {
        class: "display",
        style: "font-size:26px;margin-top:14px",
        text: "选择一个此刻正在发生的情境",
      }),
    );
    host.appendChild(
      el("p", { class: "lede", text: game.severityMeta().copy }),
    );

    var list = el("div", { class: "scene-list" });
    game.scenarioOptions().forEach(function (scenario) {
      list.appendChild(sceneNode(scenario));
    });
    host.appendChild(list);
    host.appendChild(heldStrip());
    window.RN.ui.setRail(game.progress());
  }

  function sceneNode(scenario) {
    return el("button", {
      class: "scene-item",
      type: "button",
      "data-title": scenario.title,
    }, [
      el("div", { class: "scene-head" }, [
        el("i", {
          class: "sev-dot",
          style: "background:" + sevColor(scenario.severity),
        }),
        el("span", { class: "scene-theme", text: scenario.theme }),
      ]),
      el("div", { class: "scene-title", text: scenario.title }),
      el("p", { class: "scene-copy", text: scenario.copy }),
    ]);
  }

  function heldStrip() {
    var strip = el("div", { class: "held-strip" });
    state.game.heldCards().forEach(function (c) {
      strip.appendChild(el("span", { class: "held-chip", text: c.name }));
    });
    return el("div", {}, [
      el("p", {
        class: "kicker",
        style: "margin-top:26px",
        text: "手中 " + state.game.held.length + " 张",
      }),
      strip,
    ]);
  }

  /* ============ 决策 ============ */

  function renderDecision() {
    var game = state.game;
    var scenario = game.current;
    var host = document.getElementById("decision-body");
    clear(host);
    if (!scenario) return;

    host.appendChild(el("p", { class: "kicker", text: "面对这件事" }));
    host.appendChild(pressureNode());

    host.appendChild(
      el("div", { class: "scene-hero" }, [
        el("div", { class: "scene-head" }, [
          el("i", {
            class: "sev-dot",
            style: "background:" + sevColor(scenario.severity),
          }),
          el("span", { class: "scene-theme", text: scenario.theme }),
        ]),
        el("div", { class: "scene-title", text: scenario.title }),
        el("p", { class: "scene-copy", text: scenario.copy }),
      ]),
    );

    var forced = game.isForcedTrade();
    host.appendChild(
      el("p", {
        class: "notice",
        style: "margin-top:20px",
        text: forced
          ? "压力已经到顶，这一轮无法再接受，只能放下 2 张。"
          : "接受，会保留全部底牌，但下一轮情境继续加码；不接受，就要放下 2 张。",
      }),
    );
    host.appendChild(heldStrip());

    var acceptBtn = document.getElementById("btn-accept");
    acceptBtn.disabled = forced;
    acceptBtn.textContent = forced ? "已无法接受" : "接受，继续持有";
    window.RN.ui.setRail(game.progress());
  }

  /* ============ 交换 ============ */

  function renderTrade() {
    var game = state.game;
    var head = document.getElementById("trade-head");
    clear(head);
    head.appendChild(el("p", { class: "kicker", text: "放下 2 张" }));
    head.appendChild(
      el("h2", {
        class: "display",
        style: "font-size:26px",
        text: "这一轮，你决定不再带着哪两张？",
      }),
    );
    head.appendChild(
      el("p", {
        class: "lede",
        text: game.current ? "因为「" + game.current.title + "」。" : "",
      }),
    );

    var deck = document.getElementById("trade-deck");
    clear(deck);
    game.heldCards().forEach(function (c) {
      var picked = game.tradePick.indexOf(c.id) >= 0;
      deck.appendChild(
        el("button", {
          class: "card" + (picked ? " is-doomed" : ""),
          type: "button",
          "data-id": c.id,
        }, [
          el("span", { class: "card-glyph", text: c.glyph }),
          el("span", { class: "card-name", text: c.name }),
        ]),
      );
    });
    updateTradeDock();
  }

  function updateTradeDock() {
    var game = state.game;
    var need = CardGame.DISCARD_PER_TRADE;
    document.getElementById("trade-count").textContent =
      "已选 " + game.tradePick.length + " / " + need;
    document.getElementById("btn-confirm-trade").disabled =
      game.tradePick.length !== need;
  }

  /* ============ 结果 ============ */

  function renderResult() {
    var game = state.game;
    var host = document.getElementById("result-body");
    clear(host);

    host.appendChild(el("p", { class: "kicker", text: game.config.eyebrow }));
    host.appendChild(
      el("h1", { class: "display", text: "最后留下的三张" }),
    );

    var row = el("div", { class: "final-row" });
    game.heldCards().forEach(function (c) {
      row.appendChild(
        el("div", { class: "final-card" }, [
          el("div", { class: "final-glyph", text: c.glyph }),
          el("div", { class: "final-name", text: c.name }),
        ]),
      );
    });
    host.appendChild(row);

    game.groupSummary().forEach(function (block) {
      host.appendChild(
        el("div", { class: "group-block" }, [
          el("div", { class: "group-title", text: block.group }),
          el("p", { class: "group-copy selectable", text: block.copy }),
        ]),
      );
    });

    host.appendChild(statRow());
    window.RN.ui.setRail(1);
  }

  function statRow() {
    var game = state.game;
    return el("div", { class: "stat-row" }, [
      el("div", {}, [
        el("div", { class: "stat-num", text: String(game.round) }),
        el("div", { class: "stat-label", text: "经历轮次" }),
      ]),
      el("div", {}, [
        el("div", { class: "stat-num", text: String(game.accepted.length) }),
        el("div", { class: "stat-label", text: "选择接受" }),
      ]),
      el("div", {}, [
        el("div", { class: "stat-num", text: String(game.traded.length) }),
        el("div", { class: "stat-label", text: "选择放下" }),
      ]),
    ]);
  }

  /* ============ 分享 ============ */

  function shareSpec() {
    var game = state.game;
    var groups = game.groupSummary();
    return {
      kicker: game.config.eyebrow,
      title: "最后留下的三张",
      sub: groups.length ? groups[0].copy : "",
      accent: game.config.accent,
      entries: game.heldCards().map(function (c) {
        return { glyph: c.glyph, name: c.name, copy: c.copy };
      }),
      footnote:
        "经历 " + game.round + " 轮 · 接受 " + game.accepted.length +
        " 次 · 放下 " + game.traded.length + " 次",
    };
  }

  function noteContent() {
    var game = state.game;
    var names = game.heldCards().map(function (c) {
      return c.name;
    });
    var groups = game.groupSummary();
    var text =
      "玩了一局「" + game.config.title + "」，" +
      "在 " + game.round + " 轮取舍之后，最后留下的是：\n" +
      names.join(" · ");
    if (groups.length && groups[0].copy) text += "\n\n" + groups[0].copy;
    return text;
  }

  /* ============ 路由 ============ */

  function route() {
    var phase = state.game.phase;
    if (phase === "select") {
      renderSelect();
      showScreen("screen-select");
    } else if (phase === "draw") {
      renderDraw();
      showScreen("screen-draw");
    } else if (phase === "decision") {
      renderDecision();
      showScreen("screen-decision");
    } else if (phase === "trade") {
      renderTrade();
      showScreen("screen-trade");
    } else if (phase === "result") {
      renderResult();
      showScreen("screen-result");
    } else {
      renderIntro();
      showScreen("screen-intro");
    }
  }

  /* ============ 事件 ============ */

  function goHub() {
    state.game = null;
    document.title = "取舍卡牌 · 最后会留下什么";
    renderHub();
    window.RN.ui.setRail(0);
    showScreen("screen-hub");
  }

  function bindHub() {
    document.getElementById("hub-list").addEventListener("click", function (e) {
      var item = e.target.closest && e.target.closest(".hub-item");
      if (item) openGame(item.getAttribute("data-kind"));
    });

    var backs = document.querySelectorAll(".js-hub");
    for (var i = 0; i < backs.length; i++) {
      backs[i].addEventListener("click", goHub);
    }
  }

  function bindSelect() {
    document
      .getElementById("btn-begin")
      .addEventListener("click", function () {
        state.game.start();
        route();
      });

    document
      .getElementById("select-deck")
      .addEventListener("click", function (e) {
        var node = e.target.closest && e.target.closest(".card");
        if (!node) return;
        var warn = state.game.toggleSelect(node.getAttribute("data-id"));
        if (warn) {
          window.RN.ui.toast(warn);
          return;
        }
        renderSelect();
      });

    document
      .getElementById("btn-confirm-select")
      .addEventListener("click", function () {
        state.game.confirmSelection();
        route();
      });
  }

  function bindPlay() {
    document.getElementById("draw-body").addEventListener("click", function (e) {
      var node = e.target.closest && e.target.closest(".scene-item");
      if (!node) return;
      var title = node.getAttribute("data-title");
      var picked = null;
      state.game.config.scenarios.forEach(function (s) {
        if (s.title === title) picked = s;
      });
      if (!picked) return;
      state.game.draw(picked);
      route();
    });

    document.getElementById("btn-accept").addEventListener("click", function () {
      state.game.accept();
      route();
    });

    document.getElementById("btn-reject").addEventListener("click", function () {
      if (!state.game.canTrade()) {
        window.RN.ui.toast("手里已经是最后三张了");
        return;
      }
      state.game.beginTrade();
      route();
    });
  }

  function bindTrade() {
    document
      .getElementById("trade-deck")
      .addEventListener("click", function (e) {
        var node = e.target.closest && e.target.closest(".card");
        if (!node) return;
        var warn = state.game.toggleTrade(node.getAttribute("data-id"));
        if (warn) {
          window.RN.ui.toast(warn);
          return;
        }
        renderTrade();
      });

    document
      .getElementById("btn-confirm-trade")
      .addEventListener("click", function () {
        state.game.confirmTrade();
        route();
      });

    document
      .getElementById("btn-cancel-trade")
      .addEventListener("click", function () {
        state.game.cancelTrade();
        route();
      });
  }

  function bindResult() {
    document.getElementById("btn-restart").addEventListener("click", function () {
      state.game.clear();
      state.game.start();
      route();
    });

    window.RN.ui.bindShare({
      saveButton: document.getElementById("btn-save"),
      postButton: document.getElementById("btn-post"),
      doneMessage: "已完成",
      noteTitle: "最后留下的三张",
      noteContent: noteContent,
      getDataUri: function () {
        return window.RN.shareCard.render(shareSpec());
      },
    });
  }

  bindHub();
  bindSelect();
  bindPlay();
  bindTrade();
  bindResult();
  renderHub();
  showScreen("screen-hub");
})();
