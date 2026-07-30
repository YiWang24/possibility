-- 第一阶段个人档案改造：
-- 1. 补齐公开主页当前真实使用、但此前只存在客户端本地的字段。
-- 2. AI 使用授权与公开展示开关分表存储，授权默认拒绝。
-- 3. 匿名账号转正式账号时一并迁移 AI 授权。

alter table public.public_profiles
  add column if not exists profile_version smallint not null default 1,
  add column if not exists hue smallint not null default 4,
  add column if not exists age smallint,
  add column if not exists city text not null default '',
  add column if not exists from_role text not null default '',
  add column if not exists to_role text not null default '',
  add column if not exists stage text not null default '',
  add column if not exists result text not null default '',
  add column if not exists story_intro text not null default '',
  add column if not exists story_full text not null default '';

alter table public.public_profiles
  drop constraint if exists public_profiles_profile_version_range,
  add constraint public_profiles_profile_version_range
    check (profile_version between 1 and 32767),
  drop constraint if exists public_profiles_hue_range,
  add constraint public_profiles_hue_range check (hue between 0 and 4),
  drop constraint if exists public_profiles_age_range,
  add constraint public_profiles_age_range
    check (age is null or age between 0 and 150),
  drop constraint if exists public_profiles_city_length,
  add constraint public_profiles_city_length check (char_length(city) <= 100),
  drop constraint if exists public_profiles_from_role_length,
  add constraint public_profiles_from_role_length
    check (char_length(from_role) <= 100),
  drop constraint if exists public_profiles_to_role_length,
  add constraint public_profiles_to_role_length
    check (char_length(to_role) <= 100),
  drop constraint if exists public_profiles_stage_length,
  add constraint public_profiles_stage_length check (char_length(stage) <= 100),
  drop constraint if exists public_profiles_result_length,
  add constraint public_profiles_result_length
    check (char_length(result) <= 200),
  drop constraint if exists public_profiles_story_intro_length,
  add constraint public_profiles_story_intro_length
    check (char_length(story_intro) <= 2000),
  drop constraint if exists public_profiles_story_full_length,
  add constraint public_profiles_story_full_length
    check (char_length(story_full) <= 12000);

-- 该表仅本人可读写，不进入公开主页的匿名 SELECT。
-- permissions 形状：
-- {"skill":{"persona":true},"like":{"persona":false}, ...}
create table if not exists public.profile_ai_permissions (
  user_id      uuid primary key references auth.users(id) on delete cascade,
  permissions  jsonb not null default '{}',
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  constraint profile_ai_permissions_object
    check (jsonb_typeof(permissions) = 'object')
);

alter table public.profile_ai_permissions enable row level security;

drop policy if exists "Users manage own AI permissions"
  on public.profile_ai_permissions;
create policy "Users manage own AI permissions"
  on public.profile_ai_permissions
  for all
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

drop trigger if exists trg_profile_ai_permissions_touch
  on public.profile_ai_permissions;
create trigger trg_profile_ai_permissions_touch
  before update on public.profile_ai_permissions
  for each row execute function public.touch_updated_at();

grant select, insert, update, delete
  on table public.profile_ai_permissions
  to authenticated;
grant all privileges
  on table public.profile_ai_permissions
  to service_role;
