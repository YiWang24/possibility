/* 霍兰德小工具装配 —— 提供兴趣代码叙事、分享卡规格与笔记正文，交给共用视图挂载。
   移植 engine.ts 的 hollandCode / hollandNarrative 语义。经典脚本，最后加载。 */

(function () {
  "use strict";

  var data = window.RN.data;

  /** RIASEC 兴趣代码：前三位有得分的维度 */
  function code(dims) {
    return window.RN.assess
      .ranked(dims)
      .slice(0, 3)
      .map(function (d) {
        return d.key;
      })
      .join("");
  }

  /** 前两位组合叙事，尝试两种字母序 */
  function narrative(dims) {
    var top = window.RN.assess.ranked(dims).slice(0, 2);
    if (top.length < 2) return "";
    var a = top[0].key;
    var b = top[1].key;
    return data.pairNarrative[a + b] || data.pairNarrative[b + a] || "";
  }

  function shareSpec(dims, accent) {
    return {
      kicker: "RIASEC · " + code(dims),
      title: "我的兴趣画像",
      sub: narrative(dims),
      accent: accent,
      bars: dims.map(function (d) {
        return { label: d.name, percent: d.percent, color: d.color };
      }),
      footnote: "兴趣描述偏好，不代表能力或职业判决 · 量表来源 O*NET Mini-IP",
    };
  }

  function noteContent(dims) {
    var top = window.RN.assess.ranked(dims).slice(0, 3);
    var lines = top.map(function (d) {
      return d.name + " " + Math.round(d.percent * 100);
    });
    var text =
      "我的霍兰德兴趣代码是 " + code(dims) + "。\n" + lines.join(" · ");
    var line = narrative(dims);
    if (line) text += "\n\n" + line;
    return text + "\n\n（兴趣不等于能力，也不是职业判决）";
  }

  window.RN.assessView.mount(data.config, {
    narrative: narrative,
    shareSpec: shareSpec,
    noteContent: noteContent,
  });
})();
