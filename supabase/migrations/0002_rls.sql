-- 0002_rls.sql — 行级安全（对应技术设计文档 §4.3）
-- 内容表：匿名可 SELECT；写入仅 service role（绕过 RLS）。
-- 用户表：仅本人（auth.uid()）可读写。

-- ---------- 内容侧：公开只读 ----------
alter table travelers          enable row level security;
alter table traveler_details   enable row level security;
alter table traveler_services  enable row level security;
alter table bounties           enable row level security;

create policy read_travelers         on travelers         for select using (true);
create policy read_traveler_details  on traveler_details  for select using (true);
create policy read_traveler_services on traveler_services for select using (true);
create policy read_bounties          on bounties          for select using (true);

-- ---------- 用户侧：仅本人 ----------
alter table profiles enable row level security;
create policy own_profile on profiles for all
  using (auth.uid() = id) with check (auth.uid() = id);

alter table conversations enable row level security;
create policy own_conversations on conversations for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- messages 通过所属 conversation 校验 owner
alter table messages enable row level security;
create policy own_messages on messages for all
  using (exists (select 1 from conversations c
                 where c.id = messages.conversation_id and c.user_id = auth.uid()))
  with check (exists (select 1 from conversations c
                 where c.id = messages.conversation_id and c.user_id = auth.uid()));

alter table diary_entries enable row level security;
create policy own_diary on diary_entries for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

alter table simulations enable row level security;
create policy own_simulations on simulations for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

alter table unlocks enable row level security;
create policy own_unlocks on unlocks for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);
