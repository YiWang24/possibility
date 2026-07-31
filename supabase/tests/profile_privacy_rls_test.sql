\set ON_ERROR_STOP on

-- 最终画像模型：原子事实、提案审核、公开/私人边界与跨用户 RLS。
-- 运行：npm run db:test

begin;

insert into auth.users (id, role, created_at, updated_at)
values
  ('33333333-3333-4333-8333-333333333333', 'authenticated', now(), now()),
  ('44444444-4444-4444-8444-444444444444', 'authenticated', now(), now());

-- 模拟升级前已经存在、尚未由用户确认的推断事实。
insert into public.profile_facts (
  user_id,
  dimension,
  value,
  normalized_value,
  source,
  confidence,
  user_confirmed
)
values (
  '33333333-3333-4333-8333-333333333333',
  'like',
  '旧推断',
  '旧推断',
  'legacy',
  0.72,
  false
);

do $$
begin
  if to_regclass('public.profile_dimensions') is not null then
    raise exception 'profile_dimensions compatibility table must be removed';
  end if;
  if exists (
    select 1
      from information_schema.columns
     where table_schema = 'public'
       and table_name = 'profiles'
       and column_name = 'dims'
  ) then
    raise exception 'profiles.dims compatibility column must be removed';
  end if;
  if to_regclass('public.profile_ai_permissions') is not null then
    raise exception 'purpose-scoped permission table must be removed';
  end if;
  if exists (
    select 1
      from information_schema.columns
     where table_schema = 'public'
       and table_name = 'profiles'
       and column_name = 'permission_revision'
  ) then
    raise exception 'permission_revision must be removed';
  end if;
end
$$;

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
  v_proposal_id uuid;
begin
  begin
    update public.profiles
       set verification_status = 'verified',
           verification_provider = 'self_asserted',
           verified_at = now();
    raise exception 'client self-verification unexpectedly succeeded';
  exception when insufficient_privilege then null;
  end;

  select result.profile_revision
    into v_revision
    from public.replace_profile_dimension(
      p_dimension => 'skill',
      p_values => array['拆解复杂问题', '写作'],
      p_source => 'manual',
      p_confidence => 1,
      p_user_confirmed => true,
      p_portrait_delta => 10,
      p_expected_revision => 0
    ) result;
  if v_revision <> 1 then
    raise exception 'replace should advance profile revision 0 -> 1, got %', v_revision;
  end if;
  if (
    select count(*) from public.profile_facts
     where dimension = 'skill' and status = 'active'
  ) <> 2 then
    raise exception 'replace should create two active atomic facts';
  end if;
  begin
    perform * from public.replace_profile_dimension(
      p_dimension => 'skill',
      p_values => array['伪造测评来源'],
      p_source => 'assessment',
      p_expected_revision => 1
    );
    raise exception 'direct client forged an assessment source';
  exception when invalid_parameter_value then null;
  end;

  begin
    perform * from public.replace_profile_dimension(
      p_dimension => 'skill',
      p_values => array['stale write'],
      p_expected_revision => 0
    );
    raise exception 'stale profile revision unexpectedly succeeded';
  exception when serialization_failure then null;
  end;

  select id into v_fact_id
    from public.profile_facts
   where dimension = 'like' and value = '旧推断';
  select result.profile_revision
    into v_revision
    from public.confirm_profile_fact(v_fact_id, 1) result;
  if v_revision <> 2 then
    raise exception 'confirm should advance profile revision 1 -> 2, got %', v_revision;
  end if;

  v_proposal_id := public.propose_profile_fact(
    'like',
    '安静阅读',
    'chat',
    'conversation-1',
    0.84,
    'preference',
    'low',
    1,
    'test-model',
    'profile-v1'
  );
  if exists (
    select 1 from public.profile_facts
     where dimension = 'like' and value = '安静阅读'
  ) then
    raise exception 'AI proposal must not write authoritative facts before review';
  end if;

  select result.profile_revision
    into v_revision
    from public.review_profile_proposal(v_proposal_id, true, 2) result;
  if v_revision <> 3 then
    raise exception 'accepted proposal should advance revision 2 -> 3, got %', v_revision;
  end if;
  if not exists (
    select 1 from public.profile_facts
     where dimension = 'like'
       and value = '安静阅读'
       and user_confirmed
       and source = 'chat'
       and visibility = 'private'
  ) or not exists (
    select 1
      from public.profile_fact_evidence evidence
      join public.profile_facts fact on fact.id = evidence.fact_id
     where fact.value = '安静阅读'
       and evidence.source_type = 'conversation'
       and evidence.source_id = 'conversation-1'
  ) then
    raise exception 'accepted proposal should create a confirmed fact with evidence';
  end if;

  perform public.save_public_profile(
    jsonb_build_object(
      'profile_version', 2,
      'name', '公开主页保留',
      'bio', '仅公开低风险资料'
    )
  );
  if (
    select published_facts = '{}'::jsonb and not is_verified
      from public.public_profiles
     where id = '33333333-3333-4333-8333-333333333333'
  ) is not true then
    raise exception 'new facts must remain private by default';
  end if;

  select id into v_fact_id
    from public.profile_facts
   where dimension = 'skill' and value = '拆解复杂问题';
  select result.profile_revision
    into v_revision
    from public.set_profile_fact_visibility(v_fact_id, 'public', 3) result;
  if v_revision <> 4 then
    raise exception 'visibility change should advance revision 3 -> 4';
  end if;
  begin
    perform * from public.set_profile_fact_visibility(
      v_fact_id,
      'friends',
      4
    );
    raise exception 'invalid fact visibility unexpectedly succeeded';
  exception when invalid_parameter_value then null;
  end;
  if (
    select published_facts -> 'skill' = '["拆解复杂问题"]'::jsonb
      and not (published_facts ? 'like')
      from public.public_profiles
     where id = '33333333-3333-4333-8333-333333333333'
  ) is not true then
    raise exception 'publication should include only explicitly public facts';
  end if;

  select result.profile_revision
    into v_revision
    from public.delete_profile_dimension('skill', 4) result;
  if v_revision <> 5 then
    raise exception 'dimension delete should advance profile revision 4 -> 5, got %', v_revision;
  end if;
  if exists (
    select 1 from public.profile_facts where dimension = 'skill'
  ) then
    raise exception 'dimension delete should remove its facts';
  end if;
  if (
    select published_facts ? 'skill'
      from public.public_profiles
     where id = '33333333-3333-4333-8333-333333333333'
  ) then
    raise exception 'published fact projection should refresh after deletion';
  end if;

  select result.profile_revision
    into v_revision
    from public.save_assessment_and_profile(
      'personality',
      array['高开放性'],
      'bigfive',
      '[4,3,2]'::jsonb,
      '{"openness":82}'::jsonb,
      1,
      5
    ) result;
  if v_revision <> 6 or not exists (
    select 1 from public.assessment_runs
     where assessment_kind = 'bigfive'
       and answers = '[4,3,2]'::jsonb
  ) then
    raise exception 'assessment result and facts must be saved atomically';
  end if;

  select result.profile_revision
    into v_revision
    from public.clear_profile(6) result;
  if v_revision <> 7 then
    raise exception 'clear should advance profile revision 6 -> 7, got %', v_revision;
  end if;
  if exists (select 1 from public.profile_facts)
     or exists (select 1 from public.profile_fact_evidence)
     or exists (select 1 from public.memory_proposals)
     or exists (select 1 from public.assessment_runs)
     or exists (select 1 from public.card_game_results)
     or exists (select 1 from public.persona_jobs) then
    raise exception 'clear should remove all profile material';
  end if;
  if (
    select name = '公开主页保留' and published_facts = '{}'::jsonb
      from public.public_profiles
     where id = '33333333-3333-4333-8333-333333333333'
  ) is not true then
    raise exception 'clear profile must preserve public page and clear published facts';
  end if;
end
$$;

reset role;

-- 可信服务更新验证状态后，公开层只同步布尔徽章。
update public.profiles
   set verification_status = 'verified',
       verification_provider = 'alipay',
       verified_at = now()
 where id = '33333333-3333-4333-8333-333333333333';
do $$
begin
  if (
    select is_verified
      from public.public_profiles
     where id = '33333333-3333-4333-8333-333333333333'
  ) is not true then
    raise exception 'trusted verification update should refresh public badge';
  end if;
end
$$;

-- 用户 B 不能读取 A 的私密画像表，也不能直接写入自己的事实。
select set_config(
  'request.jwt.claim.sub',
  '44444444-4444-4444-8444-444444444444',
  true
);
set local role authenticated;

do $$
begin
  if (select count(*) from public.profile_facts) <> 0
     or (select count(*) from public.profile_fact_evidence) <> 0
     or (select count(*) from public.memory_proposals) <> 0
     or (select count(*) from public.assessment_runs) <> 0
     or (select count(*) from public.profile_public_drafts) <> 0 then
    raise exception 'cross-user private profile data leaked';
  end if;

  begin
    insert into public.profile_facts (
      user_id, dimension, value, normalized_value, source
    ) values (
      '44444444-4444-4444-8444-444444444444',
      'like',
      'forbidden',
      'forbidden',
      'manual'
    );
    raise exception 'authenticated direct fact insert unexpectedly succeeded';
  exception when insufficient_privilege then null;
  end;

  if (
    select count(*) from public.public_profiles
     where id = '33333333-3333-4333-8333-333333333333'
  ) <> 1 then
    raise exception 'published public profile should be readable cross-user';
  end if;
end
$$;

reset role;

-- anon 只能读取安全发布表，不能读私密事实或执行写 RPC。
set local role anon;
do $$
begin
  if (
    select count(*) from public.public_profiles
     where id = '33333333-3333-4333-8333-333333333333'
  ) <> 1 then
    raise exception 'anon should read published public profile';
  end if;
  begin
    perform count(*) from public.profile_facts;
    raise exception 'anon fact read unexpectedly succeeded';
  exception when insufficient_privilege then null;
  end;
  begin
    perform * from public.delete_profile_dimension('skill', 7);
    raise exception 'anon profile RPC unexpectedly succeeded';
  exception when insufficient_privilege then null;
  end;
end
$$;

rollback;
