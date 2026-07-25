import { structuredOutput } from "../_shared/llm.ts";
import { streamChatReply } from "../_shared/chat-stream.ts";
import { requireUser } from "../_shared/auth.ts";
import { runtimeConfig } from "../_shared/config.ts";
import { preflightResponse } from "../_shared/cors.ts";
import {
  applyChatSignal,
  getOrCreateConversation,
  insertMessage,
  loadHistory,
} from "../_shared/db.ts";
import { errorResponse, HttpError, readJson } from "../_shared/errors.ts";
import { chatSignalPrompt, frontDoorPrompt } from "../_shared/prompts.ts";
import { type ChatSignal, chatSignalSchema } from "../_shared/schemas.ts";
import { sseEvent, sseResponse } from "../_shared/sse.ts";
import { validateChatInput } from "../_shared/validate.ts";

function conversationText(
  messages: Array<{ role: "user" | "assistant"; content: string }>,
): string {
  return messages
    .map(({ role, content }) =>
      `${role === "user" ? "用户" : "助手"}：${content}`
    )
    .join("\n");
}

const fallbackSignal: ChatSignal = {
  crossroads: {
    ready: false,
    summary: "",
    match_query: {
      life_stage: "",
      constraints: [],
      tension: "",
      decision_stage: "",
      support_need: "",
    },
  },
  conclusion: {
    ready: false,
    next_step: "lab",
    reason: "",
  },
  profile_updates: [],
  portrait_delta: 0,
  high_risk: false,
};

// 回复流结束后再等信号抽取的宽限时长；超时即降级为 fallback，避免网关挂起拖住 done。
const SIGNAL_GRACE_MS = 20_000;

type SignalResult = { signal: ChatSignal; degraded: boolean };

function raceSignal(
  signalPromise: Promise<SignalResult>,
): Promise<SignalResult> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const grace = new Promise<SignalResult>((resolve) => {
    timer = setTimeout(
      () => resolve({ signal: fallbackSignal, degraded: true }),
      SIGNAL_GRACE_MS,
    );
  });
  return Promise.race([signalPromise, grace]).finally(() => {
    if (timer !== undefined) clearTimeout(timer);
  });
}

Deno.serve(async (req) => {
  const preflight = preflightResponse(req);
  if (preflight) return preflight;

  try {
    const input = validateChatInput(await readJson(req));
    const { user, db } = await requireUser(req);
    const conversation = await getOrCreateConversation(
      db,
      user.id,
      input.topic,
      input.conversationId,
    );
    if (conversation.status === "closed") {
      throw new HttpError(
        409,
        "CONVERSATION_CLOSED",
        "该对话已结束，请新建对话。",
      );
    }
    const history = await loadHistory(db, conversation.id);
    await insertMessage(db, conversation.id, "user", input.message);

    const messages: Array<{ role: "user" | "assistant"; content: string }> = [
      ...history,
      { role: "user", content: input.message },
    ];
    const signalPromise = structuredOutput<ChatSignal>({
      model: runtimeConfig.diaryModel,
      maxTokens: 1_024,
      system: chatSignalPrompt,
      prompt: conversationText(messages),
      schema: chatSignalSchema,
    }).then((signal) => ({ signal, degraded: false })).catch((error) => {
      console.error("chat signal extraction failed:", error);
      return { signal: fallbackSignal, degraded: true };
    });

    // 客户端断开时，用它中止仍在挂起的上游流式请求。
    const cancelController = new AbortController();
    let cancelled = false;
    const body = new ReadableStream<Uint8Array>({
      async start(controller) {
        try {
          // 用 Vercel AI SDK 流式生成回复：短超时 + 空则重试，避开偶发挂起窗口。
          const assistantText = await streamChatReply({
            model: runtimeConfig.chatModel,
            system: frontDoorPrompt(conversation.topic),
            messages,
            maxOutputTokens: 1_024,
            cancelSignal: cancelController.signal,
            onDelta: (text) => {
              if (!cancelled) controller.enqueue(sseEvent({ t: text }));
            },
          });
          if (!assistantText.trim()) {
            throw new HttpError(
              502,
              "MODEL_OUTPUT_EMPTY",
              "AI 未返回有效内容。",
            );
          }

          // 岔路口信号抽取走结构化路径，不能让它阻塞回复完成：
          // 回复流结束后再给它一小段宽限期，超时则降级为 fallback，done 照常下发。
          const signalResult = await raceSignal(signalPromise);
          let { signal } = signalResult;
          if (signal.high_risk) {
            signal = {
              ...signal,
              crossroads: {
                ...signal.crossroads,
                ready: false,
              },
              conclusion: {
                ...signal.conclusion,
                ready: false,
              },
            };
          }
          await insertMessage(
            db,
            conversation.id,
            "assistant",
            assistantText,
            { signal },
          );
          const profile = await applyChatSignal(
            db,
            user.id,
            conversation.id,
            conversation.status,
            signal,
          );
          if (!cancelled) {
            // 对齐原型探索对话契约：is_enough 表示岔路口是否已足够清晰，
            // next_actions 给出下一步入口；同时保留 crossroads/profile 原字段。
            const nextActions = signal.conclusion.ready
              ? signal.conclusion.next_step === "match"
                ? [{ type: "match", label: "看看走过类似岔路口、结局不同的人" }]
                : [{ type: "lab", label: "去人生实验室推演不同选择" }]
              : [];
            controller.enqueue(sseEvent({
              done: true,
              conversation_id: conversation.id,
              crossroads: signal.crossroads,
              is_enough: signal.crossroads.ready,
              analysis: signal.crossroads.summary,
              conclusion: signal.conclusion,
              next_actions: nextActions,
              profile,
              high_risk: signal.high_risk,
              signal_degraded: signalResult.degraded,
            }, "done"));
          }
        } catch (error) {
          console.error("chat stream failed:", error);
          if (!cancelled) {
            controller.enqueue(sseEvent({
              error: {
                code: error instanceof HttpError ? error.code : "STREAM_ERROR",
                message: "回复中断，请稍后重试。",
              },
            }, "error"));
          }
        } finally {
          if (!cancelled) controller.close();
        }
      },
      cancel() {
        cancelled = true;
        cancelController.abort();
      },
    });
    return sseResponse(body);
  } catch (error) {
    return errorResponse(error);
  }
});
