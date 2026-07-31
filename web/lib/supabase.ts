"use client";
import {
  createPossibilityClient,
  invokeFunction,
  type PossibilityClient,
} from "@possibility/api-client";
import type { EdgeFunctionName } from "@possibility/shared-types";
import { SUPABASE_URL, SUPABASE_ANON_KEY } from "./config";

let client: PossibilityClient | null = null;

export function supabase(): PossibilityClient {
  if (!client) {
    client = createPossibilityClient({
      supabaseUrl: SUPABASE_URL,
      supabaseAnonKey: SUPABASE_ANON_KEY,
    });
  }
  return client;
}

/**
 * 当前 JWT。匿名登录已停用，没有会话就是真的没登录 —— 直接抛，
 * 让调用方（AuthWall / AuthGate）把用户带回登录页，而不是静默发无效请求。
 */
export async function jwt(): Promise<string> {
  const { data } = await supabase().auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new Error("未登录");
  return token;
}

/** Edge Function 调用（invokeFunction 自带会话 JWT；无会话时由后端 401） */
export async function callFunction<T>(
  name: EdgeFunctionName,
  body?: Record<string, unknown>,
): Promise<T> {
  return invokeFunction<T>(supabase(), name, body);
}
