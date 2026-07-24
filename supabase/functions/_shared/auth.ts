import {
  createClient,
  type SupabaseClient,
  type User,
} from "npm:@supabase/supabase-js@2.110.0";
import { runtimeConfig } from "./config.ts";
import { HttpError } from "./errors.ts";

function bearerToken(req: Request): string {
  const header = req.headers.get("authorization") ?? "";
  const match = /^Bearer\s+(.+)$/i.exec(header);
  if (!match?.[1]) {
    throw new HttpError(401, "UNAUTHORIZED", "缺少有效登录凭证。");
  }
  return match[1];
}

export type AuthContext = {
  user: User;
  db: SupabaseClient;
};

export async function requireUser(req: Request): Promise<AuthContext> {
  const token = bearerToken(req);
  const db = createClient(
    runtimeConfig.supabaseUrl,
    runtimeConfig.supabaseAnonKey,
    {
      global: { headers: { Authorization: `Bearer ${token}` } },
      auth: { persistSession: false, autoRefreshToken: false },
    },
  );
  const { data, error } = await db.auth.getUser(token);
  if (error || !data.user) {
    throw new HttpError(401, "UNAUTHORIZED", "登录凭证无效或已过期。");
  }
  return { user: data.user, db };
}
