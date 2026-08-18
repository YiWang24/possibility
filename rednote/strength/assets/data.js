/* 优势证据探索题库 —— 移植自 web/features/studio/assessment/data.ts 的 STRENGTH 配置。
   15 个情境判断，从重复出现的行为证据反推优势信号。经典脚本，挂 window.RN.data。 */

window.RN = window.RN || {};

(function () {
  "use strict";

  var CONFIG = {
    kind: "strength",
    title: "优势证据探索",
    kicker: "STRENGTH EVIDENCE · SITUATIONAL DEMO",
    introTitle: "先看你会怎么做，\n再反推你可能擅长什么。",
    intro:
      "这里不要求你先声明“我擅长什么”。请判断下面这些真实工作与生活情境有多像你，系统会从重复出现的行为证据中提炼优势信号。",
    notices: [
      "15 题情境判断，可直接开始",
      "结果是待验证的优势假设，不是能力证明",
      "建议之后补充一段真实经历来增强可信度",
      "答案保存在当前设备，可随时退出继续",
    ],
    resultTitle: "优势画像",
    resultSub: "行为证据 · Demo 探索版",
    dims: [
      { key: "structure", name: "结构", label: "结构化思考", color: "#7F9EFF", desc: "把复杂信息拆开、整理并建立清楚路径" },
      { key: "empathy", name: "共情", label: "理解他人", color: "#E88FB9", desc: "觉察感受与立场，帮助对话继续" },
      { key: "expression", name: "表达", label: "清晰表达", color: "#C394E8", desc: "把模糊想法转化为别人能理解的语言或画面" },
      { key: "execution", name: "推进", label: "推动落地", color: "#E7B36C", desc: "协调资源、处理阻力并把事情向前推进" },
      { key: "learning", name: "学习", label: "快速学习", color: "#67CBAE", desc: "从反馈中抓住规律并迁移到新问题" },
    ],
    items: [
      { dim: "structure", text: "信息混乱时，我会自然地给它们分类并找出主线" },
      { dim: "empathy", text: "两个人争执时，我常能听出双方真正担心什么" },
      { dim: "expression", text: "别人听不懂时，我能换一种说法或画法继续解释" },
      { dim: "execution", text: "计划卡住时，我会找到下一步可执行的小动作" },
      { dim: "learning", text: "接触新工具后，我能较快摸清它的基本规律" },
      { dim: "structure", text: "面对复杂任务，我会先明确目标、限制和优先级" },
      { dim: "empathy", text: "团队气氛微妙变化时，我通常能较早觉察" },
      { dim: "expression", text: "我能把长篇内容压缩成重点，又不丢掉关键含义" },
      { dim: "execution", text: "需要多人配合时，我会主动确认责任和时间点" },
      { dim: "learning", text: "一次失败后，我通常能总结出下次可调整的办法" },
      { dim: "structure", text: "我喜欢发现看似无关信息之间的关系" },
      { dim: "empathy", text: "别人表达不完整时，我能用提问帮他把想法说清楚" },
      { dim: "expression", text: "我对措辞、叙事或视觉呈现是否准确比较敏感" },
      { dim: "execution", text: "即使条件不完美，我也能先做出可验证的版本" },
      { dim: "learning", text: "我能把一个领域学到的方法迁移到另一个问题上" },
    ],
    likert: ["非常不符合", "比较不符合", "不确定", "比较符合", "非常符合"],
  };

  window.RN.data = { config: CONFIG };
})();
