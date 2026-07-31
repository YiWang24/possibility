\set ON_ERROR_STOP on

-- Versioned card catalog, service-only mutations, historical runs, and RLS.
-- Run through: npm run db:test

begin;

insert into auth.users (id, role, created_at, updated_at)
values
  ('55555555-5555-4555-8555-555555555555', 'authenticated', now(), now()),
  ('66666666-6666-4666-8666-666666666666', 'authenticated', now(), now());

set local role anon;
do $$
begin
  if (select count(*) from public.card_games) <> 4 then
    raise exception 'anon should read four published card games';
  end if;
  if (select count(*) from public.card_game_catalog_versions) <> 4 then
    raise exception 'anon should read four published catalog versions';
  end if;
  if (
    select count(*)
      from public.card_game_catalog_versions
     where jsonb_array_length(catalog -> 'cards') = 18
  ) <> 4 then
    raise exception 'each seeded catalog should contain 18 cards';
  end if;
end
$$;

reset role;

select set_config(
  'request.jwt.claim.sub',
  '55555555-5555-4555-8555-555555555555',
  true
);
set local role authenticated;

do $$
begin
  begin
    perform public.create_card_game_session_v2(
      '55555555-5555-4555-8555-555555555555',
      '77777777-7777-4777-8777-777777777777',
      '88888888-8888-4888-8888-888888888888',
      'life',
      1,
      42
    );
    raise exception 'authenticated client called service-only session RPC';
  exception when insufficient_privilege then null;
  end;

  begin
    insert into public.card_game_sessions (
      id,
      user_id,
      game_id,
      game_version_id,
      client_session_id,
      seed
    )
    select
      '77777777-7777-4777-8777-777777777777',
      '55555555-5555-4555-8555-555555555555',
      game.id,
      version.id,
      '88888888-8888-4888-8888-888888888888',
      42
      from public.card_games game
      join public.card_game_catalog_versions version
        on version.game_id = game.id
     where game.game_key = 'life' and version.version = 1;
    raise exception 'authenticated client directly inserted a session';
  exception when insufficient_privilege then null;
  end;
end
$$;
reset role;

set local role service_role;

insert into public.card_game_catalog_versions (
  game_id,
  version,
  catalog_schema_version,
  engine_key,
  analysis_key,
  status,
  is_current,
  catalog
)
select
  game_id,
  2,
  catalog_schema_version,
  engine_key,
  analysis_key,
  'draft',
  false,
  catalog
from public.card_game_catalog_versions
where version = 1
  and game_id = (select id from public.card_games where game_key = 'life');

do $$
begin
  perform public.publish_card_game_catalog_v1('life', 2);
end
$$;

do $$
begin
  if (
    select version.status = 'published'
       and version.is_current
       and version.content_hash ~ '^[a-f0-9]{64}$'
      from public.card_game_catalog_versions version
      join public.card_games game on game.id = version.game_id
     where game.game_key = 'life' and version.version = 2
  ) is not true then
    raise exception 'publish RPC should atomically promote and hash a draft';
  end if;
  if (
    select version.status = 'archived' and not version.is_current
      from public.card_game_catalog_versions version
      join public.card_games game on game.id = version.game_id
     where game.game_key = 'life' and version.version = 1
  ) is not true then
    raise exception 'publish RPC should archive the previous current version';
  end if;

  begin
    update public.card_game_catalog_versions
       set catalog = jsonb_set(catalog, '{game,title}', '"tampered"')
     where version = 2
       and game_id = (select id from public.card_games where game_key = 'life');
    raise exception 'published catalog content was mutated';
  exception when invalid_parameter_value then null;
  end;

  begin
    delete from public.card_game_catalog_versions
     where version = 2
       and game_id = (select id from public.card_games where game_key = 'life');
    raise exception 'published catalog was deleted';
  exception when invalid_parameter_value then null;
  end;
end
$$;

select public.create_card_game_session_v2(
  '55555555-5555-4555-8555-555555555555',
  '77777777-7777-4777-8777-777777777777',
  '88888888-8888-4888-8888-888888888888',
  'life',
  1,
  42
);

select public.sync_card_game_session_v2(
  '55555555-5555-4555-8555-555555555555',
  '77777777-7777-4777-8777-777777777777',
  0,
  '[
    {
      "sequence": 1,
      "action_type": "confirm_selection",
      "card_keys": ["family","friend","lover","confidence","kindness","talent","iq","trust","forgive"],
      "pressure_before": 1,
      "pressure_after": 1
    },
    {
      "sequence": 2,
      "action_type": "draw_scenario",
      "scenario_key": "early_life_02",
      "pressure_before": 1,
      "pressure_after": 1
    },
    {
      "sequence": 3,
      "action_type": "trade_cards",
      "scenario_key": "early_life_02",
      "card_keys": ["trust","forgive"],
      "reason_cannot_accept": "无法接受家庭冲突",
      "reason_abandon": "可以重新建立",
      "decision_source": "voluntary_reject",
      "pressure_before": 1,
      "pressure_after": 1
    },
    {
      "sequence": 4,
      "action_type": "draw_scenario",
      "scenario_key": "adult_life_02",
      "pressure_before": 1,
      "pressure_after": 1
    },
    {
      "sequence": 5,
      "action_type": "trade_cards",
      "scenario_key": "adult_life_02",
      "card_keys": ["talent","iq"],
      "decision_source": "voluntary_reject",
      "pressure_before": 1,
      "pressure_after": 1
    },
    {
      "sequence": 6,
      "action_type": "draw_scenario",
      "scenario_key": "later_life_02",
      "pressure_before": 1,
      "pressure_after": 1
    },
    {
      "sequence": 7,
      "action_type": "trade_cards",
      "scenario_key": "later_life_02",
      "card_keys": ["confidence","kindness"],
      "decision_source": "voluntary_reject",
      "pressure_before": 1,
      "pressure_after": 1
    }
  ]'::jsonb,
  '{
    "phase": "result",
    "selected_card_keys": ["family","friend","lover","confidence","kindness","talent","iq","trust","forgive"],
    "held_card_keys": ["family","friend","lover"],
    "seen_scenario_keys": ["early_life_02","adult_life_02","later_life_02"],
    "current_scenario_key": null,
    "round_count": 3,
    "accept_count": 0,
    "trade_count": 3,
    "pressure": 1
  }'::jsonb
);

select public.complete_card_game_session_v2(
  '55555555-5555-4555-8555-555555555555',
  '77777777-7777-4777-8777-777777777777',
  1,
  '{
    "analysis_schema_version": 1,
    "initial_card_keys": ["family","friend","lover","confidence","kindness","talent","iq","trust","forgive"],
    "final_card_keys": ["family","friend","lover"],
    "discarded_card_keys": ["confidence","kindness","talent","iq","trust","forgive"],
    "metrics": {"round_count":3,"accept_count":0,"trade_count":3},
    "ai_snapshot": {
      "schema_version":1,
      "signals":[{"key":"relationship","score":0.8,"confidence":0.8}]
    },
    "display_snapshot": {"schema_version":1,"title":"掌舵型"},
    "legacy_final_cards": [
      {"id":"family","name":"亲情","glyph":"⌂","group":"关系"},
      {"id":"friend","name":"知心挚友","glyph":"☍","group":"关系"},
      {"id":"lover","name":"相濡以沫的恋人","glyph":"♡","group":"关系"}
    ],
    "legacy_accepted": [],
    "legacy_traded": []
  }'::jsonb
);

do $$
begin
  if (
    select status = 'completed' and completed_at is not null
      from public.card_game_sessions
     where id = '77777777-7777-4777-8777-777777777777'
  ) is not true then
    raise exception 'completion should atomically finish the session';
  end if;
  if (select count(*) from public.card_game_actions) <> 7 then
    raise exception 'all actions should be preserved';
  end if;
  if (
    select count(*)
      from public.card_game_actions
     where action_type = 'trade_cards'
       and decision_source = 'voluntary_reject'
  ) <> 3 then
    raise exception 'trade decision provenance should be preserved';
  end if;
  if exists (
    select 1
      from public.card_game_actions
     where action_type <> 'trade_cards'
       and decision_source is not null
  ) then
    raise exception 'non-trade actions should not have decision provenance';
  end if;
  begin
    insert into public.card_game_actions (
      session_id,
      sequence,
      action_type,
      card_keys,
      decision_source
    ) values (
      '77777777-7777-4777-8777-777777777777',
      8,
      'trade_cards',
      array['family', 'friend'],
      null
    );
    raise exception 'trade action without provenance should be rejected';
  exception when check_violation then
    null;
  end;
  if (select count(*) from public.card_game_runs) <> 1 then
    raise exception 'completion should create one historical run';
  end if;
  if (
    select final_card_keys = array['family','friend','lover']
      from public.card_game_runs
     where session_id = '77777777-7777-4777-8777-777777777777'
  ) is not true then
    raise exception 'run should preserve stable final card keys';
  end if;
  if (
    select count(*) from public.profile_facts
     where user_id = '55555555-5555-4555-8555-555555555555'
       and source = 'card_game'
       and dimension = 'life'
       and value in ('亲情', '知心挚友', '相濡以沫的恋人')
  ) <> 3 then
    raise exception 'explicit final cards should refresh profile facts';
  end if;
end
$$;
reset role;

select set_config(
  'request.jwt.claim.sub',
  '55555555-5555-4555-8555-555555555555',
  true
);
set local role authenticated;
do $$
begin
  if (select count(*) from public.card_game_sessions) <> 1
     or (select count(*) from public.card_game_actions) <> 7
     or (select count(*) from public.card_game_runs) <> 1 then
    raise exception 'owner should read own full card history';
  end if;
end
$$;
reset role;

select set_config(
  'request.jwt.claim.sub',
  '66666666-6666-4666-8666-666666666666',
  true
);
set local role authenticated;
do $$
begin
  if exists (select 1 from public.card_game_sessions)
     or exists (select 1 from public.card_game_actions)
     or exists (select 1 from public.card_game_runs) then
    raise exception 'another user read private card history';
  end if;
end
$$;

reset role;
set local role service_role;
insert into public.app_event_user_aliases (old_user_id, new_user_id)
values (
  '55555555-5555-4555-8555-555555555555',
  '66666666-6666-4666-8666-666666666666'
);
do $$
begin
  if (
    select count(*)
      from public.card_game_sessions
     where user_id = '66666666-6666-4666-8666-666666666666'
  ) <> 1 or (
    select count(*)
      from public.card_game_runs
     where user_id = '66666666-6666-4666-8666-666666666666'
  ) <> 1 then
    raise exception 'account alias should migrate v2 card sessions and runs';
  end if;
end
$$;
reset role;

select set_config(
  'request.jwt.claim.sub',
  '66666666-6666-4666-8666-666666666666',
  true
);
set local role authenticated;
select * from public.clear_profile(null);
reset role;
set local role service_role;
do $$
begin
  if exists (select 1 from public.card_game_sessions)
     or exists (select 1 from public.card_game_actions)
     or exists (select 1 from public.card_game_runs) then
    raise exception 'clear_profile should purge card-game v2 private history';
  end if;
end
$$;
reset role;

rollback;
