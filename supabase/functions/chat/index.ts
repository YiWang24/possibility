import { anthropic, structuredOutput } from "../_shared/anthropic.ts";
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
  profile_updates: [],
  portrait_delta: 0,
  high_risk: false,
};

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
    const messageStream = anthropic().messages.stream({
      model: runtimeConfig.chatModel,
      max_tokens: 1_024,
      system: frontDoorPrompt(conversation.topic),
      messages,
    });

    let cancelled = false;
    const body = new ReadableStream<Uint8Array>({
      async start(controller) {
        let assistantText = "";
        messageStream.on("text", (text) => {
          assistantText += text;
          if (!cancelled) controller.enqueue(sseEvent({ t: text }));
        });

        try {
          await messageStream.finalMessage();
          if (!assistantText.trim()) {
            throw new HttpError(
              502,
              "MODEL_OUTPUT_EMPTY",
              "AI 未返回有效内容。",
            );
          }

          const signalResult = await signalPromise;
          let { signal } = signalResult;
          if (signal.high_risk) {
            signal = {
              ...signal,
              crossroads: {
                ...signal.crossroads,
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
            controller.enqueue(sseEvent({
              done: true,
              conversation_id: conversation.id,
              crossroads: signal.crossroads,
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
        messageStream.abort();
      },
    });
    return sseResponse(body);
  } catch (error) {
    return errorResponse(error);
  }
});
