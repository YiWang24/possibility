import type { SupabaseClient } from "npm:@supabase/supabase-js@2.110.0";
import { structuredOutput } from "../_shared/llm.ts";
import { streamChatReply } from "../_shared/chat-stream.ts";
import { requireUser } from "../_shared/auth.ts";
import { runtimeConfig } from "../_shared/config.ts";
import { preflightResponse } from "../_shared/cors.ts";
import {
  applyChatSignal,
  type ConversationRow,
  getOrCreateConversation,
  insertMessage,
  loadHistory,
} from "../_shared/db.ts";
import { errorResponse, HttpError, readJson } from "../_shared/errors.ts";
import { ServerEvent } from "../_shared/events.ts";
import { chatSignalPrompt, frontDoorPrompt } from "../_shared/prompts.ts";
import { type ChatSignal, chatSignalSchema } from "../_shared/schemas.ts";
import { captureException } from "../_shared/sentry.ts";
import { sseEvent, sseResponse } from "../_shared/sse.ts";
import { runInBackground } from "../_shared/background.ts";
import { trackEvent } from "../_shared/track.ts";
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

/**
 * 岔路口形成（docs/埋点方案.md §3.1）——整个产品最关键的中间态指标。
 *
 * 判定条件：`signal.crossroads.ready === true` 且本轮之前会话状态还是 'open'，
 * 即 conversations 从 open 跃迁到 crossroads 的那一次。
 *
 * 为什么选它：
 * 1. `crossroads.ready` 是 chatSignalSchema 里唯一为「问题结构是否已澄清」而设的字段，
 *    prompts.ts 对它有明确定义（主要问题结构、用户真正要澄清的内容、至少一个现实约束
 *    都清晰才为 true），且 db.ts:applyChatSignal 已经用它把 conversations.status 推进到
 *    'crossroads'——也就是说，产品里「岔路口成立」这件事本来就以它为准。用别的字段
 *    （如 conclusion.ready）会跑偏：那个字段判的是「该收尾了」，比岔路口成立更晚更严格。
 * 2. 加「本轮之前状态是 open」这个前置，是因为 applyChatSignal 每轮都会重写 status，
 *    ready 一旦为 true 后续每轮都是 true。不去重的话一条会话会反复上报，
 *    「岔路口形成率」（crossroad_formed 用户数 / chat_started 用户数）分子会虚高。
 * 3. high_risk 会在调用点先把 ready 强制压回 false（危机对话不推进漏斗），本函数收到的
 *    已是覆盖后的 signal，所以危机场景天然不会上报——这也是想要的口径。
 */
function trackCrossroadFormed(
  db: SupabaseClient,
  userId: string,
  conversation: ConversationRow,
): void {
  runInBackground((async () => {
    // turn_count 走精确 count 而不是内存里的 history：loadHistory 有 20 条上限，
    // 直接数会在第 11 轮封顶，「对话深度中位数」失真。这一句跑在响应之后，不占关键路径。
    const { count } = await db.from("messages")
      .select("id", { count: "exact", head: true })
      .eq("conversation_id", conversation.id)
      .eq("role", "user");
    trackEvent(userId, ServerEvent.CROSSROAD_FORMED, {
      turn_count: count ?? 0,
      time_to_form_ms: Date.now() - Date.parse(conversation.created_at),
    });
  })());
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

  // chat_turn_completed.latency_ms 取用户视角：从收到请求到流式回复吐完。
  const requestStartedAt = Date.now();
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
    // turn_index：本轮是第几轮（0 基）。history 受 LIMITS.historyMessages=20 约束，
    // 因此该值在第 10 轮封顶——「到岔路口需要几轮」请用 crossroad_formed.turn_count
    // （精确 count），这里只用于看单轮延迟/长度随轮次的变化趋势。
    const turnIndex = history.filter(({ role }) => role === "user").length;
    const signalPromise = structuredOutput<ChatSignal>({
      model: runtimeConfig.diaryModel,
      maxTokens: 1_024,
      system: chatSignalPrompt,
      prompt: conversationText(messages),
      schema: chatSignalSchema,
      track: { userId: user.id, feature: "chat_signal" },
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
            track: { userId: user.id, feature: "chat" },
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
          trackEvent(user.id, ServerEvent.CHAT_TURN_COMPLETED, {
            turn_index: turnIndex,
            latency_ms: Date.now() - requestStartedAt,
            response_chars: assistantText.length,
          });

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
          // 只在 open → crossroads 这一次跃迁上报（判定条件与理由见 trackCrossroadFormed）。
          // 用 status === "open" 而不是 !== "crossroads"：会话后续会进入 paid，
          // 那时岔路口早已成立，不能再算一次形成。
          // 客户端是否已断开不影响判定——岔路口已经写进库了，事实就发生了。
          if (signal.crossroads.ready && conversation.status === "open") {
            trackCrossroadFormed(db, user.id, conversation);
          }
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
          // 流已经开始，异常不会走到 errorResponse（响应头早发出去了），
          // 这里是 chat 唯一能把「回复中断」送进 Sentry 的地方。
          if (!(error instanceof HttpError)) {
            captureException(error, {
              transaction: "chat-stream",
              userId: user.id,
            });
          }
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
    return errorResponse(error, req);
  }
});
