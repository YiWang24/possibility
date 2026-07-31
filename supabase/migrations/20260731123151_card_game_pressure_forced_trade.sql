-- Preserve whether a trade expressed the player's own boundary or was forced
-- by the pressure cap. Historical trades predate the cap and remain voluntary.
alter table public.card_game_actions
  add column decision_source text;

update public.card_game_actions
   set decision_source = 'voluntary_reject'
 where action_type = 'trade_cards';

alter table public.card_game_actions
  add constraint card_game_actions_decision_source_check
  check (
    (action_type = 'trade_cards' and decision_source is not null and decision_source in (
      'voluntary_reject',
      'pressure_forced'
    ))
    or (action_type <> 'trade_cards' and decision_source is null)
  );

-- Keep action persistence atomic with the session state update while including
-- the new canonical decision source produced by the Edge validation layer.
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
      decision_source,
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
      nullif(v_action ->> 'decision_source', ''),
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

revoke all on function public.sync_card_game_session_v2(
  uuid, uuid, integer, jsonb, jsonb
) from public, anon, authenticated;

grant execute on function public.sync_card_game_session_v2(
  uuid, uuid, integer, jsonb, jsonb
) to service_role;
