"use client";
/* 消息气泡 + 简易 markdown 渲染（保留换行 + **加粗**）—— 移植自 iOS ChatView.bubble / markdownText */

import type { ReactNode } from "react";
import { OrbView } from "@/components/ui/OrbView";
import type { ChatMessage } from "./store";

/** 渲染保留换行的 **加粗** 内联 markdown（不解析其他语法，对齐 iOS inlineOnlyPreservingWhitespace） */
export function MarkdownText({ raw }: { raw: string }) {
  const lines = raw.split("\n");
  return (
    <>
      {lines.map((line, li) => (
        <span key={li}>
          {renderBold(line)}
          {li < lines.length - 1 ? <br /> : null}
        </span>
      ))}
    </>
  );
}

function renderBold(line: string): ReactNode[] {
  const parts = line.split("**");
  return parts.map((part, i) =>
    i % 2 === 1 ? (
      <strong key={i} className="font-semibold">
        {part}
      </strong>
    ) : (
      <span key={i}>{part}</span>
    ),
  );
}

/** 单条对话气泡：尖角朝发送方（用户蓝渐变靠右，AI 卡片靠左） */
export function MessageBubble({ message }: { message: ChatMessage }) {
  const isUser = message.role === "user";
  return (
    <div className={`flex pt-3.5 ${isUser ? "justify-end pl-10" : "justify-start pr-10"}`}>
      <div
        /* 300px 是手机行宽；桌面 768px 消息列里会把每句话都压成窄条 */
        className={`max-w-[300px] px-4 py-[13px] leading-[1.55] whitespace-pre-wrap break-words md:max-w-[82%] ${
          isUser
            ? "text-white text-callout bg-[linear-gradient(135deg,#3E77F2,#2A50D6)] rounded-card rounded-br-[6px]"
            : "text-ink text-callout bg-card border border-line rounded-card rounded-bl-[6px]"
        }`}
      >
        <MarkdownText raw={message.text} />
      </div>
    </div>
  );
}

/** 思考中占位（首个 token 到达前）—— iOS thinking：MiniOrb + 「正在想…」 */
export function ThinkingBubble() {
  return (
    <div className="flex items-center gap-2.5 pt-4">
      <OrbView size={18} />
      <span className="text-footnote text-faint">正在想…</span>
    </div>
  );
}
