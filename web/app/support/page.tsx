import { InfoPage } from "@/components/info/InfoPage";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "支持与反馈",
  description: "Possibility 使用帮助、隐私请求和问题反馈。",
  alternates: { canonical: "/support" },
};

export default function SupportPage() {
  return <InfoPage
    eyebrow="Support"
    title="支持与反馈"
    intro="遇到登录、语音日记、AI 对话或隐私问题，可以先查看下面的说明；仍未解决时，请联系维护者。"
    updated="2026-08-19"
    sections={[
      { title: "常见问题", paragraphs: [
        "登录：使用注册时的邮箱和密码登录。Apple 登录用户可以继续使用同一个 Apple ID。若收不到验证邮件，请在“我的主页”中重发。",
        "语音日记：首次录音需要允许麦克风和语音识别。录音结束后，转写与摘要可能需要一些时间；网络或语音服务暂时不可用时，可以稍后重试。",
        "AI 内容：回答是辅助思考的草稿，不是确定结论。请把重要决定交叉核对事实，并为自己保留最终判断权。",
      ]},
      { title: "数据与账号请求", paragraphs: [
        "账号注销入口在“我的主页 → 注销账号”。这会永久删除账号关联的数据和语音日记，无法恢复。需要查询、修改或删除其他数据时，请在邮件中说明登录邮箱和请求类型，不要附上密码。",
      ]},
      { title: "联系维护者", paragraphs: [
        "请发送邮件至 support@maybeio.com，主题建议包含“Possibility 支持”。为了定位问题，可以提供设备型号、iOS 版本、App 版本和复现步骤；不要发送密码、验证码或完整日记正文。",
      ]},
    ]}
  />;
}
