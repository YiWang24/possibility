// Anthropic client 单例 + 模型路由（技术设计文档 §7.1）。切模型只改这里。
import Anthropic from "npm:@anthropic-ai/sdk";

export const anthropic = new Anthropic({
  apiKey: Deno.env.get("ANTHROPIC_API_KEY") ?? "",
});

export const MODELS = {
  chat: "claude-opus-4-8",     // 前门对话（质量默认；延迟敏感可切 claude-sonnet-5）
  match: "claude-opus-4-8",    // 经验匹配（可解释性关键）
  simulate: "claude-opus-4-8", // 未来推演
  diary: "claude-haiku-4-5",   // 日记分析（便宜、高频）
  signal: "claude-haiku-4-5",  // 岔路口/画像信号抽取
} as const;
