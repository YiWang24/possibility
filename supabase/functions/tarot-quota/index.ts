import { requireUser } from "../_shared/auth.ts";
import { preflightResponse } from "../_shared/cors.ts";
import {
  errorResponse,
  HttpError,
  jsonResponse,
  readJson,
} from "../_shared/errors.ts";

type ShareChannel = "wechat" | "moments" | "xiaohongshu" | "weibo" | "other";
type StoredShareChannel = ShareChannel | "friend";
type QuotaRow = {
  allowed?: boolean;
  claimed?: boolean;
  usage_date: string;
  used_count: number;
  shared_channels: StoredShareChannel[] | null;
  share_reward_count: number;
  remaining: number;
};

function bodyObject(value: unknown): Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new HttpError(400, "INVALID_INPUT", "请求体必须是对象。");
  }
  return value as Record<string, unknown>;
}

function responseOf(row: QuotaRow) {
  return {
    date: row.usage_date,
    used: Number(row.used_count ?? 0),
    shared_channels: (row.shared_channels ?? []).map((channel) =>
      channel === "friend" ? "wechat" : channel
    ),
    share_reward_count: Number(row.share_reward_count ?? 0),
    remaining: Number(row.remaining ?? 0),
  };
}

function databaseFailure(error: { code?: string } | null): never {
  console.error("tarot quota database error:", error?.code ?? "unknown");
  throw new HttpError(500, "DATABASE_ERROR", "读取塔罗次数失败，请稍后重试。");
}

Deno.serve(async (req) => {
  const preflight = preflightResponse(req);
  if (preflight) return preflight;

  try {
    const body = bodyObject(await readJson(req));
    const action = typeof body.action === "string" ? body.action : "status";
    const { db } = await requireUser(req);

    if (action === "status") {
      const { data, error } = await db.rpc("get_tarot_quota");
      if (error) databaseFailure(error);
      return jsonResponse(responseOf((data?.[0] ?? {}) as QuotaRow));
    }

    if (action === "consume") {
      const { data, error } = await db.rpc("consume_tarot_attempt");
      if (error) databaseFailure(error);
      const row = (data?.[0] ?? {}) as QuotaRow;
      return jsonResponse({
        ...responseOf(row),
        allowed: row.allowed === true,
      });
    }

    if (action === "reward") {
      const channel = body.channel;
      if (
        channel !== "friend" && channel !== "wechat" && channel !== "moments" &&
        channel !== "xiaohongshu" && channel !== "weibo" && channel !== "other"
      ) {
        throw new HttpError(400, "INVALID_CHANNEL", "分享渠道无效。");
      }
      const { data, error } = await db.rpc("claim_tarot_share_reward", {
        p_channel: channel === "friend" ? "wechat" : channel,
      });
      if (error) databaseFailure(error);
      const row = (data?.[0] ?? {}) as QuotaRow;
      return jsonResponse({
        ...responseOf(row),
        claimed: row.claimed === true,
      });
    }

    throw new HttpError(
      400,
      "INVALID_ACTION",
      "action 必须是 status/consume/reward 之一。",
    );
  } catch (error) {
    return errorResponse(error, req);
  }
});
