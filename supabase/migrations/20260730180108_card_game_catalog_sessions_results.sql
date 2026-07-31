-- Versioned, server-authored card-game catalogs and verifiable game runs.
--
-- Design constraints:
--   * Published catalog versions are immutable application contracts.
--   * Clients may cache/read catalogs but never mutate game history directly.
--   * Edge Functions validate the state machine, then call the service-role-only
--     RPCs below so action insertion + state/result updates are atomic.
--   * The legacy card_game_results table remains a latest-result projection
--     during the client migration.

create table public.card_games (
  id uuid primary key default gen_random_uuid(),
  game_key text not null unique
    check (game_key ~ '^[a-z][a-z0-9_]{0,63}$'),
  status text not null default 'active'
    check (status in ('active', 'hidden', 'retired')),
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.card_game_catalog_versions (
  id uuid primary key default gen_random_uuid(),
  game_id uuid not null references public.card_games(id) on delete cascade,
  version integer not null check (version > 0),
  catalog_schema_version smallint not null default 1
    check (catalog_schema_version > 0),
  engine_key text not null default 'trade_down_v1'
    check (engine_key ~ '^[a-z][a-z0-9_]{0,63}$'),
  analysis_key text not null default 'signal_aggregation_v1'
    check (analysis_key ~ '^[a-z][a-z0-9_]{0,63}$'),
  status text not null default 'draft'
    check (status in ('draft', 'published', 'archived')),
  is_current boolean not null default false,
  catalog jsonb not null
    check (jsonb_typeof(catalog) = 'object'),
  content_hash text
    check (content_hash is null or content_hash ~ '^[a-f0-9]{64}$'),
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  published_at timestamptz,
  unique (game_id, version),
  unique (id, game_id),
  check (not is_current or status = 'published'),
  check (
    status = 'draft'
    or (published_at is not null and content_hash is not null)
  )
);

create unique index card_game_catalog_one_current
  on public.card_game_catalog_versions (game_id)
  where is_current;
create index card_game_catalog_versions_lookup
  on public.card_game_catalog_versions (game_id, status, version desc);

create table public.card_game_sessions (
  id uuid primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  game_id uuid not null references public.card_games(id),
  game_version_id uuid not null,
  client_session_id uuid not null,
  status text not null default 'in_progress'
    check (status in ('in_progress', 'completed', 'abandoned', 'invalid')),
  phase text not null default 'select'
    check (phase in ('select', 'draw', 'decision', 'trade', 'result')),
  seed bigint not null,
  state_version integer not null default 0 check (state_version >= 0),
  last_action_seq integer not null default 0 check (last_action_seq >= 0),
  selected_card_keys text[] not null default '{}',
  held_card_keys text[] not null default '{}',
  seen_scenario_keys text[] not null default '{}',
  current_scenario_key text,
  round_count integer not null default 0 check (round_count >= 0),
  accept_count integer not null default 0 check (accept_count >= 0),
  trade_count integer not null default 0 check (trade_count >= 0),
  pressure integer not null default 1 check (pressure > 0),
  started_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  completed_at timestamptz,
  unique (user_id, client_session_id),
  foreign key (game_version_id, game_id)
    references public.card_game_catalog_versions(id, game_id)
);

create index card_game_sessions_user_updated
  on public.card_game_sessions (user_id, updated_at desc);
create index card_game_sessions_game
  on public.card_game_sessions (game_id, game_version_id);

create table public.card_game_actions (
  id bigint generated always as identity primary key,
  session_id uuid not null
    references public.card_game_sessions(id) on delete cascade,
  sequence integer not null check (sequence > 0),
  action_type text not null
    check (action_type in (
      'confirm_selection',
      'draw_scenario',
      'accept_scenario',
      'trade_cards'
    )),
  scenario_key text,
  card_keys text[] not null default '{}',
  reason_cannot_accept text
    check (reason_cannot_accept is null or char_length(reason_cannot_accept) <= 500),
  reason_abandon text
    check (reason_abandon is null or char_length(reason_abandon) <= 500),
  pressure_before integer check (pressure_before is null or pressure_before > 0),
  pressure_after integer check (pressure_after is null or pressure_after > 0),
  created_at timestamptz not null default now(),
  unique (session_id, sequence)
);

create table public.card_game_runs (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null unique
    references public.card_game_sessions(id),
  user_id uuid not null references auth.users(id) on delete cascade,
  game_id uuid not null references public.card_games(id),
  game_version_id uuid not null,
  initial_card_keys text[] not null,
  final_card_keys text[] not null,
  discarded_card_keys text[] not null,
  analysis_key text not null,
  analysis_schema_version smallint not null
    check (analysis_schema_version > 0),
  metrics jsonb not null
    check (jsonb_typeof(metrics) = 'object'),
  ai_snapshot jsonb not null
    check (jsonb_typeof(ai_snapshot) = 'object'),
  display_snapshot jsonb not null
    check (jsonb_typeof(display_snapshot) = 'object'),
  completed_at timestamptz not null default now(),
  foreign key (game_version_id, game_id)
    references public.card_game_catalog_versions(id, game_id)
);

create index card_game_actions_session
  on public.card_game_actions (session_id, sequence);
create index card_game_runs_user_game_time
  on public.card_game_runs (user_id, game_id, completed_at desc);
create index card_game_runs_version
  on public.card_game_runs (game_version_id);

create trigger trg_card_games_touch
before update on public.card_games
for each row execute function public.touch_updated_at();

create trigger trg_card_game_sessions_touch
before update on public.card_game_sessions
for each row execute function public.touch_updated_at();

alter table public.card_games enable row level security;
alter table public.card_game_catalog_versions enable row level security;
alter table public.card_game_sessions enable row level security;
alter table public.card_game_actions enable row level security;
alter table public.card_game_runs enable row level security;

create policy "Published card games are readable"
on public.card_games for select
to anon, authenticated
using (status in ('active', 'retired'));

create policy "Published card catalogs are readable"
on public.card_game_catalog_versions for select
to anon, authenticated
using (status in ('published', 'archived'));

create policy "Users read own card sessions"
on public.card_game_sessions for select
to authenticated
using ((select auth.uid()) = user_id);

create policy "Users read own card actions"
on public.card_game_actions for select
to authenticated
using (
  exists (
    select 1
    from public.card_game_sessions s
    where s.id = card_game_actions.session_id
      and s.user_id = (select auth.uid())
  )
);

create policy "Users read own card runs"
on public.card_game_runs for select
to authenticated
using ((select auth.uid()) = user_id);

grant select on public.card_games, public.card_game_catalog_versions
  to anon, authenticated;
grant select on public.card_game_sessions, public.card_game_actions,
  public.card_game_runs to authenticated;
grant select, insert, update, delete on public.card_games,
  public.card_game_catalog_versions, public.card_game_sessions,
  public.card_game_actions, public.card_game_runs to service_role;
grant usage, select on sequence public.card_game_actions_id_seq to service_role;

-- Creates an offline-capable session with a client-generated UUID. Repeating the
-- request with the same client_session_id is idempotent.
create or replace function public.create_card_game_session_v2(
  p_user_id uuid,
  p_session_id uuid,
  p_client_session_id uuid,
  p_game_key text,
  p_catalog_version integer,
  p_seed bigint
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_game public.card_games;
  v_version public.card_game_catalog_versions;
  v_session public.card_game_sessions;
  v_initial_pressure integer;
begin
  if p_user_id is null then
    raise exception using errcode = '22023', message = 'user_id is required';
  end if;

  select *
    into v_game
    from public.card_games
   where game_key = p_game_key
     and status = 'active';
  if not found then
    raise exception using errcode = '22023', message = 'unknown card game';
  end if;

  select *
    into v_version
    from public.card_game_catalog_versions
   where game_id = v_game.id
     and version = p_catalog_version
     and status in ('published', 'archived');
  if not found then
    raise exception using errcode = '22023', message = 'unknown catalog version';
  end if;

  v_initial_pressure :=
    coalesce((v_version.catalog #>> '{rules,pressure,initial}')::integer, 1);

  insert into public.card_game_sessions (
    id, user_id, game_id, game_version_id, client_session_id, seed, pressure
  )
  values (
    p_session_id, p_user_id, v_game.id, v_version.id,
    p_client_session_id, p_seed, v_initial_pressure
  )
  on conflict (user_id, client_session_id) do nothing;

  select *
    into v_session
    from public.card_game_sessions
   where user_id = p_user_id
     and client_session_id = p_client_session_id;

  if v_session.game_id <> v_game.id
     or v_session.game_version_id <> v_version.id then
    raise exception using errcode = '23505',
      message = 'client_session_id belongs to another catalog';
  end if;

  return to_jsonb(v_session);
end;
$$;

-- Persists a batch of already server-validated actions and its resulting
-- authoritative state under an optimistic state_version lock.
create or replace function public.sync_card_game_session_v2(
  p_user_id uuid,
  p_session_id uuid,
  p_expected_state_version integer,
  p_actions jsonb,
  p_state jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_session public.card_game_sessions;
  v_action jsonb;
  v_sequence integer;
  v_next_sequence integer;
begin
  if jsonb_typeof(p_actions) <> 'array'
     or jsonb_typeof(p_state) <> 'object' then
    raise exception using errcode = '22023', message = 'invalid sync payload';
  end if;

  select *
    into v_session
    from public.card_game_sessions
   where id = p_session_id
     and user_id = p_user_id
   for update;
  if not found then
    raise exception using errcode = 'P0002', message = 'card session not found';
  end if;
  if v_session.status <> 'in_progress' then
    raise exception using errcode = '22023', message = 'card session is not active';
  end if;
  if v_session.state_version <> p_expected_state_version then
    raise exception using errcode = '40001', message = 'card session version conflict';
  end if;

  v_next_sequence := v_session.last_action_seq + 1;
  for v_action in select value from jsonb_array_elements(p_actions)
  loop
    v_sequence := (v_action ->> 'sequence')::integer;
    if v_sequence <> v_next_sequence then
      raise exception using errcode = '22023', message = 'non-contiguous action sequence';
    end if;

    insert into public.card_game_actions (
      session_id,
      sequence,
      action_type,
      scenario_key,
      card_keys,
      reason_cannot_accept,
      reason_abandon,
      pressure_before,
      pressure_after,
      created_at
    )
    values (
      p_session_id,
      v_sequence,
      v_action ->> 'action_type',
      nullif(v_action ->> 'scenario_key', ''),
      coalesce(
        array(
          select jsonb_array_elements_text(
            coalesce(v_action -> 'card_keys', '[]'::jsonb)
          )
        ),
        '{}'::text[]
      ),
      nullif(btrim(v_action ->> 'reason_cannot_accept'), ''),
      nullif(btrim(v_action ->> 'reason_abandon'), ''),
      nullif(v_action ->> 'pressure_before', '')::integer,
      nullif(v_action ->> 'pressure_after', '')::integer,
      coalesce((v_action ->> 'created_at')::timestamptz, now())
    );
    v_next_sequence := v_next_sequence + 1;
  end loop;

  update public.card_game_sessions
     set phase = p_state ->> 'phase',
         state_version = state_version + 1,
         last_action_seq = v_next_sequence - 1,
         selected_card_keys = array(
           select jsonb_array_elements_text(
             coalesce(p_state -> 'selected_card_keys', '[]'::jsonb)
           )
         ),
         held_card_keys = array(
           select jsonb_array_elements_text(
             coalesce(p_state -> 'held_card_keys', '[]'::jsonb)
           )
         ),
         seen_scenario_keys = array(
           select jsonb_array_elements_text(
             coalesce(p_state -> 'seen_scenario_keys', '[]'::jsonb)
           )
         ),
         current_scenario_key =
           nullif(p_state ->> 'current_scenario_key', ''),
         round_count = (p_state ->> 'round_count')::integer,
         accept_count = (p_state ->> 'accept_count')::integer,
         trade_count = (p_state ->> 'trade_count')::integer,
         pressure = (p_state ->> 'pressure')::integer
   where id = p_session_id
   returning * into v_session;

  return to_jsonb(v_session);
end;
$$;

-- Finalizes a validated session, records an immutable historical run, updates
-- the legacy latest-result projection, and refreshes explicit profile facts in
-- one database transaction.
create or replace function public.complete_card_game_session_v2(
  p_user_id uuid,
  p_session_id uuid,
  p_expected_state_version integer,
  p_run jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_session public.card_game_sessions;
  v_game public.card_games;
  v_version public.card_game_catalog_versions;
  v_run public.card_game_runs;
  v_initial text[];
  v_final text[];
  v_discarded text[];
  v_values text[];
  v_dimension text;
  v_profile_revision bigint := 0;
  v_portrait_pct smallint := 0;
begin
  if jsonb_typeof(p_run) <> 'object' then
    raise exception using errcode = '22023', message = 'invalid run payload';
  end if;

  select *
    into v_session
    from public.card_game_sessions
   where id = p_session_id
     and user_id = p_user_id
   for update;
  if not found then
    raise exception using errcode = 'P0002', message = 'card session not found';
  end if;

  if v_session.status = 'completed' then
    select * into v_run
      from public.card_game_runs
     where session_id = p_session_id;
    return jsonb_build_object(
      'run', to_jsonb(v_run),
      'profile_revision', null,
      'portrait_pct', null
    );
  end if;
  if v_session.status <> 'in_progress'
     or v_session.state_version <> p_expected_state_version then
    raise exception using errcode = '40001', message = 'card session version conflict';
  end if;

  select * into v_game from public.card_games where id = v_session.game_id;
  select * into v_version
    from public.card_game_catalog_versions
   where id = v_session.game_version_id;

  v_initial := array(
    select jsonb_array_elements_text(p_run -> 'initial_card_keys')
  );
  v_final := array(
    select jsonb_array_elements_text(p_run -> 'final_card_keys')
  );
  v_discarded := array(
    select jsonb_array_elements_text(p_run -> 'discarded_card_keys')
  );

  if v_initial <> v_session.selected_card_keys
     or v_final <> v_session.held_card_keys
     or v_session.phase <> 'result' then
    raise exception using errcode = '22023',
      message = 'run does not match authoritative session';
  end if;

  insert into public.card_game_runs (
    session_id,
    user_id,
    game_id,
    game_version_id,
    initial_card_keys,
    final_card_keys,
    discarded_card_keys,
    analysis_key,
    analysis_schema_version,
    metrics,
    ai_snapshot,
    display_snapshot
  )
  values (
    v_session.id,
    p_user_id,
    v_session.game_id,
    v_session.game_version_id,
    v_initial,
    v_final,
    v_discarded,
    v_version.analysis_key,
    coalesce((p_run ->> 'analysis_schema_version')::smallint, 1),
    p_run -> 'metrics',
    p_run -> 'ai_snapshot',
    p_run -> 'display_snapshot'
  )
  returning * into v_run;

  update public.card_game_sessions
     set status = 'completed',
         completed_at = v_run.completed_at
   where id = v_session.id;

  -- Keep old clients and get-profile consumers working while they migrate.
  if v_game.game_key in ('life', 'marriage', 'family', 'social') then
    insert into public.card_game_results (
      user_id, kind, final_cards, rounds, accepted, traded
    )
    values (
      p_user_id,
      v_game.game_key,
      coalesce(p_run -> 'legacy_final_cards', '[]'::jsonb),
      v_session.round_count,
      coalesce(p_run -> 'legacy_accepted', '[]'::jsonb),
      coalesce(p_run -> 'legacy_traded', '[]'::jsonb)
    )
    on conflict (user_id, kind) do update
      set final_cards = excluded.final_cards,
          rounds = excluded.rounds,
          accepted = excluded.accepted,
          traded = excluded.traded;
  end if;

  select array_agg(card ->> 'name' order by ordinality)
    into v_values
    from jsonb_array_elements(
      coalesce(p_run -> 'legacy_final_cards', '[]'::jsonb)
    ) with ordinality as cards(card, ordinality)
   where nullif(btrim(card ->> 'name'), '') is not null;

  v_dimension := nullif(v_version.catalog #>> '{game,profile_dimension}', '');
  if v_dimension is not null and coalesce(cardinality(v_values), 0) > 0 then
    select result.profile_revision, result.portrait_pct
      into v_profile_revision, v_portrait_pct
      from private.replace_profile_dimension_for_user(
        p_user_id,
        v_dimension,
        v_values,
        'card_game',
        v_run.id::text,
        1,
        true,
        3,
        null
      ) as result;
  end if;

  return jsonb_build_object(
    'run', to_jsonb(v_run),
    'profile_revision', v_profile_revision,
    'portrait_pct', v_portrait_pct
  );
end;
$$;

revoke all on function public.create_card_game_session_v2(
  uuid, uuid, uuid, text, integer, bigint
) from public, anon, authenticated;
revoke all on function public.sync_card_game_session_v2(
  uuid, uuid, integer, jsonb, jsonb
) from public, anon, authenticated;
revoke all on function public.complete_card_game_session_v2(
  uuid, uuid, integer, jsonb
) from public, anon, authenticated;

grant execute on function public.create_card_game_session_v2(
  uuid, uuid, uuid, text, integer, bigint
) to service_role;
grant execute on function public.sync_card_game_session_v2(
  uuid, uuid, integer, jsonb, jsonb
) to service_role;
grant execute on function public.complete_card_game_session_v2(
  uuid, uuid, integer, jsonb
) to service_role;
