-- Finalize the personal profile model around authoritative atomic facts.
-- Compatibility projections (profiles.dims/profile_dimensions) are removed.
-- AI extraction writes proposals, never replaces confirmed facts directly.

alter table public.profiles
  add column if not exists permission_revision bigint not null default 0;

-- The previous implementation is replaced at the end of this migration.
-- Drop it before renaming/dropping tables it depends on.
drop function if exists public.merge_anonymous_user(uuid, uuid);

alter table public.profile_facts
  add column if not exists fact_kind text not null default 'self_description',
  add column if not exists normalized_value text,
  add column if not exists sensitivity text not null default 'low',
  add column if not exists valid_from timestamptz,
  add column if not exists valid_to timestamptz,
  add column if not exists support_count integer not null default 1,
  add column if not exists last_supported_at timestamptz not null default now();

update public.profile_facts
set normalized_value = lower(regexp_replace(btrim(value), '\s+', ' ', 'g'))
where normalized_value is null;

alter table public.profile_facts
  alter column normalized_value set not null,
  drop constraint if exists profile_facts_source_check,
  add constraint profile_facts_source_check
    check (source in (
      'manual', 'assessment', 'card_game', 'chat', 'diary',
      'lab', 'simulation', 'legacy'
    )),
  add constraint profile_facts_kind_check
    check (fact_kind in (
      'preference', 'capability', 'value', 'goal', 'constraint',
      'relationship_need', 'life_stage', 'self_description', 'pattern'
    )),
  add constraint profile_facts_sensitivity_check
    check (sensitivity in ('low', 'medium', 'high')),
  add constraint profile_facts_support_count_check
    check (support_count >= 1),
  add constraint profile_facts_valid_range_check
    check (valid_to is null or valid_from is null or valid_to >= valid_from);

create index if not exists idx_profile_facts_context
  on public.profile_facts(
    user_id,
    status,
    user_confirmed desc,
    confidence desc,
    last_supported_at desc
  );

create table if not exists public.profile_fact_evidence (
  id                uuid primary key default gen_random_uuid(),
  user_id           uuid not null references auth.users(id) on delete cascade,
  fact_id           uuid not null references public.profile_facts(id) on delete cascade,
  source_type       text not null,
  source_id         text not null,
  source_version    integer not null default 1,
  evidence_role     text not null default 'supports',
  confidence        numeric(3,2) not null default 1,
  observed_at       timestamptz not null default now(),
  created_at        timestamptz not null default now(),
  constraint profile_fact_evidence_source_check
    check (source_type in (
      'manual', 'assessment', 'card_game', 'conversation',
      'chat_message', 'diary_entry', 'lab', 'simulation', 'legacy'
    )),
  constraint profile_fact_evidence_role_check
    check (evidence_role in ('supports', 'contradicts', 'corrects')),
  constraint profile_fact_evidence_confidence_check
    check (confidence between 0 and 1),
  constraint profile_fact_evidence_source_version_check
    check (source_version >= 1),
  unique (fact_id, source_type, source_id, evidence_role)
);

create index if not exists idx_profile_fact_evidence_user_fact
  on public.profile_fact_evidence(user_id, fact_id);
create index if not exists idx_profile_fact_evidence_source
  on public.profile_fact_evidence(user_id, source_type, source_id);

create table if not exists public.memory_proposals (
  id                uuid primary key default gen_random_uuid(),
  user_id           uuid not null references auth.users(id) on delete cascade,
  operation         text not null default 'add',
  target_fact_id    uuid references public.profile_facts(id) on delete set null,
  dimension         text not null,
  fact_kind         text not null default 'self_description',
  value             text not null,
  normalized_value  text not null,
  source_type       text not null,
  source_id         text not null,
  source_version    integer not null default 1,
  confidence        numeric(3,2) not null,
  sensitivity       text not null default 'low',
  rationale_code    text not null default 'explicit_statement',
  status            text not null default 'pending',
  model_name        text,
  prompt_version    text,
  schema_version    integer not null default 1,
  dedupe_key        text not null,
  expires_at        timestamptz not null default (now() + interval '30 days'),
  created_at        timestamptz not null default now(),
  reviewed_at       timestamptz,
  constraint memory_proposals_operation_check
    check (operation in ('add', 'reinforce', 'supersede', 'ignore')),
  constraint memory_proposals_dimension_check
    check (dimension in (
      'personality', 'skill', 'like', 'love', 'family', 'social', 'life'
    )),
  constraint memory_proposals_kind_check
    check (fact_kind in (
      'preference', 'capability', 'value', 'goal', 'constraint',
      'relationship_need', 'life_stage', 'self_description', 'pattern'
    )),
  constraint memory_proposals_source_check
    check (source_type in ('chat', 'diary', 'lab', 'simulation')),
  constraint memory_proposals_confidence_check
    check (confidence between 0 and 1),
  constraint memory_proposals_sensitivity_check
    check (sensitivity in ('low', 'medium', 'high')),
  constraint memory_proposals_status_check
    check (status in ('pending', 'accepted', 'rejected', 'expired', 'applied')),
  constraint memory_proposals_source_version_check
    check (source_version >= 1),
  constraint memory_proposals_schema_version_check
    check (schema_version >= 1),
  unique (user_id, dedupe_key)
);

create index if not exists idx_memory_proposals_user_status
  on public.memory_proposals(user_id, status, created_at desc);
create index if not exists idx_memory_proposals_source
  on public.memory_proposals(user_id, source_type, source_id);

create table if not exists public.assessment_runs (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references auth.users(id) on delete cascade,
  assessment_kind text not null,
  schema_version  integer not null default 1,
  answers         jsonb not null default '[]',
  scores          jsonb not null default '{}',
  result_tags     text[] not null default '{}',
  completed_at    timestamptz not null default now(),
  created_at      timestamptz not null default now(),
  constraint assessment_runs_kind_length
    check (char_length(assessment_kind) between 1 and 50),
  constraint assessment_runs_answers_array
    check (jsonb_typeof(answers) = 'array'),
  constraint assessment_runs_scores_object
    check (jsonb_typeof(scores) = 'object'),
  constraint assessment_runs_schema_version_check
    check (schema_version >= 1)
);

create index if not exists idx_assessment_runs_user
  on public.assessment_runs(user_id, completed_at desc);

-- Normalize dimension x purpose permissions so concurrent cell updates cannot
-- silently replace an unrelated device's whole JSON document.
alter table public.profile_ai_permissions
  rename to profile_ai_permissions_legacy;

create table public.profile_ai_permissions (
  user_id    uuid not null references auth.users(id) on delete cascade,
  dimension  text not null,
  purpose    text not null,
  allowed    boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, dimension, purpose),
  constraint profile_ai_permissions_dimension_check
    check (dimension in (
      'personality', 'skill', 'like', 'love', 'family', 'social', 'life'
    )),
  constraint profile_ai_permissions_purpose_check
    check (purpose in ('persona', 'chat', 'match', 'lab', 'community'))
);

insert into public.profile_ai_permissions (
  user_id,
  dimension,
  purpose,
  allowed,
  created_at,
  updated_at
)
select
  legacy.user_id,
  dimension.key,
  purpose.key,
  (purpose.value)::boolean,
  legacy.created_at,
  legacy.updated_at
from public.profile_ai_permissions_legacy legacy
cross join lateral jsonb_each(legacy.permissions) dimension
cross join lateral jsonb_each(dimension.value) purpose
where dimension.key in (
    'personality', 'skill', 'like', 'love', 'family', 'social', 'life'
  )
  and purpose.key in ('persona', 'chat', 'match', 'lab', 'community')
  and jsonb_typeof(purpose.value) = 'boolean'
on conflict (user_id, dimension, purpose) do update
set
  allowed = excluded.allowed,
  updated_at = greatest(
    public.profile_ai_permissions.updated_at,
    excluded.updated_at
  );

drop table public.profile_ai_permissions_legacy;

drop trigger if exists trg_profile_ai_permissions_touch
  on public.profile_ai_permissions;
create trigger trg_profile_ai_permissions_touch
  before update on public.profile_ai_permissions
  for each row execute function public.touch_updated_at();

-- Keep complete editable profile material private. Only a deliberately
-- published, low-risk subset is copied into the public table.
alter table public.public_profiles rename to profile_public_drafts;

drop policy if exists "Public profiles are readable"
  on public.profile_public_drafts;
drop policy if exists "Users manage own public profile"
  on public.profile_public_drafts;
create policy "Users read own profile draft"
  on public.profile_public_drafts
  for select
  to authenticated
  using ((select auth.uid()) = id);

revoke all on table public.profile_public_drafts from anon, authenticated;
grant select on table public.profile_public_drafts to authenticated;
grant all privileges on table public.profile_public_drafts to service_role;

create table public.public_profiles (
  id              uuid primary key references auth.users(id) on delete cascade,
  name            text not null default '',
  avatar_url      text,
  quote           text not null default '',
  bio             text not null default '',
  tags            text[] not null default '{}',
  hue             smallint not null default 4 check (hue between 0 and 4),
  published_facts jsonb not null default '{}'
    check (jsonb_typeof(published_facts) = 'object'),
  published_at    timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

alter table public.public_profiles enable row level security;
create policy "Published profiles are readable"
  on public.public_profiles
  for select
  to anon, authenticated
  using (true);

grant select on table public.public_profiles to anon, authenticated;
grant all privileges on table public.public_profiles to service_role;

create trigger trg_public_profiles_touch
  before update on public.public_profiles
  for each row execute function public.touch_updated_at();

insert into public.public_profiles (
  id,
  name,
  avatar_url,
  quote,
  bio,
  tags,
  hue,
  published_facts,
  published_at,
  updated_at
)
select
  draft.id,
  draft.name,
  draft.avatar_url,
  draft.quote,
  draft.bio,
  draft.tags,
  draft.hue,
  coalesce((
    select jsonb_object_agg(grouped.dimension, grouped.values)
    from (
      select
        fact.dimension,
        jsonb_agg(fact.value order by fact.updated_at desc) as values
      from public.profile_facts fact
      where fact.user_id = draft.id
        and fact.status = 'active'
        and coalesce((draft.visibility ->> fact.dimension)::boolean, false)
      group by fact.dimension
    ) grouped
  ), '{}'::jsonb),
  draft.updated_at,
  draft.updated_at
from public.profile_public_drafts draft
on conflict (id) do nothing;

-- The old functions depend on profiles.dims/profile_dimensions and must be
-- replaced before those projections can be dropped.
drop function if exists public.replace_profile_dimension(
  text, text[], text, text, numeric, boolean, integer, bigint
);
drop function if exists public.delete_profile_dimension(text, bigint);
drop function if exists public.clear_private_profile(bigint);
drop function if exists public.confirm_profile_fact(uuid, bigint);
drop function if exists public.apply_profile_update(jsonb, integer);

drop table public.profile_dimensions;
alter table public.profiles drop column dims;

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
                and coalesce(
                  (draft.visibility ->> fact.dimension)::boolean,
                  false
                )
              group by fact.dimension
             ) grouped
         ), '{}'::jsonb),
         published_at = now()
    from public.profile_public_drafts draft
   where published.id = p_user_id
     and draft.id = p_user_id;
$$;
revoke all on function private.refresh_public_profile_facts(uuid)
  from public, anon, authenticated;

create or replace function private.replace_profile_dimension_for_user(
  p_user_id uuid,
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
  portrait_pct smallint
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := p_user_id;
  v_revision bigint;
  v_values text[];
  v_value text;
  v_fact_id uuid;
begin
  if v_user_id is null then
    raise exception using errcode = '42501', message = 'authentication required';
  end if;
  if p_dimension not in (
    'personality', 'skill', 'like', 'love', 'family', 'social', 'life'
  ) then
    raise exception using errcode = '22023', message = 'invalid profile dimension';
  end if;
  if p_source not in ('manual', 'assessment', 'card_game') then
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
    raise exception using errcode = '22023',
      message = 'profile values must contain 1 to 20 items';
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
    raise exception using errcode = '40001',
      message = 'profile revision conflict';
  end if;

  -- Whole-dimension replacement is reserved for an explicit user action.
  update public.profile_facts
     set status = 'superseded',
         valid_to = coalesce(valid_to, now())
   where user_id = v_user_id
     and dimension = p_dimension
     and status = 'active'
     and not (value = any(v_values));

  foreach v_value in array v_values loop
    insert into public.profile_facts (
      user_id,
      dimension,
      value,
      normalized_value,
      source,
      source_ref,
      confidence,
      user_confirmed,
      status,
      observed_at,
      last_supported_at
    )
    values (
      v_user_id,
      p_dimension,
      v_value,
      lower(regexp_replace(btrim(v_value), '\s+', ' ', 'g')),
      p_source,
      p_source_ref,
      p_confidence,
      p_user_confirmed,
      'active',
      now(),
      now()
    )
    on conflict (user_id, dimension, value) do update
      set confidence = greatest(
            public.profile_facts.confidence,
            excluded.confidence
          ),
          user_confirmed =
            public.profile_facts.user_confirmed or excluded.user_confirmed,
          status = 'active',
          valid_to = null,
          support_count = public.profile_facts.support_count + 1,
          last_supported_at = now()
    returning id into v_fact_id;

    insert into public.profile_fact_evidence (
      user_id,
      fact_id,
      source_type,
      source_id,
      confidence
    )
    values (
      v_user_id,
      v_fact_id,
      p_source,
      coalesce(p_source_ref, 'profile:' || p_dimension),
      p_confidence
    )
    on conflict (fact_id, source_type, source_id, evidence_role) do update
      set confidence = greatest(
            public.profile_fact_evidence.confidence,
            excluded.confidence
          ),
          observed_at = now();
  end loop;

  update public.profiles p
     set portrait_pct = least(
           100,
           greatest(0, p.portrait_pct + coalesce(p_portrait_delta, 0))
         )::smallint,
         profile_revision = p.profile_revision + 1
   where p.id = v_user_id;

  perform private.refresh_public_profile_facts(v_user_id);

  return query
  select p.profile_revision, p.portrait_pct
    from public.profiles p
   where p.id = v_user_id;
end;
$$;

revoke all on function private.replace_profile_dimension_for_user(
  uuid, text, text[], text, text, numeric, boolean, integer, bigint
) from public, anon, authenticated;

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
  portrait_pct smallint
)
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
  if p_source <> 'manual'
     or p_confidence <> 1
     or not p_user_confirmed then
    raise exception using errcode = '22023',
      message = 'direct profile writes must be confirmed manual facts';
  end if;
  return query
  select result.profile_revision, result.portrait_pct
    from private.replace_profile_dimension_for_user(
      v_user_id,
      p_dimension,
      p_values,
      'manual',
      p_source_ref,
      1,
      true,
      p_portrait_delta,
      p_expected_revision
    ) result;
end;
$$;

create or replace function public.update_profile_progress(
  p_portrait_delta integer default 0
)
returns table (
  profile_revision bigint,
  portrait_pct smallint
)
language sql
security definer
set search_path = ''
as $$
  insert into public.profiles as p (id, portrait_pct)
  values (
    auth.uid(),
    least(100, greatest(0, coalesce(p_portrait_delta, 0)))::smallint
  )
  on conflict (id) do update
    set portrait_pct = least(
      100,
      greatest(0, p.portrait_pct + coalesce(p_portrait_delta, 0))
    )::smallint
  returning p.profile_revision, p.portrait_pct;
$$;

create or replace function public.confirm_profile_fact(
  p_fact_id uuid,
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
  update public.profile_facts
     set user_confirmed = true,
         confidence = 1,
         last_supported_at = now()
   where id = p_fact_id
     and user_id = v_user_id
     and status = 'active';
  if not found then
    raise exception using errcode = 'P0002', message = 'profile fact not found';
  end if;
  update public.profiles as p
     set profile_revision = p.profile_revision + 1
   where p.id = v_user_id;
  perform private.refresh_public_profile_facts(v_user_id);
  return query
  select p.profile_revision, p.portrait_pct
    from public.profiles p where p.id = v_user_id;
end;
$$;

create or replace function public.delete_profile_dimension(
  p_dimension text,
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
  if p_dimension not in (
    'personality', 'skill', 'like', 'love', 'family', 'social', 'life'
  ) then
    raise exception using errcode = '22023', message = 'invalid profile dimension';
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
  delete from public.memory_proposals
   where user_id = v_user_id and dimension = p_dimension;
  delete from public.profile_facts
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
  update public.profiles as p
     set profile_revision = p.profile_revision + 1
   where p.id = v_user_id;
  perform private.refresh_public_profile_facts(v_user_id);
  return query
  select p.profile_revision, p.portrait_pct
    from public.profiles p where p.id = v_user_id;
end;
$$;

create or replace function public.clear_private_profile(
  p_expected_revision bigint default null
)
returns table (
  profile_revision bigint,
  portrait_pct smallint,
  permission_revision bigint
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
  delete from public.profile_ai_permissions where user_id = v_user_id;
  update public.profiles as p
     set portrait_pct = 0,
         profile_revision = p.profile_revision + 1,
         permission_revision = p.permission_revision + 1
   where p.id = v_user_id;
  perform private.refresh_public_profile_facts(v_user_id);
  return query
  select p.profile_revision, p.portrait_pct, p.permission_revision
    from public.profiles p where p.id = v_user_id;
end;
$$;

create or replace function public.replace_profile_ai_permissions(
  p_permissions jsonb,
  p_expected_revision bigint default null
)
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_revision bigint;
  v_dimension record;
  v_purpose record;
begin
  if v_user_id is null then
    raise exception using errcode = '42501', message = 'authentication required';
  end if;
  if jsonb_typeof(coalesce(p_permissions, '{}'::jsonb)) <> 'object' then
    raise exception using errcode = '22023', message = 'permissions must be an object';
  end if;
  select p.permission_revision into v_revision
    from public.profiles p
   where p.id = v_user_id
   for update;
  if not found then
    raise exception using errcode = 'P0002', message = 'profile not found';
  end if;
  if p_expected_revision is not null and p_expected_revision <> v_revision then
    raise exception using errcode = '40001',
      message = 'permission revision conflict';
  end if;
  delete from public.profile_ai_permissions where user_id = v_user_id;
  for v_dimension in
    select key, value from jsonb_each(coalesce(p_permissions, '{}'::jsonb))
  loop
    if v_dimension.key not in (
      'personality', 'skill', 'like', 'love', 'family', 'social', 'life'
    ) or jsonb_typeof(v_dimension.value) <> 'object' then
      raise exception using errcode = '22023', message = 'invalid permission dimension';
    end if;
    for v_purpose in select key, value from jsonb_each(v_dimension.value)
    loop
      if v_purpose.key not in (
        'persona', 'chat', 'match', 'lab', 'community'
      ) or jsonb_typeof(v_purpose.value) <> 'boolean' then
        raise exception using errcode = '22023', message = 'invalid permission purpose';
      end if;
      insert into public.profile_ai_permissions (
        user_id, dimension, purpose, allowed
      )
      values (
        v_user_id,
        v_dimension.key,
        v_purpose.key,
        (v_purpose.value)::boolean
      );
    end loop;
  end loop;
  update public.profiles as p
     set permission_revision = p.permission_revision + 1
   where p.id = v_user_id
   returning p.permission_revision into v_revision;
  return v_revision;
end;
$$;

create or replace function public.propose_profile_fact(
  p_dimension text,
  p_value text,
  p_source_type text,
  p_source_id text,
  p_confidence numeric,
  p_fact_kind text default 'self_description',
  p_sensitivity text default 'low',
  p_source_version integer default 1,
  p_model_name text default null,
  p_prompt_version text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_normalized text;
  v_dedupe_key text;
  v_id uuid;
begin
  if v_user_id is null then
    raise exception using errcode = '42501', message = 'authentication required';
  end if;
  if p_dimension not in (
    'personality', 'skill', 'like', 'love', 'family', 'social', 'life'
  ) then
    raise exception using errcode = '22023', message = 'invalid profile dimension';
  end if;
  if p_source_type not in ('chat', 'diary', 'lab', 'simulation') then
    raise exception using errcode = '22023', message = 'invalid proposal source';
  end if;
  if p_fact_kind not in (
    'preference', 'capability', 'value', 'goal', 'constraint',
    'relationship_need', 'life_stage', 'self_description', 'pattern'
  ) then
    raise exception using errcode = '22023', message = 'invalid fact kind';
  end if;
  if p_sensitivity not in ('low', 'medium', 'high') then
    raise exception using errcode = '22023', message = 'invalid sensitivity';
  end if;
  if p_confidence < 0 or p_confidence > 1 then
    raise exception using errcode = '22023', message = 'invalid confidence';
  end if;
  if p_source_version < 1 then
    raise exception using errcode = '22023', message = 'invalid source version';
  end if;
  if char_length(btrim(p_value)) not between 1 and 500
     or char_length(p_source_id) not between 1 and 100 then
    raise exception using errcode = '22023', message = 'invalid proposal value';
  end if;

  v_normalized := lower(regexp_replace(btrim(p_value), '\s+', ' ', 'g'));
  v_dedupe_key := encode(extensions.digest(
    p_source_type || ':' || p_source_id || ':' || p_source_version::text ||
    ':' || p_dimension || ':' || v_normalized,
    'sha256'
  ), 'hex');

  insert into public.memory_proposals (
    user_id,
    dimension,
    fact_kind,
    value,
    normalized_value,
    source_type,
    source_id,
    source_version,
    confidence,
    sensitivity,
    model_name,
    prompt_version,
    dedupe_key
  )
  values (
    v_user_id,
    p_dimension,
    p_fact_kind,
    btrim(p_value),
    v_normalized,
    p_source_type,
    p_source_id,
    p_source_version,
    p_confidence,
    p_sensitivity,
    p_model_name,
    p_prompt_version,
    v_dedupe_key
  )
  on conflict (user_id, dedupe_key) do update
    set confidence = greatest(
          public.memory_proposals.confidence,
          excluded.confidence
        ),
        model_name = coalesce(excluded.model_name, public.memory_proposals.model_name),
        prompt_version = coalesce(
          excluded.prompt_version,
          public.memory_proposals.prompt_version
        )
  returning id into v_id;
  return v_id;
end;
$$;

create or replace function public.review_profile_proposal(
  p_proposal_id uuid,
  p_accept boolean,
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
  v_proposal public.memory_proposals%rowtype;
  v_fact_id uuid;
  v_evidence_source text;
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
  select * into v_proposal
    from public.memory_proposals
   where id = p_proposal_id
     and user_id = v_user_id
     and status = 'pending'
     and expires_at > now()
   for update;
  if not found then
    raise exception using errcode = 'P0002', message = 'profile proposal not found';
  end if;

  if not p_accept then
    update public.memory_proposals
       set status = 'rejected', reviewed_at = now()
     where id = p_proposal_id;
    return query
    select p.profile_revision, p.portrait_pct
      from public.profiles p where p.id = v_user_id;
    return;
  end if;

  insert into public.profile_facts (
    user_id,
    dimension,
    fact_kind,
    value,
    normalized_value,
    source,
    source_ref,
    confidence,
    user_confirmed,
    status,
    sensitivity,
    observed_at,
    last_supported_at
  )
  values (
    v_user_id,
    v_proposal.dimension,
    v_proposal.fact_kind,
    v_proposal.value,
    v_proposal.normalized_value,
    v_proposal.source_type,
    v_proposal.source_id,
    1,
    true,
    'active',
    v_proposal.sensitivity,
    now(),
    now()
  )
  on conflict (user_id, dimension, value) do update
    set user_confirmed = true,
        confidence = 1,
        status = 'active',
        valid_to = null,
        support_count = public.profile_facts.support_count + 1,
        last_supported_at = now()
  returning id into v_fact_id;

  v_evidence_source := case v_proposal.source_type
    when 'chat' then 'conversation'
    when 'diary' then 'diary_entry'
    else v_proposal.source_type
  end;
  insert into public.profile_fact_evidence (
    user_id,
    fact_id,
    source_type,
    source_id,
    source_version,
    confidence
  )
  values (
    v_user_id,
    v_fact_id,
    v_evidence_source,
    v_proposal.source_id,
    v_proposal.source_version,
    v_proposal.confidence
  )
  on conflict (fact_id, source_type, source_id, evidence_role) do update
    set confidence = greatest(
          public.profile_fact_evidence.confidence,
          excluded.confidence
        ),
        observed_at = now();

  update public.memory_proposals
     set status = 'applied', reviewed_at = now(), target_fact_id = v_fact_id
   where id = p_proposal_id;
  update public.profiles as p
     set profile_revision = p.profile_revision + 1
   where p.id = v_user_id;
  perform private.refresh_public_profile_facts(v_user_id);

  return query
  select p.profile_revision, p.portrait_pct
    from public.profiles p where p.id = v_user_id;
end;
$$;

create or replace function public.save_card_game_and_profile(
  p_kind text,
  p_final_cards jsonb,
  p_rounds integer,
  p_accepted jsonb,
  p_traded jsonb,
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
  v_values text[];
  v_dimension text;
begin
  if v_user_id is null then
    raise exception using errcode = '42501', message = 'authentication required';
  end if;
  if p_kind not in ('life', 'marriage', 'family', 'social') then
    raise exception using errcode = '22023', message = 'invalid card game kind';
  end if;
  insert into public.card_game_results (
    user_id, kind, final_cards, rounds, accepted, traded
  )
  values (
    v_user_id,
    p_kind,
    p_final_cards,
    p_rounds,
    coalesce(p_accepted, '[]'::jsonb),
    coalesce(p_traded, '[]'::jsonb)
  )
  on conflict (user_id, kind) do update
    set final_cards = excluded.final_cards,
        rounds = excluded.rounds,
        accepted = excluded.accepted,
        traded = excluded.traded;
  select array_agg(card ->> 'name' order by ordinality)
    into v_values
    from jsonb_array_elements(p_final_cards)
      with ordinality as cards(card, ordinality)
   where nullif(btrim(card ->> 'name'), '') is not null;
  v_dimension := case when p_kind = 'marriage' then 'love' else p_kind end;
  return query
  select *
    from private.replace_profile_dimension_for_user(
      v_user_id,
      v_dimension,
      v_values,
      'card_game',
      p_kind,
      1,
      true,
      3,
      p_expected_revision
    );
end;
$$;

create or replace function public.save_assessment_and_profile(
  p_dimension text,
  p_values text[],
  p_assessment_kind text,
  p_answers jsonb default '[]'::jsonb,
  p_scores jsonb default '{}'::jsonb,
  p_schema_version integer default 1,
  p_expected_revision bigint default null
)
returns table (
  profile_revision bigint,
  portrait_pct smallint,
  assessment_run_id uuid
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_run_id uuid;
begin
  if v_user_id is null then
    raise exception using errcode = '42501', message = 'authentication required';
  end if;
  if char_length(btrim(p_assessment_kind)) not between 1 and 50
     or jsonb_typeof(p_answers) <> 'array'
     or jsonb_typeof(p_scores) <> 'object'
     or p_schema_version < 1 then
    raise exception using errcode = '22023', message = 'invalid assessment result';
  end if;
  insert into public.assessment_runs (
    user_id,
    assessment_kind,
    schema_version,
    answers,
    scores,
    result_tags
  )
  values (
    v_user_id,
    btrim(p_assessment_kind),
    p_schema_version,
    p_answers,
    p_scores,
    p_values
  )
  returning id into v_run_id;

  return query
  select result.profile_revision, result.portrait_pct, v_run_id
    from private.replace_profile_dimension_for_user(
      v_user_id,
      p_dimension,
      p_values,
      'assessment',
      v_run_id::text,
      1,
      true,
      2,
      p_expected_revision
    ) result;
end;
$$;

create or replace function public.save_public_profile(
  p_profile jsonb
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_visibility jsonb := coalesce(p_profile -> 'visibility', '{}'::jsonb);
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
     or jsonb_typeof(coalesce(p_profile -> 'advice', '[]'::jsonb)) <> 'array'
     or jsonb_typeof(v_visibility) <> 'object' then
    raise exception using errcode = '22023', message = 'invalid public profile';
  end if;
  if exists (
    select 1
      from jsonb_each(v_visibility) visibility_entry
     where visibility_entry.key not in (
       'personality', 'skill', 'like', 'love', 'family', 'social', 'life'
     )
        or jsonb_typeof(visibility_entry.value) <> 'boolean'
  ) then
    raise exception using errcode = '22023',
      message = 'invalid public profile visibility';
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
    services, advice, visibility, hue, age, city, from_role, to_role,
    stage, result, story_intro, story_full
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
    v_visibility,
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
        visibility = excluded.visibility,
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
    id, name, avatar_url, quote, bio, tags, hue, published_facts, published_at
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
      select jsonb_object_agg(grouped.dimension, grouped.values)
      from (
        select
          fact.dimension,
          jsonb_agg(fact.value order by fact.updated_at desc) as values
        from public.profile_facts fact
        where fact.user_id = v_user_id
          and fact.status = 'active'
          and coalesce((v_visibility ->> fact.dimension)::boolean, false)
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
        published_facts = excluded.published_facts,
        published_at = excluded.published_at;
end;
$$;

-- Clients may read their own facts/proposals/evidence/runs but all writes go
-- through the controlled functions above or a service-role worker.
alter table public.profile_fact_evidence enable row level security;
alter table public.memory_proposals enable row level security;
alter table public.assessment_runs enable row level security;
alter table public.profile_ai_permissions enable row level security;

create policy "Users read own profile evidence"
  on public.profile_fact_evidence for select to authenticated
  using ((select auth.uid()) = user_id);
create policy "Users read own memory proposals"
  on public.memory_proposals for select to authenticated
  using ((select auth.uid()) = user_id);
create policy "Users read own assessment runs"
  on public.assessment_runs for select to authenticated
  using ((select auth.uid()) = user_id);
create policy "Users read own AI permissions"
  on public.profile_ai_permissions for select to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists "Users insert own profile facts" on public.profile_facts;
drop policy if exists "Users update own profile facts" on public.profile_facts;
drop policy if exists "Users delete own profile facts" on public.profile_facts;

revoke all on table public.profile_facts from anon, authenticated;
grant select on table public.profile_facts to authenticated;
revoke all on table public.profile_fact_evidence from anon, authenticated;
grant select on table public.profile_fact_evidence to authenticated;
revoke all on table public.memory_proposals from anon, authenticated;
grant select on table public.memory_proposals to authenticated;
revoke all on table public.assessment_runs from anon, authenticated;
grant select on table public.assessment_runs to authenticated;
revoke all on table public.profile_ai_permissions from anon, authenticated;
grant select on table public.profile_ai_permissions to authenticated;

grant all privileges on table
  public.profile_facts,
  public.profile_fact_evidence,
  public.memory_proposals,
  public.assessment_runs,
  public.profile_ai_permissions
to service_role;

revoke all on function public.replace_profile_dimension(
  text, text[], text, text, numeric, boolean, integer, bigint
) from public, anon;
revoke all on function public.update_profile_progress(integer)
  from public, anon;
revoke all on function public.confirm_profile_fact(uuid, bigint)
  from public, anon;
revoke all on function public.delete_profile_dimension(text, bigint)
  from public, anon;
revoke all on function public.clear_private_profile(bigint)
  from public, anon;
revoke all on function public.replace_profile_ai_permissions(jsonb, bigint)
  from public, anon;
revoke all on function public.propose_profile_fact(
  text, text, text, text, numeric, text, text, integer, text, text
) from public, anon;
revoke all on function public.review_profile_proposal(uuid, boolean, bigint)
  from public, anon;
revoke all on function public.save_card_game_and_profile(
  text, jsonb, integer, jsonb, jsonb, bigint
) from public, anon;
revoke all on function public.save_assessment_and_profile(
  text, text[], text, jsonb, jsonb, integer, bigint
) from public, anon;
revoke all on function public.save_public_profile(jsonb)
  from public, anon;

grant execute on function public.replace_profile_dimension(
  text, text[], text, text, numeric, boolean, integer, bigint
) to authenticated;
grant execute on function public.update_profile_progress(integer)
  to authenticated;
grant execute on function public.confirm_profile_fact(uuid, bigint)
  to authenticated;
grant execute on function public.delete_profile_dimension(text, bigint)
  to authenticated;
grant execute on function public.clear_private_profile(bigint)
  to authenticated;
grant execute on function public.replace_profile_ai_permissions(jsonb, bigint)
  to authenticated;
grant execute on function public.propose_profile_fact(
  text, text, text, text, numeric, text, text, integer, text, text
) to authenticated;
grant execute on function public.review_profile_proposal(uuid, boolean, bigint)
  to authenticated;
grant execute on function public.save_card_game_and_profile(
  text, jsonb, integer, jsonb, jsonb, bigint
) to authenticated;
grant execute on function public.save_assessment_and_profile(
  text, text[], text, jsonb, jsonb, integer, bigint
) to authenticated;
grant execute on function public.save_public_profile(jsonb)
  to authenticated;

-- Rebuild anonymous-account merge for the final tables, including diary v2.
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
         permission_revision =
           greatest(n.permission_revision, o.permission_revision) + 1
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

  delete from public.profile_ai_permissions old_row
   where old_row.user_id = p_old
     and exists (
       select 1 from public.profile_ai_permissions new_row
       where new_row.user_id = p_new
         and new_row.dimension = old_row.dimension
         and new_row.purpose = old_row.purpose
     );
  update public.profile_ai_permissions set user_id = p_new where user_id = p_old;

  -- Preserve evidence from an anonymous duplicate by moving it to the
  -- surviving fact before the duplicate fact is deleted.
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

  delete from public.diary_summaries old_summary
   where old_summary.user_id = p_old
     and exists (
       select 1 from public.diary_summaries new_summary
       where new_summary.user_id = p_new
         and new_summary.period_type = old_summary.period_type
         and new_summary.period_start = old_summary.period_start
     );
  update public.diary_summaries set user_id = p_new where user_id = p_old;

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

  delete from public.profiles where id = p_old;
end;
$$;

revoke all on function public.merge_anonymous_user(uuid, uuid)
  from public, anon, authenticated;
grant execute on function public.merge_anonymous_user(uuid, uuid)
  to service_role;
