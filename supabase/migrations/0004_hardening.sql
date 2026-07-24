-- 万花筒 KALEIDO · 权限与数据约束加固
-- Supabase 新项目默认不再自动向 Data API roles 暴露新表，因此显式授权。

grant usage on schema public to anon, authenticated, service_role;

grant select on table
  travelers,
  traveler_details,
  traveler_services,
  bounties
to anon, authenticated;

grant select, insert, update, delete on table
  profiles,
  conversations,
  messages,
  diary_entries,
  simulations,
  unlocks
to authenticated;

grant usage, select on sequence
  messages_id_seq,
  diary_entries_id_seq,
  simulations_id_seq,
  unlocks_id_seq
to authenticated;

-- service_role 用于受控运维/后台任务；RLS 对它默认旁路。
grant all privileges on all tables in schema public to service_role;
grant all privileges on all sequences in schema public to service_role;

-- 明确 JSON 顶层形状，避免客户端或模型写入与契约不符的数据。
alter table travelers
  add constraint travelers_dims_array check (jsonb_typeof(dims) = 'array'),
  add constraint travelers_trajectory_array check (jsonb_typeof(trajectory) = 'array');

alter table traveler_details
  add constraint traveler_details_advice_object check (jsonb_typeof(advice) = 'object');

alter table profiles
  add constraint profiles_dims_object check (jsonb_typeof(dims) = 'object');

alter table conversations
  add constraint conversations_crossroads_object
  check (crossroads is null or jsonb_typeof(crossroads) = 'object');

alter table simulations
  add constraint simulations_scenarios_object check (jsonb_typeof(scenarios) = 'object');

alter table unlocks
  add constraint unlocks_positive_amount check (amount > 0);
