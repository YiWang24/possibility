/* 测评视图流程 —— intro → 逐题 → 结果，霍兰德与优势探索共用。
   单题单屏、点选即进入下一题；进度实时落 localStorage，可退出续答。
   经典脚本，挂载 window.RN.assessView，依赖 assessment-engine.js / ui.js / share-card.js。 */

window.RN = window.RN || {};

(function () {
  "use strict";

  var el = window.RN.ui.el;
  var clear = window.RN.ui.clear;

  function pad2(n) {
    return n < 10 ? "0" + n : String(n);
  }

  /* ============ intro ============ */

  function renderIntro(state) {
    var cfg = state.config;
    var host = document.getElementById("intro-body");
    clear(host);

    host.appendChild(el("p", { class: "kicker", text: cfg.kicker }));
    host.appendChild(el("h1", { class: "display", text: cfg.introTitle }));
    host.appendChild(el("p", { class: "lede", text: cfg.intro }));

    var list = el("ul", { class: "notices" });
    cfg.notices.forEach(function (line) {
      list.appendChild(el("li", { class: "notice", text: line }));
    });
    host.appendChild(list);

    var done = window.RN.assess.answeredCount(state.answers);
    var startBtn = document.getElementById("btn-start");
    startBtn.textContent =
      done > 0 && done < cfg.items.length
        ? "继续作答 · 已完成 " + done + " / " + cfg.items.length
        : "开始 " + cfg.items.length + " 题";

    var resetBtn = document.getElementById("btn-reset-intro");
    resetBtn.style.display = done > 0 ? "block" : "none";
  }

  /* ============ 答题 ============ */

  function renderQuestion(state) {
    var cfg = state.config;
    var item = cfg.items[state.index];
    var host = document.getElementById("quiz-body");
    clear(host);

    host.appendChild(
      el("p", {
        class: "kicker",
        text: pad2(state.index + 1) + " / " + cfg.items.length,
      }),
    );
    host.appendChild(el("h2", { class: "question", text: item.text }));

    var options = el("div", { class: "likert" });
    cfg.likert.forEach(function (label, choice) {
      var active = state.answers[state.index] === choice;
      var row = el("button", {
        class: "likert-row" + (active ? " is-on" : ""),
        type: "button",
        "data-choice": String(choice),
      }, [
        el("span", { class: "likert-dot" }),
        el("span", { class: "likert-label", text: label }),
      ]);
      options.appendChild(row);
    });
    host.appendChild(options);

    window.RN.ui.setRail(state.index / cfg.items.length);
    document.getElementById("btn-back").style.display =
      state.index > 0 ? "block" : "none";
  }

  function choose(state, choice) {
    state.answers[state.index] = choice;
    window.RN.assess.saveProgress(state.kind, state.answers);

    var isLast = state.index >= state.config.items.length - 1;
    if (isLast) {
      var next = window.RN.assess.firstUnanswered(state.answers);
      if (next === -1) {
        finish(state);
        return;
      }
      state.index = next;
    } else {
      state.index += 1;
    }
    renderQuestion(state);
  }

  /* ============ 结果 ============ */

  function renderResult(state, dims) {
    var cfg = state.config;
    var host = document.getElementById("result-body");
    clear(host);

    var top = window.RN.assess.ranked(dims);
    var accent = (top[0] && top[0].color) || "#5E96FF";

    host.appendChild(el("p", { class: "kicker", text: cfg.resultSub }));
    host.appendChild(el("h1", { class: "display", text: cfg.resultTitle }));

    if (state.options.narrative) {
      var line = state.options.narrative(dims);
      if (line) host.appendChild(el("p", { class: "lede selectable", text: line }));
    }

    var chips = el("div", { class: "chips" });
    top.slice(0, 3).forEach(function (d) {
      chips.appendChild(
        el("span", {
          class: "chip",
          style: "border-color:" + d.color + "66;color:" + d.color,
          text: d.label,
        }),
      );
    });
    host.appendChild(chips);
    host.appendChild(el("hr", { class: "divider" }));

    dims.forEach(function (d) {
      host.appendChild(renderDimRow(d));
    });

    window.RN.ui.setRail(1);
    state.accent = accent;
    state.dims = dims;
  }

  function renderDimRow(d) {
    var pct = Math.round(d.percent * 100);
    var row = el("div", { class: "dim" }, [
      el("div", { class: "dim-head" }, [
        el("span", { class: "dim-name", text: d.name }),
        el("span", { class: "dim-pct", text: String(pct) }),
      ]),
      el("div", { class: "dim-rail" }, [
        el("i", {
          style: "width:" + pct + "%;background:" + d.color,
        }),
      ]),
      el("p", { class: "dim-desc", text: d.desc }),
    ]);
    return row;
  }

  function finish(state) {
    var built = window.RN.assess.buildResult(
      state.kind,
      state.config,
      state.answers,
    );
    renderResult(state, built.dims);
    window.RN.ui.showScreen("screen-result");
  }

  /* ============ 装配 ============ */

  function bindQuiz(state) {
    document.getElementById("quiz-body").addEventListener("click", function (e) {
      var row = e.target.closest && e.target.closest(".likert-row");
      if (!row) return;
      choose(state, Number(row.getAttribute("data-choice")));
    });

    document.getElementById("btn-back").addEventListener("click", function () {
      if (state.index > 0) {
        state.index -= 1;
        renderQuestion(state);
      }
    });
  }

  function restart(state) {
    window.RN.assess.clearProgress(state.kind);
    for (var i = 0; i < state.answers.length; i++) state.answers[i] = null;
    state.index = 0;
    window.RN.ui.setRail(0);
    renderIntro(state);
    window.RN.ui.showScreen("screen-intro");
  }

  function bindShell(state) {
    document.getElementById("btn-start").addEventListener("click", function () {
      var next = window.RN.assess.firstUnanswered(state.answers);
      state.index = next === -1 ? 0 : next;
      renderQuestion(state);
      window.RN.ui.showScreen("screen-quiz");
    });

    document
      .getElementById("btn-reset-intro")
      .addEventListener("click", function () {
        restart(state);
      });

    document.getElementById("btn-restart").addEventListener("click", function () {
      restart(state);
    });

    window.RN.ui.bindShare({
      saveButton: document.getElementById("btn-save"),
      postButton: document.getElementById("btn-post"),
      doneMessage: "已完成",
      noteTitle: state.config.title,
      noteContent: function () {
        return state.options.noteContent(state.dims);
      },
      getDataUri: function () {
        return window.RN.shareCard.render(
          state.options.shareSpec(state.dims, state.accent),
        );
      },
    });
  }

  /**
   * 启动一个测评小工具。
   * @param {object} config 题库配置（kind/title/items/dims/likert...）
   * @param {{narrative?:Function, shareSpec:Function, noteContent:Function}} options
   */
  function mount(config, options) {
    var state = {
      kind: config.kind,
      config: config,
      options: options,
      answers: window.RN.assess.loadProgress(config.kind, config.items.length),
      index: 0,
      dims: [],
      accent: "#5E96FF",
    };

    document.title = config.title;
    var titleNode = document.getElementById("shell-title");
    if (titleNode) titleNode.textContent = config.title;

    bindShell(state);
    bindQuiz(state);
    renderIntro(state);
    window.RN.ui.showScreen("screen-intro");
  }

  window.RN.assessView = { mount: mount };
})();
