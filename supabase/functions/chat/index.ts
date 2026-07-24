// EF-CHAT —— 前门对话：流式回复 + 落库 + 岔路口/画像信号（技术设计文档 §6.1）
import { preflight, corsHeaders } from "../_shared/cors.ts";
import { fail } from "../_shared/errors.ts";
import { userClient, requireUser } from "../_shared/auth.ts";
import { str, oneOf, TOPICS, LIMITS } from "../_shared/validate.ts";
import { anthropic, MODELS } from "../_shared/anthropic.ts";
import { SYSTEM_FRONTDOOR, SYSTEM_SIGNAL } from "../_shared/prompts.ts";
import { CROSSROADS_SCHEMA } from "../_shared/schemas.ts";
import { structured } from "../_shared/llm.ts";

type Msg = { role: "user" | "assistant"; content: string };

Deno.serve(async (req) => {
  const pf = preflight(req);
  if (pf) return pf;
  if (req.method !== "POST") return fail("method not allowed", 405);

  const supabase = userClient(req);
  const user = await requireUser(supabase);
  if (!user) return fail("unauthorized", 401);

  // deno-lint-ignore no-explicit-any
  let body: any;
  try {
    body = await req.json();
  } catch {
    return fail("invalid json");
  }

  const topic = oneOf(body.topic, TOPICS, "职业");
  const message = str(body.message, LIMITS.message);
  if (!message) return fail("message required or too long");

  let conversationId: string | null =
    typeof body.conversation_id === "string" ? body.conversation_id : null;
  const history: Msg[] = Array.isArray(body.history) ? body.history.slice(-20) : [];

  // 确保 conversation 存在（RLS 保证 owner）
  if (!conversationId) {
    const { data, error } = await supabase
      .from("conversations")
      .insert({ user_id: user.id, topic })
      .select("id")
      .single();
    if (error) return fail("db: " + error.message, 500);
    conversationId = data.id;
  }
  await supabase
    .from("messages")
    .insert({ conversation_id: conversationId, role: "user", content: message });

  const messages: Msg[] = [...history, { role: "user", content: message }];
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      const send = (event: string, data: unknown) =>
        controller.enqueue(
          encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`),
        );

      send("meta", { conversation_id: conversationId });

      try {
        // 省略 thinking → Opus 4.8 低延迟聊天
        const s = anthropic.messages.stream({
          model: MODELS.chat,
          max_tokens: 2048,
          system: SYSTEM_FRONTDOOR(topic),
          messages,
        });
        s.on("text", (t: string) => send("token", { t }));
        const final = await s.finalMessage();
        let reply = "";
        for (const b of final.content) {
          if (b.type === "text") {
            reply = b.text;
            break;
          }
        }

        await supabase.from("messages").insert({
          conversation_id: conversationId,
          role: "assistant",
          content: reply,
        });

        // 岔路口/画像信号（Haiku，结构化）——回复完成后跑，尽力而为
        // deno-lint-ignore no-explicit-any
        let signals: any = null;
        try {
          signals = await structured({
            model: MODELS.signal,
            system: SYSTEM_SIGNAL,
            user: JSON.stringify({
              topic,
              dialogue: [...messages, { role: "assistant", content: reply }],
            }),
            schema: CROSSROADS_SCHEMA,
            max_tokens: 512,
          });
          if (signals?.crossroads) {
            await supabase
              .from("conversations")
              .update({
                crossroads: signals.crossroads,
                status: signals.crossroads.ready ? "crossroads" : "open",
              })
              .eq("id", conversationId);
          }
        } catch (_) {
          // 信号失败不影响主回复
        }

        send("done", { conversation_id: conversationId, signals });
        controller.close();
      } catch (e) {
        send("error", { message: String(e) });
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      ...corsHeaders,
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
});
