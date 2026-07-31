-- Replace the dimension x purpose consent matrix with one fact-level boundary:
-- public facts may be published and reused across product surfaces; private
-- facts are available only while serving their owner.

alter table public.profile_facts
  add column visibility text not null default 'private';

alter table public.profiles
  add column verification_status text not null default 'unverified',
  add column verification_provider text,
  add column verified_at timestamptz,
  add constraint profiles_verification_status_check
    check (verification_status in ('unverified', 'pending', 'verified', 'rejected')),
  add constraint profiles_verification_provider_length
    check (
      verification_provider is null
      or char_length(verification_provider) between 1 and 50
    );

alter table public.public_profiles
  add column is_verified boolean not null default false;

-- Verification is provider-owned state. Clients may read their own status but
-- cannot self-assert it by directly updating profiles.
revoke all on table public.profiles from anon, authenticated;
grant select on table public.profiles to authenticated;
grant all privileges on table public.profiles to service_role;

alter table public.profile_facts
  add constraint profile_facts_visibility_check
    check (visibility in ('public', 'private'));

-- Preserve what users had deliberately published under the old dimension
-- switches. Everything else remains private.
update public.profile_facts fact
   set visibility = 'public'
  from public.profile_public_drafts draft
 where draft.id = fact.user_id
   and fact.status = 'active'
   and coalesce((draft.visibility ->> fact.dimension)::boolean, false);

create index idx_profile_facts_publication
  on public.profile_facts(user_id, dimension, updated_at desc)
  where status = 'active' and visibility = 'public';

drop function if exists public.replace_profile_ai_permissions(jsonb, bigint);
drop function if exists public.clear_private_profile(bigint);

create or replace function private.refresh_public_profile_facts(p_user_id uuid)
returns void
language sql
security definer
set search_path = ''
as $$
  update public.public_profiles published
     set published_facts = coalesce((
           select jsonb_object_agg(grouped.dimension, grouped.values)
             from (
               select
                 fact.dimension,
                 jsonb_agg(fact.value order by fact.updated_at desc) as values
               from public.profile_facts fact
              where fact.user_id = p_user_id
                and fact.status = 'active'
                and fact.visibility = 'public'
              group by fact.dimension
             ) grouped
         ), '{}'::jsonb),
         published_at = now()
   where published.id = p_user_id;
$$;
revoke all on function private.refresh_public_profile_facts(uuid)
  from public, anon, authenticated;

alter table public.profile_public_drafts drop column visibility;

create or replace function public.save_public_profile(p_profile jsonb)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
begin
  if v_user_id is null then
    raise exception using errcode = '42501', message = 'authentication required';
  end if;
  if p_profile is null
     or jsonb_typeof(p_profile) <> 'object'
     or octet_length(p_profile::text) > 100000
     or jsonb_typeof(coalesce(p_profile -> 'tags', '[]'::jsonb)) <> 'array'
     or jsonb_typeof(coalesce(p_profile -> 'trajectory', '[]'::jsonb)) <> 'array'
     or jsonb_typeof(coalesce(p_profile -> 'services', '[]'::jsonb)) <> 'array'
     or jsonb_typeof(coalesce(p_profile -> 'advice', '[]'::jsonb)) <> 'array' then
    raise exception using errcode = '22023', message = 'invalid public profile';
  end if;
  if (
    p_profile ? 'profile_version'
    and (
      jsonb_typeof(p_profile -> 'profile_version') <> 'number'
      or (p_profile ->> 'profile_version')::integer not between 1 and 2
    )
  ) or (
    p_profile ? 'hue'
    and (
      jsonb_typeof(p_profile -> 'hue') <> 'number'
      or (p_profile ->> 'hue')::integer not between 0 and 4
    )
  ) or (
    p_profile ? 'age'
    and p_profile -> 'age' <> 'null'::jsonb
    and (
      jsonb_typeof(p_profile -> 'age') <> 'number'
      or (p_profile ->> 'age')::integer not between 0 and 150
    )
  ) then
    raise exception using errcode = '22023',
      message = 'invalid public profile numeric field';
  end if;

  insert into public.profile_public_drafts (
    id, profile_version, name, avatar_url, quote, bio, tags, trajectory,
    services, advice, hue, age, city, from_role, to_role, stage, result,
    story_intro, story_full
  )
  values (
    v_user_id,
    coalesce((p_profile ->> 'profile_version')::smallint, 2),
    left(coalesce(p_profile ->> 'name', ''), 50),
    nullif(left(coalesce(p_profile ->> 'avatar_url', ''), 500), ''),
    left(coalesce(p_profile ->> 'quote', ''), 200),
    left(coalesce(p_profile ->> 'bio', ''), 200),
    coalesce(array(
      select value from jsonb_array_elements_text(
        coalesce(p_profile -> 'tags', '[]'::jsonb)
      ) with ordinality where ordinality <= 10
    ), '{}'::text[]),
    coalesce(p_profile -> 'trajectory', '[]'::jsonb),
    coalesce(p_profile -> 'services', '[]'::jsonb),
    coalesce(p_profile -> 'advice', '[]'::jsonb),
    coalesce((p_profile ->> 'hue')::smallint, 4),
    nullif(p_profile ->> 'age', '')::smallint,
    left(coalesce(p_profile ->> 'city', ''), 100),
    left(coalesce(p_profile ->> 'from_role', ''), 100),
    left(coalesce(p_profile ->> 'to_role', ''), 100),
    left(coalesce(p_profile ->> 'stage', ''), 100),
    left(coalesce(p_profile ->> 'result', ''), 200),
    left(coalesce(p_profile ->> 'story_intro', ''), 2000),
    left(coalesce(p_profile ->> 'story_full', ''), 12000)
  )
  on conflict (id) do update
    set profile_version = excluded.profile_version,
        name = excluded.name,
        avatar_url = excluded.avatar_url,
        quote = excluded.quote,
        bio = excluded.bio,
        tags = excluded.tags,
        trajectory = excluded.trajectory,
        services = excluded.services,
        advice = excluded.advice,
        hue = excluded.hue,
        age = excluded.age,
        city = excluded.city,
        from_role = excluded.from_role,
        to_role = excluded.to_role,
        stage = excluded.stage,
        result = excluded.result,
        story_intro = excluded.story_intro,
        story_full = excluded.story_full;

  insert into public.public_profiles (
    id, name, avatar_url, quote, bio, tags, hue, is_verified,
    published_facts, published_at
  )
  values (
    v_user_id,
    left(coalesce(p_profile ->> 'name', ''), 50),
    nullif(left(coalesce(p_profile ->> 'avatar_url', ''), 500), ''),
    left(coalesce(p_profile ->> 'quote', ''), 200),
    left(coalesce(p_profile ->> 'bio', ''), 200),
    coalesce(array(
      select value from jsonb_array_elements_text(
        coalesce(p_profile -> 'tags', '[]'::jsonb)
      ) with ordinality where ordinality <= 10
    ), '{}'::text[]),
    coalesce((p_profile ->> 'hue')::smallint, 4),
    coalesce((
      select p.verification_status = 'verified'
        from public.profiles p
       where p.id = v_user_id
    ), false),
    coalesce((
      select jsonb_object_agg(grouped.dimension, grouped.values)
      from (
        select
          fact.dimension,
          jsonb_agg(fact.value order by fact.updated_at desc) as values
        from public.profile_facts fact
        where fact.user_id = v_user_id
          and fact.status = 'active'
          and fact.visibility = 'public'
        group by fact.dimension
      ) grouped
    ), '{}'::jsonb),
    now()
  )
  on conflict (id) do update
    set name = excluded.name,
        avatar_url = excluded.avatar_url,
        quote = excluded.quote,
        bio = excluded.bio,
        tags = excluded.tags,
        hue = excluded.hue,
        is_verified = excluded.is_verified,
        published_facts = excluded.published_facts,
        published_at = excluded.published_at;
end;
$$;

-- Keep the public badge in sync when a trusted verification provider changes
-- the server-owned profile status.
create function private.sync_public_profile_verification()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.public_profiles
     set is_verified = new.verification_status = 'verified'
   where id = new.id;
  return new;
end;
$$;
revoke all on function private.sync_public_profile_verification()
  from public, anon, authenticated;

create trigger profiles_sync_public_verification
after update of verification_status on public.profiles
for each row
when (old.verification_status is distinct from new.verification_status)
execute function private.sync_public_profile_verification();

create or replace function public.set_profile_fact_visibility(
  p_fact_id uuid,
  p_visibility text,
  p_expected_revision bigint default null
)
returns table (
  profile_revision bigint,
  portrait_pct smallint
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_revision bigint;
begin
  if v_user_id is null then
    raise exception using errcode = '42501', message = 'authentication required';
  end if;
  if p_visibility not in ('public', 'private') then
    raise exception using errcode = '22023', message = 'invalid fact visibility';
  end if;

  select p.profile_revision into v_revision
    from public.profiles p
   where p.id = v_user_id
   for update;
  if not found then
    raise exception using errcode = 'P0002', message = 'profile not found';
  end if;
  if p_expected_revision is not null and p_expected_revision <> v_revision then
    raise exception using errcode = '40001', message = 'profile revision conflict';
  end if;

  update public.profile_facts
     set visibility = p_visibility
   where id = p_fact_id
     and user_id = v_user_id
     and status = 'active';
  if not found then
    raise exception using errcode = 'P0002', message = 'profile fact not found';
  end if;

  update public.profiles p
     set profile_revision = p.profile_revision + 1
   where p.id = v_user_id;
  perform private.refresh_public_profile_facts(v_user_id);

  return query
  select p.profile_revision, p.portrait_pct
    from public.profiles p
   where p.id = v_user_id;
end;
$$;

create function public.clear_profile(
  p_expected_revision bigint default null
)
returns table (
  profile_revision bigint,
  portrait_pct smallint
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_revision bigint;
begin
  if v_user_id is null then
    raise exception using errcode = '42501', message = 'authentication required';
  end if;
  select p.profile_revision into v_revision
    from public.profiles p
   where p.id = v_user_id
   for update;
  if not found then
    raise exception using errcode = 'P0002', message = 'profile not found';
  end if;
  if p_expected_revision is not null and p_expected_revision <> v_revision then
    raise exception using errcode = '40001', message = 'profile revision conflict';
  end if;
  delete from public.memory_proposals where user_id = v_user_id;
  delete from public.profile_facts where user_id = v_user_id;
  delete from public.assessment_runs where user_id = v_user_id;
  delete from public.card_game_results where user_id = v_user_id;
  delete from public.persona_jobs where user_id = v_user_id;
  update public.profiles p
     set portrait_pct = 0,
         profile_revision = p.profile_revision + 1
   where p.id = v_user_id;
  perform private.refresh_public_profile_facts(v_user_id);
  return query
  select p.profile_revision, p.portrait_pct
    from public.profiles p
   where p.id = v_user_id;
end;
$$;

-- Rebuild the account merge without the removed permission matrix. If the
-- anonymous and permanent accounts contain the same fact, public wins so a
-- previously published fact does not become private during the merge.
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
     set portrait_pct = greatest(n.portrait_pct, o.portrait_pct),
         profile_revision = greatest(n.profile_revision, o.profile_revision) + 1,
         verification_status = case
           when n.verification_status = 'verified'
             or o.verification_status = 'verified' then 'verified'
           when n.verification_status = 'pending'
             or o.verification_status = 'pending' then 'pending'
           when n.verification_status = 'rejected'
             or o.verification_status = 'rejected' then 'rejected'
           else 'unverified'
         end,
         verification_provider = case
           when n.verification_status = 'verified' then n.verification_provider
           when o.verification_status = 'verified' then o.verification_provider
           else coalesce(n.verification_provider, o.verification_provider)
         end,
         verified_at = case
           when n.verification_status = 'verified' then n.verified_at
           when o.verification_status = 'verified' then o.verified_at
           else null
         end
    from public.profiles o
   where n.id = p_new and o.id = p_old;

  update public.profile_public_drafts set id = p_new
   where id = p_old
     and not exists (
       select 1 from public.profile_public_drafts where id = p_new
     );
  delete from public.profile_public_drafts where id = p_old;
  update public.public_profiles set id = p_new
   where id = p_old
     and not exists (
       select 1 from public.public_profiles where id = p_new
     );
  delete from public.public_profiles where id = p_old;

  update public.profile_facts new_fact
     set visibility = 'public'
    from public.profile_facts old_fact
   where old_fact.user_id = p_old
     and new_fact.user_id = p_new
     and new_fact.dimension = old_fact.dimension
     and new_fact.value = old_fact.value
     and old_fact.visibility = 'public';

  delete from public.profile_fact_evidence old_evidence
   using public.profile_facts old_fact,
         public.profile_facts new_fact,
         public.profile_fact_evidence new_evidence
   where old_fact.user_id = p_old
     and new_fact.user_id = p_new
     and new_fact.dimension = old_fact.dimension
     and new_fact.value = old_fact.value
     and old_evidence.fact_id = old_fact.id
     and new_evidence.fact_id = new_fact.id
     and new_evidence.source_type = old_evidence.source_type
     and new_evidence.source_id = old_evidence.source_id
     and new_evidence.evidence_role = old_evidence.evidence_role;
  update public.profile_fact_evidence old_evidence
     set fact_id = new_fact.id,
         user_id = p_new
    from public.profile_facts old_fact,
         public.profile_facts new_fact
   where old_fact.user_id = p_old
     and new_fact.user_id = p_new
     and new_fact.dimension = old_fact.dimension
     and new_fact.value = old_fact.value
     and old_evidence.fact_id = old_fact.id;
  delete from public.profile_facts old_fact
   where old_fact.user_id = p_old
     and exists (
       select 1 from public.profile_facts new_fact
       where new_fact.user_id = p_new
         and new_fact.dimension = old_fact.dimension
         and new_fact.value = old_fact.value
     );
  update public.profile_facts set user_id = p_new where user_id = p_old;
  update public.profile_fact_evidence set user_id = p_new where user_id = p_old;
  delete from public.memory_proposals old_proposal
   where old_proposal.user_id = p_old
     and exists (
       select 1 from public.memory_proposals new_proposal
       where new_proposal.user_id = p_new
         and new_proposal.dedupe_key = old_proposal.dedupe_key
     );
  update public.memory_proposals set user_id = p_new where user_id = p_old;
  update public.assessment_runs set user_id = p_new where user_id = p_old;

  update public.conversations set user_id = p_new where user_id = p_old;
  update public.diary_entries set user_id = p_new where user_id = p_old;
  update public.simulations set user_id = p_new where user_id = p_old;
  update public.bounties set user_id = p_new where user_id = p_old;
  update public.kaleidoscope_draws set user_id = p_new where user_id = p_old;
  update public.persona_jobs set user_id = p_new where user_id = p_old;
  update public.match_results set user_id = p_new where user_id = p_old;
  update public.lab_choice_sets set user_id = p_new where user_id = p_old;

  delete from public.unlocks old_unlock
   where old_unlock.user_id = p_old
     and exists (
       select 1 from public.unlocks new_unlock
       where new_unlock.user_id = p_new
         and new_unlock.kind = old_unlock.kind
         and new_unlock.target_id = old_unlock.target_id
     );
  update public.unlocks set user_id = p_new where user_id = p_old;

  delete from public.card_game_results old_card
   where old_card.user_id = p_old
     and exists (
       select 1 from public.card_game_results new_card
       where new_card.user_id = p_new and new_card.kind = old_card.kind
     );
  update public.card_game_results set user_id = p_new where user_id = p_old;

  delete from public.bounty_responses old_response
   where old_response.user_id = p_old
     and exists (
       select 1 from public.bounty_responses new_response
       where new_response.user_id = p_new
         and new_response.bounty_id = old_response.bounty_id
     );
  update public.bounty_responses set user_id = p_new where user_id = p_old;

  delete from public.diary_summary_cache old_cache
   where old_cache.user_id = p_old
     and exists (
       select 1 from public.diary_summary_cache new_cache
       where new_cache.user_id = p_new
         and new_cache.period = old_cache.period
         and new_cache.ref = old_cache.ref
     );
  update public.diary_summary_cache set user_id = p_new where user_id = p_old;

  update public.app_event_user_aliases
     set new_user_id = p_new where new_user_id = p_old;
  insert into public.app_event_user_aliases (old_user_id, new_user_id)
  values (p_old, p_new)
  on conflict (old_user_id) do update
    set new_user_id = excluded.new_user_id,
        created_at = now();
  update public.app_events set user_id = p_new where user_id = p_old;

  perform private.refresh_public_profile_facts(p_new);
  delete from public.profiles where id = p_old;
end;
$$;

drop table public.profile_ai_permissions;
alter table public.profiles drop column permission_revision;

select private.refresh_public_profile_facts(id)
  from public.public_profiles;

revoke all on function public.set_profile_fact_visibility(uuid, text, bigint)
  from public, anon;
grant execute on function public.set_profile_fact_visibility(uuid, text, bigint)
  to authenticated;
revoke all on function public.clear_profile(bigint)
  from public, anon;
grant execute on function public.clear_profile(bigint)
  to authenticated;
revoke all on function public.save_public_profile(jsonb)
  from public, anon;
grant execute on function public.save_public_profile(jsonb)
  to authenticated;
revoke all on function public.merge_anonymous_user(uuid, uuid)
  from public, anon, authenticated;
grant execute on function public.merge_anonymous_user(uuid, uuid)
  to service_role;
