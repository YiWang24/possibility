/* 优势探索小工具装配 —— 用前两位优势拼出一句证据式叙事，交给共用视图挂载。
   经典脚本，最后加载。 */

(function () {
  "use strict";

  var data = window.RN.data;

  /** 两两组合叙事：说明两种优势叠加时的典型工作方式 */
  var PAIR_NARRATIVE = {
    "structure|empathy": "你能把混乱理清，也能照顾到人在其中的感受。",
    "structure|expression": "你先把问题理出结构，再让别人也看懂这个结构。",
    "structure|execution": "你擅长把复杂目标拆成能被推动的具体步骤。",
    "structure|learning": "你会从新领域里快速提炼规律，并整理成可用的框架。",
    "empathy|expression": "你能听出别人真正的意思，再帮他把话说清楚。",
    "empathy|execution": "你在推动事情时会照顾阻力背后的真实顾虑。",
    "empathy|learning": "你从人与反馈中学习，理解别人的经验并迁移过来。",
    "expression|execution": "你能把想法讲清楚，也能带着它落到实处。",
    "expression|learning": "你学得快，也擅长把学到的东西讲给别人听。",
    "execution|learning": "你在做中学，用可验证的版本快速逼近答案。",
  };

  function narrative(dims) {
    var top = window.RN.assess.ranked(dims).slice(0, 2);
    if (top.length < 2) return "";
    var a = top[0].key;
    var b = top[1].key;
    return (
      PAIR_NARRATIVE[a + "|" + b] || PAIR_NARRATIVE[b + "|" + a] || ""
    );
  }

  function shareSpec(dims, accent) {
    var top = window.RN.assess.ranked(dims).slice(0, 3);
    return {
      kicker: "STRENGTH EVIDENCE",
      title: "我的优势画像",
      sub: narrative(dims),
      accent: accent,
      entries: top.map(function (d) {
        return { glyph: "✦", name: d.label, copy: d.desc };
      }),
      bars: dims.map(function (d) {
        return { label: d.name, percent: d.percent, color: d.color };
      }),
      footnote: "这是待验证的优势假设，不是能力证明",
    };
  }

  function noteContent(dims) {
    var top = window.RN.assess.ranked(dims).slice(0, 3);
    var text =
      "从 15 个情境里反推出来的优势信号：\n" +
      top
        .map(function (d, i) {
          return i + 1 + ". " + d.label + " —— " + d.desc;
        })
        .join("\n");
    var line = narrative(dims);
    if (line) text += "\n\n" + line;
    return text + "\n\n（这是待验证的假设，不是能力证明）";
  }

  window.RN.assessView.mount(data.config, {
    narrative: narrative,
    shareSpec: shareSpec,
    noteContent: noteContent,
  });
})();
