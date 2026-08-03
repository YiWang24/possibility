"use client";
/* 探索对话主视图 —— 移植自 iOS ChatView.swift（付费漏斗主线）
 *
 * 路由契约：
 *  - /chat?topic=话题&q=首条问题  新对话
 *  - /chat?id=UUID               恢复历史会话
 * 详情流程页面，自带上下文顶栏；桌面端由全站 AppShell 保留主导航。 */

import { useEffect, useMemo, useRef, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "@/components/ui/Toast";
import { PageShell } from "@/components/shell/PageShell";
import { PageHeading } from "@/components/shell/PageHeading";
import { MobileDetailHeader } from "@/components/shell/MobileDetailHeader";
import { PersonaRail } from "@/features/home/PersonaRail";
import type { RemoteConversation } from "@/lib/models";
import { ChatModel, type ChatEntryPoint } from "./store";
import { MessageBubble, ThinkingBubble } from "./MessageBubble";
import { ActionChips } from "./ActionChips";
import { ChatNextPanel } from "./NextPanel";
import { InputBar } from "./InputBar";
import { ChatSummaryView } from "./SummaryPanel";
import { ChatHistorySheet } from "./HistorySheet";
import { HistoryButton } from "./ChatChrome";

/** 订阅 ChatModel（Observable 语义 → useSyncExternalStore） */
function useChatModel(model: ChatModel): number {
  return useSyncExternalStore(model.subscribe, model.getSnapshot, model.getSnapshot);
}

export function ChatView({
  topic,
  question,
  id,
  entryPoint = "home",
}: {
  topic?: string;
  question?: string;
  id?: string;
  entryPoint?: ChatEntryPoint;
}) {
  const router = useRouter();
  const model = useMemo(
    () => new ChatModel({ topic, question: question ?? "" }, entryPoint),
    // 仅在挂载时构建一次；同一路由参数决定一次会话
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );
  const version = useChatModel(model);

  // 启动：新对话 → start；带 id → 恢复历史会话
  useEffect(() => {
    let alive = true;
    void (async () => {
      if (id) {
        await model.loadHistory();
        if (!alive) return;
        const convo: RemoteConversation =
          model.history.find((c) => c.id === id) ??
          { id, topic: topic ?? "综合", status: "open", crossroads: null, created_at: null };
        await model.restore(convo);
      } else {
        void model.start();
        void model.loadHistory();
      }
    })();
    return () => {
      alive = false;
      model.dispose();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 流式输出时自动滚底
  const bottomRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [version, model.messages.length, model.showActionChips, model.showNextPanel]);

  // MARK: 下一步路径
  const goLab = () => {
    router.push(`/lab?question=${encodeURIComponent(model.displayQuestion)}`);
    model.setShowSummary(false);
    useToast.getState().show("问题已带入人生实验室");
  };
  const goSimilar = () => {
    router.push("/community");
    model.setShowSummary(false);
    useToast.getState().show("正在寻找走过这段路的人");
  };
  const finish = () => {
    model.setShowSummary(false);
    useToast.getState().show("本次探索已保存");
    router.back();
  };

  const lastMessage = model.messages[model.messages.length - 1];
  const showThinking = model.isStreaming && lastMessage?.text === "";

  return (
    <div className="screen-bg">
      <MobileDetailHeader
        title={model.displayTopic ? `探索 · ${model.displayTopic}` : "探索问题"}
        description="和你的动态画像一起想清楚"
        onBack={() => router.back()}
        trailing={
          model.historyEntries.length > 0 ? (
            <HistoryButton onClick={() => model.setShowHistory(true)} />
          ) : null
        }
      />
      {/* 桌面把画像钉在右轨：这段对话正是在改写它，让用户边说边看见。
          iOS 一次只能一屏，画像与对话必须分开；桌面没有这个约束。 */}
      <PageShell
        compactMobile
        headerOnMobile={false}
        railOnMobile={false}
        rail={
          <PersonaRail
            caption="这次探索会喂给你的动态画像。说得越具体，它长得越像你。"
            footer={
              model.crossroads?.summary ? (
                <div className="kaleido-card p-4">
                  <div className="text-eyebrow text-faint">已澄清的岔路口</div>
                  <p className="mt-2 text-footnote leading-[1.75] text-sub">
                    {model.crossroads.summary}
                  </p>
                </div>
              ) : null
            }
          />
        }
        header={
          <PageHeading
            title={model.displayTopic ? `探索 · ${model.displayTopic}` : "探索问题"}
            description="和你的动态画像一起想清楚"
            trailing={
              model.historyEntries.length > 0 ? (
                <HistoryButton onClick={() => model.setShowHistory(true)} />
              ) : null
            }
          />
        }
      >
        {/* 消息流走文档流，滚动条是页面的那一条。
            原实现是 h-dvh + flex-1 overflow-y-auto —— iOS「固定头 / 滚动体 / 固定尾」
            的直译，在 web 上表现为页面里套一个页面。
            min-h 让短对话时输入栏仍落在视口底部，长对话时它 sticky 跟随。
            16rem ≈ 顶栏 74 + 外壳上边距 56 + 页头 70 + 分栏间距 40，
            让主栏底沿正好压在首屏折线上，sticky 才有东西可粘。 */}
        <div className="flex min-h-[calc(100dvh-16rem)] flex-col">
          <div className="flex-1">
            {model.messages.map((msg) => (msg.text ? <MessageBubble key={msg.id} message={msg} /> : null))}

            {showThinking ? <ThinkingBubble /> : null}

            {model.canRetry ? (
              <div className="pt-2.5">
                <button
                  onClick={() => model.retry()}
                  className="inline-flex items-center gap-1.5 text-footnote font-semibold text-brand-lite px-[15px] py-[9px] rounded-chip bg-brand/10 border border-brand-bright/30 transition active:scale-[0.96]"
                >
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" aria-hidden>
                    <path d="M20 11a8 8 0 1 0-1.5 5M20 5v6h-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                  重新发送
                </button>
              </div>
            ) : null}

            {model.showActionChips ? (
              <ActionChips
                confirmLabel={model.confirmLabel}
                correctLabel={model.correctLabel}
                onConfirm={() => model.confirmInsight()}
                onCorrect={() => model.requestCorrection()}
              />
            ) : null}

            {model.showNextPanel ? (
              <div className="pt-3.5">
                <ChatNextPanel
                  showSummaryLink
                  preferredPath={model.recommendedNextStep}
                  matchedTravelers={model.matchedTravelers}
                  matchReasons={model.matchReasons}
                  onGoLab={goLab}
                  onGoSimilar={goSimilar}
                  shareText={model.shareText}
                  onOpenSummary={() => model.setShowSummary(true)}
                />
              </div>
            ) : null}

            <div ref={bottomRef} className="h-2" />
          </div>

          {/* 输入栏贴主栏底沿而不是视口底沿 —— 桌面上右轨不该被一条通栏输入条压住 */}
          <InputBar
            value={model.input}
            disabled={model.isStreaming}
            onChange={(t) => model.setInput(t)}
            onSend={() => model.send(model.input)}
          />
        </div>
      </PageShell>

      {model.showHistory ? <ChatHistorySheet model={model} onClose={() => model.setShowHistory(false)} /> : null}
      {model.showSummary ? (
        <ChatSummaryView
          model={model}
          onGoLab={goLab}
          onGoSimilar={goSimilar}
          onFinish={finish}
          onClose={() => model.setShowSummary(false)}
        />
      ) : null}
    </div>
  );
}
