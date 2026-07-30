-- 个人档案最终阶段：
-- 1. 画像从单一 dims 快照升级为可追溯事实，保留来源、置信度、确认状态与生命周期。
-- 2. profiles.profile_revision 为并发修改和 AI 使用披露提供稳定版本号。
-- 3. 提供事务性替换/删除/清空 RPC，避免客户端读改写覆盖并发更新。

alter table public.profiles
  add column if not exists profile_revision bigint not null default 0;

create table if not exists public.profile_facts (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references auth.users(id) on delete cascade,
  dimension       text not null,
  value           text not null,
  source          text not null default 'manual',
  source_ref      text,
  confidence      numeric(3,2) not null default 1,
  user_confirmed  boolean not null default false,
  status          text not null default 'active',
  observed_at     timestamptz not null default now(),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  constraint profile_facts_dimension_check
    check (dimension in (
      'personality', 'skill', 'like', 'love', 'family', 'social', 'life'
    )),
  constraint profile_facts_value_length
    check (char_length(btrim(value)) between 1 and 500),
  constraint profile_facts_source_check
    check (source in (
      'manual', 'assessment', 'card_game', 'chat', 'diary', 'legacy'
    )),
  constraint profile_facts_source_ref_length
    check (source_ref is null or char_length(source_ref) <= 100),
  constraint profile_facts_confidence_range
    check (confidence between 0 and 1),
  constraint profile_facts_status_check
    check (status in ('active', 'superseded')),
  unique (user_id, dimension, value)
);

create index if not exists idx_profile_facts_user_active
  on public.profile_facts(user_id, dimension, updated_at desc)
  where status = 'active';

alter table public.profile_facts enable row level security;

drop policy if exists "Users read own profile facts"
  on public.profile_facts;
create policy "Users read own profile facts"
  on public.profile_facts
  for select
  to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists "Users insert own profile facts"
  on public.profile_facts;
create policy "Users insert own profile facts"
  on public.profile_facts
  for insert
  to authenticated
  with check ((select auth.uid()) = user_id);

drop policy if exists "Users update own profile facts"
  on public.profile_facts;
create policy "Users update own profile facts"
  on public.profile_facts
  for update
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

drop policy if exists "Users delete own profile facts"
  on public.profile_facts;
create policy "Users delete own profile facts"
  on public.profile_facts
  for delete
  to authenticated
  using ((select auth.uid()) = user_id);

revoke all on table public.profile_facts from anon, authenticated;
grant select, insert, update, delete
  on table public.profile_facts
  to authenticated;
grant all privileges
  on table public.profile_facts
  to service_role;

drop trigger if exists trg_profile_facts_touch
  on public.profile_facts;
create trigger trg_profile_facts_touch
  before update on public.profile_facts
  for each row execute function public.touch_updated_at();

-- 先从规范化维度回填原子事实；用户主动操作形成的数据视为已确认。
insert into public.profile_facts (
  user_id,
  dimension,
  value,
  source,
  confidence,
  user_confirmed,
  observed_at
)
select
  d.user_id,
  d.dimension,
  btrim(tag),
  case
    when d.source in ('manual', 'assessment', 'card_game', 'chat', 'diary')
      then d.source
    else 'legacy'
  end,
  case when d.source in ('manual', 'assessment', 'card_game') then 1 else 0.7 end,
  d.source in ('manual', 'assessment', 'card_game'),
  d.updated_at
from public.profile_dimensions d
cross join lateral unnest(d.tags) as tag
where d.dimension in (
  'personality', 'skill', 'like', 'love', 'family', 'social', 'life'
)
  and char_length(btrim(tag)) between 1 and 500
on conflict (user_id, dimension, value) do nothing;

-- 旧数据可能只有 profiles.dims；为每个受支持维度补一个 legacy 事实。
insert into public.profile_facts (
  user_id,
  dimension,
  value,
  source,
  confidence,
  user_confirmed,
  observed_at
)
select
  p.id,
  e.key,
  btrim(e.value),
  'legacy',
  0.5,
  false,
  p.updated_at
from public.profiles p
cross join lateral jsonb_each_text(coalesce(p.dims, '{}'::jsonb)) e
where e.key in (
  'personality', 'skill', 'like', 'love', 'family', 'social', 'life'
)
  and char_length(btrim(e.value)) between 1 and 500
on conflict (user_id, dimension, value) do nothing;

update public.profiles
   set profile_revision = 1
 where profile_revision = 0
   and dims <> '{}'::jsonb;

create or replace function public.replace_profile_dimension(
  p_dimension text,
  p_values text[],
  p_source text default 'manual',
  p_source_ref text default null,
  p_confidence numeric default 1,
  p_user_confirmed boolean default true,
  p_portrait_delta integer default 0,
  p_expected_revision bigint default null
)
returns table (
  profile_revision bigint,
  portrait_pct smallint,
  dims jsonb
)
language plpgsql
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_revision bigint;
  v_values text[];
  v_value text;
begin
  if v_user_id is null then
    raise exception using errcode = '42501', message = 'authentication required';
  end if;
  if p_dimension not in (
    'personality', 'skill', 'like', 'love', 'family', 'social', 'life'
  ) then
    raise exception using errcode = '22023', message = 'invalid profile dimension';
  end if;
  if p_source not in (
    'manual', 'assessment', 'card_game', 'chat', 'diary', 'legacy'
  ) then
    raise exception using errcode = '22023', message = 'invalid profile source';
  end if;
  if p_source_ref is not null and char_length(p_source_ref) > 100 then
    raise exception using errcode = '22023', message = 'source reference too long';
  end if;
  if p_confidence < 0 or p_confidence > 1 then
    raise exception using errcode = '22023', message = 'invalid confidence';
  end if;

  select array_agg(value order by first_seen)
    into v_values
    from (
      select btrim(raw_value) as value, min(ordinality) as first_seen
        from unnest(coalesce(p_values, '{}'::text[]))
          with ordinality as input(raw_value, ordinality)
       where char_length(btrim(raw_value)) between 1 and 500
       group by btrim(raw_value)
    ) cleaned;
  if coalesce(cardinality(v_values), 0) < 1
     or cardinality(v_values) > 20 then
    raise exception using errcode = '22023', message = 'profile values must contain 1 to 20 items';
  end if;

  insert into public.profiles (id)
  values (v_user_id)
  on conflict (id) do nothing;

  select p.profile_revision
    into v_revision
    from public.profiles p
   where p.id = v_user_id
   for update;
  if p_expected_revision is not null and p_expected_revision <> v_revision then
    raise exception using
      errcode = '40001',
      message = 'profile revision conflict';
  end if;

  update public.profile_facts
     set status = 'superseded'
   where user_id = v_user_id
     and dimension = p_dimension
     and status = 'active'
     and not (value = any(v_values));

  foreach v_value in array v_values loop
    insert into public.profile_facts (
      user_id,
      dimension,
      value,
      source,
      source_ref,
      confidence,
      user_confirmed,
      status,
      observed_at
    )
    values (
      v_user_id,
      p_dimension,
      v_value,
      p_source,
      p_source_ref,
      p_confidence,
      p_user_confirmed,
      'active',
      now()
    )
    on conflict (user_id, dimension, value) do update
      set source = excluded.source,
          source_ref = excluded.source_ref,
          confidence = excluded.confidence,
          user_confirmed = excluded.user_confirmed,
          status = 'active',
          observed_at = excluded.observed_at;
  end loop;

  insert into public.profile_dimensions (
    user_id,
    dimension,
    tags,
    source
  )
  values (
    v_user_id,
    p_dimension,
    v_values,
    p_source
  )
  on conflict (user_id, dimension) do update
    set tags = excluded.tags,
        source = excluded.source;

  update public.profiles p
     set portrait_pct = least(
           100,
           greatest(0, p.portrait_pct + coalesce(p_portrait_delta, 0))
         )::smallint,
         dims = jsonb_set(
           coalesce(p.dims, '{}'::jsonb),
           array[p_dimension],
           to_jsonb(array_to_string(v_values, ' · ')),
           true
         ),
         profile_revision = p.profile_revision + 1
   where p.id = v_user_id;

  return query
  select p.profile_revision, p.portrait_pct, p.dims
    from public.profiles p
   where p.id = v_user_id;
end;
$$;

create or replace function public.delete_profile_dimension(
  p_dimension text,
  p_expected_revision bigint default null
)
returns table (
  profile_revision bigint,
  portrait_pct smallint,
  dims jsonb
)
language plpgsql
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_revision bigint;
begin
  if v_user_id is null then
    raise exception using errcode = '42501', message = 'authentication required';
  end if;
  if p_dimension not in (
    'personality', 'skill', 'like', 'love', 'family', 'social', 'life'
  ) then
    raise exception using errcode = '22023', message = 'invalid profile dimension';
  end if;

  select p.profile_revision
    into v_revision
    from public.profiles p
   where p.id = v_user_id
   for update;
  if not found then
    raise exception using errcode = 'P0002', message = 'profile not found';
  end if;
  if p_expected_revision is not null and p_expected_revision <> v_revision then
    raise exception using
      errcode = '40001',
      message = 'profile revision conflict';
  end if;

  delete from public.profile_facts
   where user_id = v_user_id and dimension = p_dimension;
  delete from public.profile_dimensions
   where user_id = v_user_id and dimension = p_dimension;
  delete from public.card_game_results
   where user_id = v_user_id
     and kind = case p_dimension
       when 'life' then 'life'
       when 'love' then 'marriage'
       when 'family' then 'family'
       when 'social' then 'social'
       else '__none__'
     end;

  update public.profiles p
     set dims = coalesce(p.dims, '{}'::jsonb) - p_dimension,
         profile_revision = p.profile_revision + 1
   where p.id = v_user_id;

  return query
  select p.profile_revision, p.portrait_pct, p.dims
    from public.profiles p
   where p.id = v_user_id;
end;
$$;

create or replace function public.clear_private_profile(
  p_expected_revision bigint default null
)
returns table (
  profile_revision bigint,
  portrait_pct smallint,
  dims jsonb
)
language plpgsql
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_revision bigint;
begin
  if v_user_id is null then
    raise exception using errcode = '42501', message = 'authentication required';
  end if;

  select p.profile_revision
    into v_revision
    from public.profiles p
   where p.id = v_user_id
   for update;
  if not found then
    raise exception using errcode = 'P0002', message = 'profile not found';
  end if;
  if p_expected_revision is not null and p_expected_revision <> v_revision then
    raise exception using
      errcode = '40001',
      message = 'profile revision conflict';
  end if;

  delete from public.profile_facts where user_id = v_user_id;
  delete from public.profile_dimensions where user_id = v_user_id;
  delete from public.card_game_results where user_id = v_user_id;
  delete from public.persona_jobs where user_id = v_user_id;
  delete from public.profile_ai_permissions where user_id = v_user_id;

  update public.profiles p
     set dims = '{}'::jsonb,
         portrait_pct = 0,
         profile_revision = p.profile_revision + 1
   where p.id = v_user_id;

  return query
  select p.profile_revision, p.portrait_pct, p.dims
    from public.profiles p
   where p.id = v_user_id;
end;
$$;

create or replace function public.confirm_profile_fact(
  p_fact_id uuid,
  p_expected_revision bigint default null
)
returns table (
  profile_revision bigint,
  portrait_pct smallint,
  dims jsonb
)
language plpgsql
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_revision bigint;
begin
  if v_user_id is null then
    raise exception using errcode = '42501', message = 'authentication required';
  end if;

  select p.profile_revision
    into v_revision
    from public.profiles p
   where p.id = v_user_id
   for update;
  if not found then
    raise exception using errcode = 'P0002', message = 'profile not found';
  end if;
  if p_expected_revision is not null and p_expected_revision <> v_revision then
    raise exception using
      errcode = '40001',
      message = 'profile revision conflict';
  end if;

  update public.profile_facts
     set user_confirmed = true,
         confidence = 1
   where id = p_fact_id
     and user_id = v_user_id
     and status = 'active';
  if not found then
    raise exception using errcode = 'P0002', message = 'profile fact not found';
  end if;

  update public.profiles p
     set profile_revision = p.profile_revision + 1
   where p.id = v_user_id;

  return query
  select p.profile_revision, p.portrait_pct, p.dims
    from public.profiles p
   where p.id = v_user_id;
end;
$$;

revoke all on function public.replace_profile_dimension(
  text, text[], text, text, numeric, boolean, integer, bigint
) from public, anon;
grant execute on function public.replace_profile_dimension(
  text, text[], text, text, numeric, boolean, integer, bigint
) to authenticated;

revoke all on function public.delete_profile_dimension(text, bigint)
  from public, anon;
grant execute on function public.delete_profile_dimension(text, bigint)
  to authenticated;

revoke all on function public.clear_private_profile(bigint)
  from public, anon;
grant execute on function public.clear_private_profile(bigint)
  to authenticated;

revoke all on function public.confirm_profile_fact(uuid, bigint)
  from public, anon;
grant execute on function public.confirm_profile_fact(uuid, bigint)
  to authenticated;

-- 兼容仍调用 apply_profile_update 的旧客户端：保留旧签名，同时递增 revision。
drop function if exists public.apply_profile_update(jsonb, integer);
create or replace function public.apply_profile_update(
  p_dims jsonb,
  p_portrait_delta integer
)
returns table (
  portrait_pct smallint,
  dims jsonb,
  profile_revision bigint
)
language sql
set search_path = ''
as $$
  insert into public.profiles as p (
    id,
    portrait_pct,
    dims,
    profile_revision
  )
  values (
    auth.uid(),
    least(100, greatest(0, coalesce(p_portrait_delta, 0)))::smallint,
    coalesce(p_dims, '{}'::jsonb),
    1
  )
  on conflict (id) do update
    set portrait_pct =
          least(
            100,
            greatest(0, p.portrait_pct + coalesce(p_portrait_delta, 0))
          )::smallint,
        dims = coalesce(p.dims, '{}'::jsonb) ||
          coalesce(excluded.dims, '{}'::jsonb),
        profile_revision = p.profile_revision + 1
  returning p.portrait_pct, p.dims, p.profile_revision;
$$;

revoke all on function public.apply_profile_update(jsonb, integer)
  from public, anon;
grant execute on function public.apply_profile_update(jsonb, integer)
  to authenticated;

-- 匿名账号转正式账号时迁移事实，正式账号同值事实优先。
-- 本函数保持与上一版完整逻辑一致，只增加 profile_revision 与 profile_facts。
create or replace function public.merge_anonymous_user(p_old uuid, p_new uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_old is null or p_new is null or p_old = p_new then
    raise exception 'merge_anonymous_user: invalid arguments';
  end if;

  update public.profiles n
     set dims = o.dims || n.dims,
         portrait_pct = greatest(n.portrait_pct, o.portrait_pct),
         profile_revision = greatest(n.profile_revision, o.profile_revision) + 1
    from public.profiles o
   where n.id = p_new and o.id = p_old;
  delete from public.profiles where id = p_old;

  update public.public_profiles set id = p_new
   where id = p_old
     and not exists (
       select 1 from public.public_profiles where id = p_new
     );
  delete from public.public_profiles where id = p_old;

  update public.profile_ai_permissions n
     set permissions = o.permissions || n.permissions
    from public.profile_ai_permissions o
   where n.user_id = p_new and o.user_id = p_old;
  update public.profile_ai_permissions
     set user_id = p_new
   where user_id = p_old
     and not exists (
       select 1
         from public.profile_ai_permissions
        where user_id = p_new
     );
  delete from public.profile_ai_permissions where user_id = p_old;

  delete from public.profile_facts o
   where o.user_id = p_old
     and exists (
       select 1
         from public.profile_facts n
        where n.user_id = p_new
          and n.dimension = o.dimension
          and n.value = o.value
     );
  update public.profile_facts set user_id = p_new where user_id = p_old;

  update public.conversations set user_id = p_new where user_id = p_old;
  update public.diary_entries set user_id = p_new where user_id = p_old;
  update public.simulations set user_id = p_new where user_id = p_old;
  update public.bounties set user_id = p_new where user_id = p_old;
  update public.kaleidoscope_draws set user_id = p_new where user_id = p_old;
  update public.persona_jobs set user_id = p_new where user_id = p_old;
  update public.match_results set user_id = p_new where user_id = p_old;
  update public.lab_choice_sets set user_id = p_new where user_id = p_old;

  update public.app_event_user_aliases
     set new_user_id = p_new
   where new_user_id = p_old;
  insert into public.app_event_user_aliases (old_user_id, new_user_id)
  values (p_old, p_new)
  on conflict (old_user_id) do update
    set new_user_id = excluded.new_user_id,
        created_at = now();
  update public.app_events set user_id = p_new where user_id = p_old;

  delete from public.unlocks o
   where o.user_id = p_old
     and exists (
       select 1 from public.unlocks n
        where n.user_id = p_new
          and n.kind = o.kind
          and n.target_id = o.target_id
     );
  update public.unlocks set user_id = p_new where user_id = p_old;

  delete from public.profile_dimensions o
   where o.user_id = p_old
     and exists (
       select 1 from public.profile_dimensions n
        where n.user_id = p_new and n.dimension = o.dimension
     );
  update public.profile_dimensions
     set user_id = p_new
   where user_id = p_old;

  delete from public.card_game_results o
   where o.user_id = p_old
     and exists (
       select 1 from public.card_game_results n
        where n.user_id = p_new and n.kind = o.kind
     );
  update public.card_game_results
     set user_id = p_new
   where user_id = p_old;

  delete from public.bounty_responses o
   where o.user_id = p_old
     and exists (
       select 1 from public.bounty_responses n
        where n.user_id = p_new and n.bounty_id = o.bounty_id
     );
  update public.bounty_responses
     set user_id = p_new
   where user_id = p_old;

  delete from public.diary_summary_cache o
   where o.user_id = p_old
     and exists (
       select 1 from public.diary_summary_cache n
        where n.user_id = p_new
          and n.period = o.period
          and n.ref = o.ref
     );
  update public.diary_summary_cache
     set user_id = p_new
   where user_id = p_old;
end;
$$;

revoke all on function public.merge_anonymous_user(uuid, uuid)
  from public, anon, authenticated;
grant execute on function public.merge_anonymous_user(uuid, uuid)
  to service_role;
