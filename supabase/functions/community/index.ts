import { structuredOutput } from "../_shared/anthropic.ts";
import { requireUser } from "../_shared/auth.ts";
import { runtimeConfig } from "../_shared/config.ts";
import { preflightResponse } from "../_shared/cors.ts";
import {
  errorResponse,
  HttpError,
  jsonResponse,
  readJson,
} from "../_shared/errors.ts";
import {
  validateBountyInput,
  validateBountyResponseInput,
  validateKaleidoscopeInput,
  validateListInput,
} from "../_shared/validate.ts";

const kaleidoscopePrompt =
  `你是"万花筒"社区匹配器。根据用户画像和请求模式（similar/different），从候选旅人中选出最适合展示给用户的 1 位。

模式说明：
- similar：选择经历、处境或价值观与用户最相近的旅人
- different：选择人生轨迹或选择方向与用户最不同的旅人

只输出一个 JSON 对象：{"traveler_id": <number>, "reason": "<一句话说明为什么匹配>"}`;

type KaleidoResult = { traveler_id: number; reason: string };

const kaleidoSchema = {
  type: "object",
  properties: {
    traveler_id: { type: "integer" },
    reason: { type: "string", minLength: 1 },
  },
  required: ["traveler_id", "reason"],
  additionalProperties: false,
} as const;

Deno.serve(async (req) => {
  const preflight = preflightResponse(req);
  if (preflight) return preflight;

  try {
    const body = await readJson(req);
    if (typeof body !== "object" || body === null || Array.isArray(body)) {
      throw new HttpError(400, "INVALID_INPUT", "请求体必须是对象。");
    }
    const action = (body as Record<string, unknown>).action;
    const { user, db } = await requireUser(req);

    switch (action) {
      // ==================== Kaleidoscope Draw ====================
      case "kaleidoscope_draw": {
        const input = validateKaleidoscopeInput(body);

        // Get user profile for matching context
        const { data: profile } = await db
          .from("profiles")
          .select("dims")
          .eq("id", user.id)
          .maybeSingle();

        // Get recent draws to avoid repeats
        const { data: recentDraws } = await db
          .from("kaleidoscope_draws")
          .select("traveler_id")
          .eq("user_id", user.id)
          .order("created_at", { ascending: false })
          .limit(5);
        const recentIds = (recentDraws ?? [])
          .map((d) => d.traveler_id)
          .filter(Boolean);

        // Get candidate travelers
        const { data: travelers, error: tErr } = await db
          .from("travelers")
          .select("id,name,quote,bio,tags,dims,is_similar");
        if (tErr || !travelers || travelers.length === 0) {
          throw new HttpError(503, "NO_TRAVELERS", "暂无可匹配的旅人。");
        }

        // Filter out recently drawn
        let candidates = travelers.filter(
          (t) => !recentIds.includes(t.id),
        );
        if (candidates.length === 0) candidates = travelers;

        // Try AI matching, fallback to random
        let selectedId: number;
        let reason: string;
        try {
          const result = await structuredOutput<KaleidoResult>({
            model: runtimeConfig.structuredModel,
            maxTokens: 256,
            system: kaleidoscopePrompt,
            prompt: `用户画像：${
              JSON.stringify(profile?.dims ?? {})
            }\n模式：${input.mode}\n候选旅人：${
              JSON.stringify(
                candidates.map((t) => ({
                  id: t.id,
                  name: t.name,
                  quote: t.quote,
                  tags: t.tags,
                })),
              )
            }`,
            schema: kaleidoSchema,
          });
          const valid = candidates.find((t) => t.id === result.traveler_id);
          if (valid) {
            selectedId = result.traveler_id;
            reason = result.reason;
          } else {
            throw new Error("Invalid traveler_id from AI");
          }
        } catch {
          // Fallback: random selection with mode preference
          const pool = input.mode === "similar"
            ? candidates.filter((t) => t.is_similar) || candidates
            : candidates.filter((t) => !t.is_similar) || candidates;
          const selected = (pool.length > 0 ? pool : candidates)[
            Math.floor(
              Math.random() * (pool.length > 0 ? pool : candidates).length,
            )
          ];
          selectedId = selected.id;
          reason = input.mode === "similar"
            ? "经历与你有相似之处"
            : "走了一条与你不同的路";
        }

        // Record the draw
        await db.from("kaleidoscope_draws").insert({
          user_id: user.id,
          mode: input.mode,
          traveler_id: selectedId,
        });

        // Return traveler details
        const traveler = travelers.find((t) => t.id === selectedId)!;
        return jsonResponse({
          traveler: {
            id: traveler.id,
            name: traveler.name,
            quote: traveler.quote,
            bio: traveler.bio,
            tags: traveler.tags,
            dims: traveler.dims,
          },
          reason,
          mode: input.mode,
        });
      }

      // ==================== List Bounties ====================
      case "list_bounties": {
        const input = validateListInput(body);
        const { data, error, count } = await db
          .from("bounties")
          .select(
            "id,question,reward,responses,tags,detail,status,created_at",
            {
              count: "exact",
            },
          )
          .order("created_at", { ascending: false })
          .range(input.offset, input.offset + input.limit - 1);
        if (error) {
          console.error("list bounties failed:", error.message);
        }
        return jsonResponse({
          bounties: data ?? [],
          total: count ?? 0,
        });
      }

      // ==================== Create Bounty ====================
      case "create_bounty": {
        const input = validateBountyInput(body);
        const { data, error } = await db.from("bounties").insert({
          user_id: user.id,
          question: input.question,
          tags: input.tags,
          detail: input.detail,
          reward: input.reward,
          responses: "0 人回应",
        }).select("id").single();
        if (error) {
          console.error("create bounty failed:", error.message);
          throw new HttpError(500, "DATABASE_ERROR", "发布悬赏失败。");
        }
        return jsonResponse({ ok: true, id: data.id });
      }

      // ==================== Respond to Bounty ====================
      case "respond_bounty": {
        const input = validateBountyResponseInput(body);
        const { error } = await db.from("bounty_responses").upsert({
          bounty_id: input.bounty_id,
          user_id: user.id,
          message: input.message,
        }, { onConflict: "bounty_id,user_id" });
        if (error) {
          console.error("respond bounty failed:", error.message);
          throw new HttpError(500, "DATABASE_ERROR", "发送名片失败。");
        }
        return jsonResponse({ ok: true });
      }

      // ==================== List Travelers (for community feed) ====================
      case "list_travelers": {
        const input = validateListInput(body);
        const { data, error } = await db
          .from("travelers")
          .select("id,name,initial,hue,is_similar,quote,bio,tags,dims")
          .order("id")
          .range(input.offset, input.offset + input.limit - 1);
        if (error) {
          console.error("list travelers failed:", error.message);
        }
        return jsonResponse({ travelers: data ?? [] });
      }

      default:
        throw new HttpError(
          400,
          "INVALID_ACTION",
          "action 必须是 kaleidoscope_draw/list_bounties/create_bounty/respond_bounty/list_travelers 之一。",
        );
    }
  } catch (error) {
    return errorResponse(error);
  }
});
