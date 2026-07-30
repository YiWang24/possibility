\set ON_ERROR_STOP on

-- 私密画像事实、乐观并发、确认/删除/清空与跨用户 RLS。
-- 运行：npm run db:test

begin;

insert into auth.users (id, role, created_at, updated_at)
values
  ('33333333-3333-4333-8333-333333333333', 'authenticated', now(), now()),
  ('44444444-4444-4444-8444-444444444444', 'authenticated', now(), now());

select set_config(
  'request.jwt.claim.sub',
  '33333333-3333-4333-8333-333333333333',
  true
);
set local role authenticated;

do $$
declare
  v_revision bigint;
  v_fact_id uuid;
begin
  select result.profile_revision
    into v_revision
    from public.replace_profile_dimension(
      p_dimension => 'skill',
      p_values => array['拆解复杂问题', '写作'],
      p_source => 'chat',
      p_source_ref => 'conversation-1',
      p_confidence => 0.72,
      p_user_confirmed => false,
      p_portrait_delta => 10,
      p_expected_revision => 0
    ) result;
  if v_revision <> 1 then
    raise exception 'replace should advance revision 0 -> 1, got %', v_revision;
  end if;
  if (
    select count(*) from public.profile_facts
    where dimension = 'skill' and status = 'active'
  ) <> 2 then
    raise exception 'replace should create two active atomic facts';
  end if;
  if (
    select count(*) from public.profile_facts
    where source = 'chat'
      and confidence = 0.72
      and not user_confirmed
  ) <> 2 then
    raise exception 'fact provenance/confidence/confirmation should be retained';
  end if;

  begin
    perform * from public.replace_profile_dimension(
      p_dimension => 'skill',
      p_values => array['stale write'],
      p_expected_revision => 0
    );
    raise exception 'stale revision unexpectedly succeeded';
  exception when serialization_failure then null;
  end;

  select id into v_fact_id
  from public.profile_facts
  where dimension = 'skill' and value = '拆解复杂问题';

  select result.profile_revision
    into v_revision
    from public.confirm_profile_fact(v_fact_id, 1) result;
  if v_revision <> 2 then
    raise exception 'confirm should advance revision 1 -> 2, got %', v_revision;
  end if;
  if not (
    select user_confirmed and confidence = 1
    from public.profile_facts
    where id = v_fact_id
  ) then
    raise exception 'confirm should mark fact confirmed with confidence 1';
  end if;
end
$$;

reset role;

-- 用户 B 不能读取、修改或冒充写入用户 A 的事实。
select set_config(
  'request.jwt.claim.sub',
  '44444444-4444-4444-8444-444444444444',
  true
);
set local role authenticated;

do $$
begin
  if (select count(*) from public.profile_facts) <> 0 then
    raise exception 'cross-user profile facts leaked';
  end if;

  update public.profile_facts
     set value = 'hacked'
   where user_id = '33333333-3333-4333-8333-333333333333';
  if found then
    raise exception 'cross-user fact update unexpectedly succeeded';
  end if;

  delete from public.profile_facts
   where user_id = '33333333-3333-4333-8333-333333333333';
  if found then
    raise exception 'cross-user fact delete unexpectedly succeeded';
  end if;

  begin
    insert into public.profile_facts (
      user_id, dimension, value, source, confidence, user_confirmed
    ) values (
      '33333333-3333-4333-8333-333333333333',
      'like',
      'forbidden',
      'manual',
      1,
      true
    );
    raise exception 'cross-user fact insert unexpectedly succeeded';
  exception when insufficient_privilege then null;
  end;
end
$$;

reset role;

-- anon 没有私密事实表读取权限，也不能执行画像写 RPC。
set local role anon;
do $$
begin
  begin
    perform count(*) from public.profile_facts;
    raise exception 'anon fact read unexpectedly succeeded';
  exception when insufficient_privilege then null;
  end;

  begin
    perform * from public.delete_profile_dimension('skill', 2);
    raise exception 'anon profile RPC unexpectedly succeeded';
  exception when insufficient_privilege then null;
  end;
end
$$;
reset role;

-- 回到 A：按维度删除，再验证清空私密画像不会删除公开主页。
select set_config(
  'request.jwt.claim.sub',
  '33333333-3333-4333-8333-333333333333',
  true
);
set local role authenticated;

do $$
declare
  v_revision bigint;
begin
  select result.profile_revision
    into v_revision
    from public.delete_profile_dimension('skill', 2) result;
  if v_revision <> 3 then
    raise exception 'dimension delete should advance revision 2 -> 3';
  end if;
  if exists (
    select 1 from public.profile_facts where dimension = 'skill'
  ) or exists (
    select 1 from public.profile_dimensions where dimension = 'skill'
  ) then
    raise exception 'dimension delete should remove facts and aggregate row';
  end if;

  perform * from public.replace_profile_dimension(
    p_dimension => 'family',
    p_values => array['信任'],
    p_source => 'manual',
    p_expected_revision => 3
  );
  insert into public.card_game_results (user_id, kind, final_cards)
  values (
    '33333333-3333-4333-8333-333333333333',
    'family',
    '[{"id":"f1","name":"信任"}]'::jsonb
  );
  insert into public.profile_ai_permissions (user_id, permissions)
  values (
    '33333333-3333-4333-8333-333333333333',
    '{"family":{"chat":true}}'::jsonb
  );
  insert into public.persona_jobs (user_id, status)
  values ('33333333-3333-4333-8333-333333333333', 'completed');
  insert into public.public_profiles (id, name)
  values ('33333333-3333-4333-8333-333333333333', '公开主页保留');

  select result.profile_revision
    into v_revision
    from public.clear_private_profile(4) result;
  if v_revision <> 5 then
    raise exception 'clear should advance revision 4 -> 5';
  end if;
  if exists (select 1 from public.profile_facts)
     or exists (select 1 from public.profile_dimensions)
     or exists (select 1 from public.card_game_results)
     or exists (select 1 from public.profile_ai_permissions)
     or exists (select 1 from public.persona_jobs) then
    raise exception 'clear should remove all private profile material';
  end if;
  if (
    select name from public.public_profiles
    where id = '33333333-3333-4333-8333-333333333333'
  ) <> '公开主页保留' then
    raise exception 'clear private profile must preserve public profile';
  end if;
end
$$;

rollback;
