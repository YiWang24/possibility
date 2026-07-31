-- 内容表收口：登录后才可读（配合冷启动登录墙，见 config.toml enable_anonymous_sign_ins = false）
--
-- 背景：0002 建的四条读策略写的是 `using (true)` 且没带 `to`，PostgreSQL 的默认是
-- PUBLIC —— 也就是把 anon 角色一起放进来了；0004 又显式 `grant select ... to anon`。
-- 匿名登录停用后「没有匿名用户」，但 anon 角色本身没消失：它对应的是「只带
-- publishable anon key、不带任何用户 JWT」的请求，而那把 key 就明文躺在客户端包里。
-- 于是任何人都能绕开登录墙直接 REST 拉这四张表，其中 traveler_details.full_text
-- 是标着「付费解锁」的正文 —— 不登录、不付费即可全文取走。
--
-- 这里把四张表一律收成 authenticated 专属：登录墙之后，合法调用方必然带用户 JWT。
--
-- 遗留（本迁移刻意不动，需产品决策）：
--   1. public_profiles 在 20260730160924 里被显式设为 `to anon, authenticated`，
--      那是「已发布画像公开可读」的有意设计，不在此处反转。
--   2. full_text / advice 对任何**已登录**用户仍然可读，与 unlocks 表无关 ——
--      付费墙目前纯前端。要真正闭环得拆列/改由 Edge Function 校验 unlocks 后下发。

-- ---------- 策略：PUBLIC → authenticated ----------
drop policy if exists read_travelers         on public.travelers;
drop policy if exists read_traveler_details  on public.traveler_details;
drop policy if exists read_traveler_services on public.traveler_services;
drop policy if exists read_bounties          on public.bounties;

create policy read_travelers on public.travelers
  for select to authenticated using (true);

create policy read_traveler_details on public.traveler_details
  for select to authenticated using (true);

create policy read_traveler_services on public.traveler_services
  for select to authenticated using (true);

create policy read_bounties on public.bounties
  for select to authenticated using (true);

-- ---------- 表授权：撤掉 anon ----------
-- 策略与授权是两道独立的闸；只改策略的话 anon 仍持有 SELECT 权限，
-- 一旦将来有人再加一条宽松策略就又漏了。两道一起关。
revoke select on table
  public.travelers,
  public.traveler_details,
  public.traveler_services,
  public.bounties
from anon;
