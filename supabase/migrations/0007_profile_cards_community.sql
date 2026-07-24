-- 0007_profile_cards_community.sql — 完善画像维度、卡牌游戏、对话列表、社区功能

-- ==================== 画像维度详情 ====================
-- 存储每个维度的标签选择（如"我擅长"、"我喜欢"等）
create table if not exists profile_dimensions (
  id         bigserial primary key,
  user_id    uuid not null references auth.users(id) on delete cascade,
  dimension  text not null,          -- skill/like/love/family/social/personality
  tags       text[] not null default '{}',
  source     text not null default 'manual', -- manual/assessment/card_game
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, dimension)
);
create index if not exists idx_profile_dimensions_user on profile_dimensions(user_id);

-- ==================== 卡牌游戏结果 ====================
-- 存储人生卡牌、婚姻卡牌、家庭卡牌、人际卡牌的游戏结果
create table if not exists card_game_results (
  id           bigserial primary key,
  user_id      uuid not null references auth.users(id) on delete cascade,
  kind         text not null check (kind in ('life','marriage','family','social')),
  final_cards  jsonb not null,        -- [{id, name, glyph, group}]
  rounds       int not null default 0,
  accepted     jsonb not null default '[]',   -- [{round, scenario, severity}]
  traded       jsonb not null default '[]',   -- [{round, scenario, ids, reasons}]
  created_at   timestamptz not null default now(),
  unique (user_id, kind)
);
create index if not exists idx_card_game_user on card_game_results(user_id);

-- ==================== 推演表增强 ====================
-- 支持底线卡（carry_cards）
alter table simulations add column if not exists carry_cards text[] not null default '{}';

-- ==================== 悬赏帖增强 ====================
-- 给 bounties 表添加必要的详情字段
alter table bounties add column if not exists user_id uuid references auth.users(id) on delete set null;
alter table bounties add column if not exists tags text[] not null default '{}';
alter table bounties add column if not exists detail text not null default '';
alter table bounties add column if not exists status text not null default 'open';

-- 悬赏回应
create table if not exists bounty_responses (
  id         bigserial primary key,
  bounty_id  bigint not null references bounties(id) on delete cascade,
  user_id    uuid not null references auth.users(id) on delete cascade,
  message    text not null default '',
  created_at timestamptz not null default now(),
  unique (bounty_id, user_id)
);

-- ==================== 用户公开资料 ====================
-- 存储用户可编辑的公开主页信息
create table if not exists public_profiles (
  id            uuid primary key references auth.users(id) on delete cascade,
  name          text not null default '',
  avatar_url    text,
  quote         text not null default '',
  bio           text not null default '',
  tags          text[] not null default '{}',
  trajectory    jsonb not null default '[]',   -- [{age, title, detail}]
  services      jsonb not null default '[]',   -- [{id, type, title, price, desc, enabled}]
  advice        jsonb not null default '[]',   -- [{id, title, content, images, links}]
  visibility    jsonb not null default '{}',   -- {personality:true, skill:true, ...}
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

-- ==================== 万花筒抽取记录 ====================
create table if not exists kaleidoscope_draws (
  id           bigserial primary key,
  user_id      uuid not null references auth.users(id) on delete cascade,
  mode         text not null check (mode in ('similar','different')),
  traveler_id  bigint references travelers(id),
  created_at   timestamptz not null default now()
);
create index if not exists idx_kal_draws_user on kaleidoscope_draws(user_id, created_at desc);

-- ==================== RLS 策略 ====================

-- profile_dimensions
alter table profile_dimensions enable row level security;
drop policy if exists "Users manage own dimensions" on profile_dimensions;
create policy "Users manage own dimensions" on profile_dimensions
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- card_game_results
alter table card_game_results enable row level security;
drop policy if exists "Users manage own card results" on card_game_results;
create policy "Users manage own card results" on card_game_results
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- bounty_responses
alter table bounty_responses enable row level security;
drop policy if exists "Users manage own bounty responses" on bounty_responses;
create policy "Users manage own bounty responses" on bounty_responses
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- public_profiles
alter table public_profiles enable row level security;
drop policy if exists "Users manage own public profile" on public_profiles;
create policy "Users manage own public profile" on public_profiles
  for all using (auth.uid() = id) with check (auth.uid() = id);
drop policy if exists "Public profiles are readable" on public_profiles;
create policy "Public profiles are readable" on public_profiles
  for select using (true);

-- kaleidoscope_draws
alter table kaleidoscope_draws enable row level security;
drop policy if exists "Users manage own draws" on kaleidoscope_draws;
create policy "Users manage own draws" on kaleidoscope_draws
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ==================== 触发器 ====================

-- 幂等补齐 touch_updated_at：远端旧库（早期 0001 用 set_updated_at 命名）没有此函数，
-- 缺失会导致本迁移整体回滚、后续 functions deploy 被 CI 跳过。
create or replace function public.touch_updated_at()
returns trigger language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;
revoke all on function public.touch_updated_at() from public, anon, authenticated;

-- profile_dimensions.updated_at
drop trigger if exists trg_profile_dimensions_touch on profile_dimensions;
create trigger trg_profile_dimensions_touch before update on profile_dimensions
  for each row execute function public.touch_updated_at();

-- public_profiles.updated_at
drop trigger if exists trg_public_profiles_touch on public_profiles;
create trigger trg_public_profiles_touch before update on public_profiles
  for each row execute function public.touch_updated_at();

-- ==================== 权限授予 ====================

-- 新用户表：authenticated 用户可读写自己的数据
grant select, insert, update, delete on table
  profile_dimensions,
  card_game_results,
  bounty_responses,
  public_profiles,
  kaleidoscope_draws
to authenticated;

-- bounties 已有 anon/authenticated 的 select，但现在 authenticated 需要 insert
grant insert, update on table bounties to authenticated;

-- bounties RLS：允许登录用户创建和管理自己的悬赏
drop policy if exists "Users create bounties" on bounties;
create policy "Users create bounties" on bounties
  for insert to authenticated with check (auth.uid() = user_id);
drop policy if exists "Users update own bounties" on bounties;
create policy "Users update own bounties" on bounties
  for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- 序列权限
grant usage, select on sequence
  profile_dimensions_id_seq,
  card_game_results_id_seq,
  bounty_responses_id_seq,
  kaleidoscope_draws_id_seq,
  bounties_id_seq
to authenticated;

-- 公开资料对所有已登录用户可读（RLS 已单独配置 select policy）
grant select on table public_profiles to anon;
