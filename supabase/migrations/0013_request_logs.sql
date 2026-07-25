-- 0013_request_logs.sql — 补齐两处只返回不落库的 LLM 请求：
-- 旅人匹配（match）与人生实验室选择卡（lab-choices）。
-- 目标：每次产生 AI 结果的用户请求都留痕，便于回看与后续分析。

-- ==================== 旅人匹配结果 ====================
-- 记录每次 /match 请求：输入的用户状态快照 + AI 返回的 3 条匹配。
create table if not exists match_results (
  id          bigserial primary key,
  user_id     uuid not null references auth.users(id) on delete cascade,
  user_state  jsonb not null,                -- 匹配时的用户状态快照（life_stage/tension/...）
  matches     jsonb not null,                -- [{traveler_id, reason, not_applicable}]
  created_at  timestamptz not null default now()
);
create index if not exists idx_match_results_user on match_results(user_id, created_at desc);

-- ==================== 人生实验室选择卡 ====================
-- 记录每次 /lab-choices 请求：探索的问题/约束 + AI 生成的选择卡。
create table if not exists lab_choice_sets (
  id                bigserial primary key,
  user_id           uuid not null references auth.users(id) on delete cascade,
  question          text not null,
  topic             text,
  constraints       text[] not null default '{}',
  previous_choices  text[] not null default '{}',
  cards             jsonb not null,          -- [{id, glyph, title, description, color}]
  rationale         text not null default '',
  created_at        timestamptz not null default now()
);
create index if not exists idx_lab_choice_sets_user on lab_choice_sets(user_id, created_at desc);

-- ==================== RLS 策略 ====================
-- 与 kaleidoscope_draws 一致：仅本人可读写自己的记录。

alter table match_results enable row level security;
drop policy if exists "Users manage own match results" on match_results;
create policy "Users manage own match results" on match_results
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

alter table lab_choice_sets enable row level security;
drop policy if exists "Users manage own lab choices" on lab_choice_sets;
create policy "Users manage own lab choices" on lab_choice_sets
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ==================== 权限授予 ====================

grant select, insert, update, delete on table
  match_results,
  lab_choice_sets
to authenticated;

grant usage, select on sequence
  match_results_id_seq,
  lab_choice_sets_id_seq
to authenticated;
