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
import type { RemoteConversation } from "@/lib/models";
import { ChatModel, type ChatEntryPoint } from "./store";
import { MessageBubble, ThinkingBubble } from "./MessageBubble";
import { ActionChips } from "./ActionChips";
import { ChatNextPanel } from "./NextPanel";
import { InputBar } from "./InputBar";
import { ChatSummaryView } from "./SummaryPanel";
import { ChatHistorySheet } from "./HistorySheet";
import { BackButton, HistoryButton } from "./ChatChrome";

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
    <div className="flex min-h-dvh flex-col screen-bg md:min-h-[calc(100dvh-74px)]">
      {/* 顶栏 —— 内容与消息列、输入栏同一根中轴线，否则桌面上三者各对各的边。
          桌面上让开全站 navbar 的 74px，否则粘在视口顶端会被 navbar 盖住。 */}
      <div className="sticky top-0 z-30 border-b border-line bg-paper/80 px-[22px] py-3 backdrop-blur md:top-[74px]">
        <div className="mx-auto flex w-full max-w-measure items-center gap-3">
          <BackButton onClick={() => router.back()} />
          <div className="flex flex-col gap-0.5">
            <span className="text-subtitle font-semibold tracking-[0.8px] text-ink">
              {model.displayTopic ? `探索 · ${model.displayTopic}` : "探索问题"}
            </span>
            <span className="text-caption text-faint">和你的动态画像一起想清楚</span>
          </div>
          <div className="flex-1" />
          {model.historyEntries.length > 0 ? (
            <HistoryButton onClick={() => model.setShowHistory(true)} />
          ) : null}
        </div>
      </div>

      {/* 消息流 */}
      <div className="flex-1 overflow-y-auto no-scrollbar">
        <div className="mx-auto w-full max-w-measure px-5 py-3">
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
      </div>

      {/* 输入栏 */}
      <InputBar
        value={model.input}
        disabled={model.isStreaming}
        onChange={(t) => model.setInput(t)}
        onSend={() => model.send(model.input)}
      />

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
