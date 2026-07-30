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

/* 冷启动匿名登录（对齐 iOS bootstrap()）：已有会话则复用 */
let bootstrapPromise: Promise<void> | null = null;

export function bootstrap(): Promise<void> {
  if (!bootstrapPromise) {
    bootstrapPromise = (async () => {
      const sb = supabase();
      const { data } = await sb.auth.getSession();
      if (!data.session) {
        const { error } = await sb.auth.signInAnonymously();
        if (error) throw error;
      }
    })().catch((err) => {
      bootstrapPromise = null;
      throw err;
    });
  }
  return bootstrapPromise;
}

export async function jwt(): Promise<string> {
  await bootstrap();
  const { data } = await supabase().auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new Error("未登录");
  return token;
}

/* Edge Function 调用（自动确保匿名会话） */
export async function callFunction<T>(
  name: EdgeFunctionName,
  body?: Record<string, unknown>,
): Promise<T> {
  await bootstrap();
  return invokeFunction<T>(supabase(), name, body);
}
