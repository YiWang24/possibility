/* 李克特测评计分与进度 —— 移植自 web/features/studio/assessment/engine.ts 的计分语义：
   正向题取选项下标，反向题取 (likertMax - 下标)；维度百分比 = 得分 / 满分。
   进度与结果存 localStorage（小工具间隔离）。经典脚本，挂载 window.RN.assess。 */

window.RN = window.RN || {};

(function () {
  "use strict";

  var PROGRESS_KEY = "kaleido_mini_progress_";
  var RESULT_KEY = "kaleido_mini_result_";

  function lsGet(key) {
    try {
      return window.localStorage.getItem(key);
    } catch (e) {
      return null;
    }
  }

  function lsSet(key, value) {
    try {
      window.localStorage.setItem(key, value);
    } catch (e) {
      /* 隐私模式静默失败，不影响答题 */
    }
  }

  function lsRemove(key) {
    try {
      window.localStorage.removeItem(key);
    } catch (e) {
      /* ignore */
    }
  }

  /** 读进度，题量变化时按新题量对齐（截断 / 补 null） */
  function loadProgress(kind, itemCount) {
    var answers = new Array(itemCount);
    for (var i = 0; i < itemCount; i++) answers[i] = null;
    var raw = lsGet(PROGRESS_KEY + kind);
    if (!raw) return answers;
    try {
      var parsed = JSON.parse(raw);
      var stored = parsed && parsed.answers;
      if (!stored || !stored.length) return answers;
      var limit = Math.min(itemCount, stored.length);
      for (var j = 0; j < limit; j++) {
        answers[j] = typeof stored[j] === "number" ? stored[j] : null;
      }
    } catch (e) {
      /* 损坏的进度直接当作空白 */
    }
    return answers;
  }

  function saveProgress(kind, answers) {
    lsSet(PROGRESS_KEY + kind, JSON.stringify({ answers: answers }));
  }

  function clearProgress(kind) {
    lsRemove(PROGRESS_KEY + kind);
  }

  function loadResult(kind) {
    var raw = lsGet(RESULT_KEY + kind);
    if (!raw) return null;
    try {
      return JSON.parse(raw);
    } catch (e) {
      return null;
    }
  }

  function saveResult(kind, result) {
    lsSet(RESULT_KEY + kind, JSON.stringify(result));
  }

  /** 单题得分：反向题取反；未答按 0（结果只在全部答完后展示） */
  function itemValue(index, likertMax, reversed) {
    if (index === null || index === undefined) return 0;
    return reversed ? likertMax - index : index;
  }

  /** 按配置维度顺序计分，返回带元信息的 DimScore[] */
  function scoreDims(config, answers) {
    var likertMax = config.likert.length - 1;
    var totals = {};
    config.items.forEach(function (item, i) {
      var entry = totals[item.dim] || { score: 0, count: 0 };
      entry.score += itemValue(answers[i], likertMax, item.reversed);
      entry.count += 1;
      totals[item.dim] = entry;
    });
    return config.dims.map(function (d) {
      var t = totals[d.key] || { score: 0, count: 0 };
      var max = t.count * likertMax;
      return {
        key: d.key,
        name: d.name,
        label: d.label,
        color: d.color,
        desc: d.desc,
        score: t.score,
        max: max,
        percent: max > 0 ? t.score / max : 0,
      };
    });
  }

  /** 得分降序（仅取有得分的维度） */
  function ranked(dims) {
    return dims
      .filter(function (d) {
        return d.score > 0;
      })
      .slice()
      .sort(function (a, b) {
        return b.percent - a.percent;
      });
  }

  /** 写入画像的关键词：前 3 高维度的 label */
  function deriveTags(dims) {
    return ranked(dims)
      .slice(0, 3)
      .map(function (d) {
        return d.label;
      });
  }

  function buildResult(kind, config, answers) {
    var dims = scoreDims(config, answers);
    var result = {
      kind: kind,
      answers: answers.slice(),
      dims: dims.map(function (d) {
        return { key: d.key, score: d.score, max: d.max, percent: d.percent };
      }),
      tags: deriveTags(dims),
      completedAt: Date.now(),
    };
    saveResult(kind, result);
    return { result: result, dims: dims };
  }

  /** 持久化结果 → 补回配置元信息，供结果页直接渲染 */
  function hydrateDims(config, stored) {
    return stored.map(function (s) {
      var meta = null;
      config.dims.forEach(function (d) {
        if (d.key === s.key) meta = d;
      });
      return {
        key: s.key,
        name: (meta && meta.name) || s.key,
        label: (meta && meta.label) || s.key,
        color: (meta && meta.color) || "#5E96FF",
        desc: (meta && meta.desc) || "",
        score: s.score,
        max: s.max,
        percent: s.percent,
      };
    });
  }

  function firstUnanswered(answers) {
    for (var i = 0; i < answers.length; i++) {
      if (answers[i] === null || answers[i] === undefined) return i;
    }
    return -1;
  }

  function answeredCount(answers) {
    var n = 0;
    answers.forEach(function (a) {
      if (a !== null && a !== undefined) n += 1;
    });
    return n;
  }

  window.RN.assess = {
    loadProgress: loadProgress,
    saveProgress: saveProgress,
    clearProgress: clearProgress,
    loadResult: loadResult,
    scoreDims: scoreDims,
    ranked: ranked,
    deriveTags: deriveTags,
    buildResult: buildResult,
    hydrateDims: hydrateDims,
    firstUnanswered: firstUnanswered,
    answeredCount: answeredCount,
  };
})();
