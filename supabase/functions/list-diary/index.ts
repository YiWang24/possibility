import { requireUser } from "../_shared/auth.ts";
import { preflightResponse } from "../_shared/cors.ts";
import { errorResponse, jsonResponse, readJson } from "../_shared/errors.ts";
import { validateListInput } from "../_shared/validate.ts";

/**
 * POST /list-diary
 * Returns paginated list of user's diary entries.
 * Body: { limit?: number, offset?: number }
 */
Deno.serve(async (req) => {
  const preflight = preflightResponse(req);
  if (preflight) return preflight;

  try {
    let input = { limit: 30, offset: 0 };
    if (req.method === "POST") {
      const body = await readJson(req);
      input = validateListInput(body);
    }
    const { user, db } = await requireUser(req);

    const { data, error, count } = await db
      .from("diary_entries")
      .select("id,transcript,emotions,keywords,created_at", { count: "exact" })
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .range(input.offset, input.offset + input.limit - 1);

    if (error) {
      console.error("list diary failed:", error.message);
      return jsonResponse({ entries: [], total: 0 });
    }

    return jsonResponse({
      entries: data ?? [],
      total: count ?? 0,
    });
  } catch (error) {
    return errorResponse(error, req);
  }
});
