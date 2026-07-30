/* Supabase 配置 —— 与 iOS AppConfig 同策略：env 优先，缺省回落线上项目（anon key 受 RLS 约束、可公开） */
export const SUPABASE_URL =
  process.env.NEXT_PUBLIC_SUPABASE_URL || "https://gxmruqzcyahjlktshpkh.supabase.co";

export const SUPABASE_ANON_KEY =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd4bXJ1cXpjeWFoamxrdHNocGtoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODQ4NjM3NjMsImV4cCI6MjEwMDQzOTc2M30.ANJKh_D-kh_4yTeE_AfvIExUaLo3S5I0jOvHSOTOQg4";

export function functionURL(name: string): string {
  return `${SUPABASE_URL}/functions/v1/${name}`;
}
