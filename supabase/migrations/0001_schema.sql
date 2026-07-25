-- 0001_schema.sql — Possibility 数据模型（对应技术设计文档 §4.1/§4.2）
create extension if not exists pgcrypto;

-- ==================== 内容侧（公开只读） ====================

-- 旅人（经验贡献者）：对应原型 USERS
create table if not exists travelers (
  id           bigint primary key,
  name         text not null,
  initial      text not null,            -- 头像单字
  hue          smallint not null,        -- 配色索引 0..4
  is_similar   boolean not null default false,
  quote        text not null,
  bio          text not null,
  tags         text[] not null default '{}',
  dims         jsonb not null default '[]',   -- [["我擅长","..."],...]
  trajectory   jsonb not null default '[]',   -- [{age,t,d},...]
  created_at   timestamptz not null default now()
);

-- 旅人详情：对应原型 PROFILE_META（full/advice 付费解锁）
create table if not exists traveler_details (
  traveler_id   bigint primary key references travelers(id) on delete cascade,
  age           int,
  city          text,
  from_role     text,
  to_role       text,
  years         text,
  intro         text not null,           -- 免费可见
  full_text     text not null,           -- 付费解锁
  advice        jsonb not null default '{}',  -- {decision:[],ability:[],interview:[]}
  result        text,
  consulted     int,
  response_time text
);

-- 增值服务：对应原型 PROFILE_SERVICES
create table if not exists traveler_services (
  id           text primary key,         -- consult / materials / companion
  traveler_id  bigint references travelers(id) on delete cascade,
  kind         text not null,
  title        text not null,
  price        numeric(10,2) not null,
  unit         text not null default '',
  description  text not null,
  tags         text[] not null default '{}'
);

-- 悬赏：对应原型 BOUNTIES
create table if not exists bounties (
  id         bigserial primary key,
  question   text not null,
  reward     text not null,
  responses  text not null,
  created_at timestamptz not null default now()
);

-- ==================== 用户侧（RLS 锁 auth.uid()，见 0002） ====================

-- 当前用户动态画像
create table if not exists profiles (
  id           uuid primary key references auth.users(id) on delete cascade,
  portrait_pct smallint not null default 0,
  dims         jsonb not null default '{}',
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

-- 对话（一次迷茫 → 一个岔路口）
create table if not exists conversations (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  topic       text not null,
  status      text not null default 'open',   -- open|crossroads|paid|closed
  crossroads  jsonb,                           -- {ready,summary,match_query}
  created_at  timestamptz not null default now()
);
create index if not exists idx_conversations_user on conversations(user_id, created_at desc);

create table if not exists messages (
  id              bigserial primary key,
  conversation_id uuid not null references conversations(id) on delete cascade,
  role            text not null check (role in ('user','assistant')),
  content         text not null,
  meta            jsonb,
  created_at      timestamptz not null default now()
);
create index if not exists idx_messages_conv on messages(conversation_id, created_at);

-- 语音日记
create table if not exists diary_entries (
  id         bigserial primary key,
  user_id    uuid not null references auth.users(id) on delete cascade,
  audio_path text,
  transcript text,
  emotions   text[],
  keywords   text[],
  created_at timestamptz not null default now()
);
create index if not exists idx_diary_user on diary_entries(user_id, created_at desc);

-- 人生实验室推演
create table if not exists simulations (
  id         bigserial primary key,
  user_id    uuid not null references auth.users(id) on delete cascade,
  question   text not null,
  choice     text not null,
  years      int not null,
  scenarios  jsonb not null,             -- {general,optimistic,cautionary}
  created_at timestamptz not null default now()
);

-- 解锁 / 买断记录（demo mock 支付）
create table if not exists unlocks (
  id         bigserial primary key,
  user_id    uuid not null references auth.users(id) on delete cascade,
  kind       text not null check (kind in ('profile','service')),
  target_id  text not null,
  amount     numeric(10,2) not null,
  created_at timestamptz not null default now(),
  unique (user_id, kind, target_id)
);

-- ==================== 触发器 ====================

-- 匿名/正式注册即建 profiles 行
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id) values (new.id) on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- profiles.updated_at 自动维护
create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_profiles_touch on profiles;
create trigger trg_profiles_touch before update on profiles
  for each row execute function public.touch_updated_at();
