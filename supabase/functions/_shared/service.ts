import {
  createClient,
  type SupabaseClient,
} from "npm:@supabase/supabase-js@2.110.0";
import { runtimeConfig } from "./config.ts";

// service-role 客户端：用 service_role 密钥直连，绕过 RLS。
//
// 仅用于写入没有面向用户 insert 策略的共享表（travelers / traveler_details，
// 见 0002_rls.sql 只有 select 策略）。requireUser 返回的用户态 db（anon key + JWT）
// 无法写这些表。切勿把此客户端用于用户私有数据——它会跳过所有 RLS 隔离。

let cached: SupabaseClient | undefined;

export function serviceClient(): SupabaseClient {
  cached ??= createClient(
    runtimeConfig.supabaseUrl,
    runtimeConfig.serviceRoleKey,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
  return cached;
}
