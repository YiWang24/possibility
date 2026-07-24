// 用户态 Supabase client（携带请求 JWT，写库受 RLS 二次约束）
import { createClient, type SupabaseClient } from "npm:@supabase/supabase-js@2";

// SUPABASE_URL / SUPABASE_ANON_KEY 由 Edge 运行时自动注入
export function userClient(req: Request): SupabaseClient {
  const authHeader = req.headers.get("Authorization") ?? "";
  return createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
    {
      global: { headers: { Authorization: authHeader } },
      auth: { persistSession: false, autoRefreshToken: false },
    },
  );
}

export async function requireUser(supabase: SupabaseClient) {
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) return null;
  return data.user;
}
