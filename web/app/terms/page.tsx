import { InfoPage } from "@/components/info/InfoPage";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "服务条款",
  description: "Possibility 的公开测试服务条款。",
  alternates: { canonical: "/terms" },
};

export default function TermsPage() {
  return <InfoPage
    eyebrow="Terms"
    title="服务条款"
    intro="使用我有可能（Possibility）即表示你理解并同意以下公开测试条款。"
    updated="2026-08-19"
    sections={[
      { title: "服务性质", paragraphs: [
        "Possibility 是用于自我探索、信息整理和经验交流的工具。AI 输出、人生实验和卡牌内容不构成医疗、心理治疗、法律、财务、职业录用或其他专业意见，也不保证任何结果。遇到紧急或高风险情况，请联系当地紧急服务或合资格专业人士。",
      ]},
      { title: "账号与内容", paragraphs: [
        "你应对账号凭据负责，并对提交、发布和回复的内容承担责任。不要上传你无权分享的个人信息、机密资料或违法内容。你可以随时修改公开范围或注销账号。",
        "发布到社区的内容可能被其他用户阅读、引用或回应。请在发布前确认内容不包含你不希望公开的身份、联系方式或敏感经历。",
      ]},
      { title: "公开测试与可用性", paragraphs: [
        "当前版本是公开测试版，功能、数据处理流程和可用性可能变化。我们会尽力维护服务，但不承诺持续可用、AI 输出无误或社区经验适合你的处境。",
        "当前版本中的付费界面是演示流程，不会产生真实扣款。正式支付功能上线前会另行提供价格、退款和购买条款。",
      ]},
      { title: "联系我们", paragraphs: [
        "如需报告问题、请求删除数据或反馈内容，请访问支持页面。我们可以在违反法律、伤害他人、滥用服务或破坏安全时限制或终止访问。",
      ]},
    ]}
  />;
}
