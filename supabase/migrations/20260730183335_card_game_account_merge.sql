-- The account merge contract already writes app_event_user_aliases. Attach
-- card-game v2 ownership migration to that stable event instead of copying the
-- large merge_anonymous_user function again.

create or replace function public.clear_profile(
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
    raise exception using errcode = '40001',
      message = 'profile revision conflict';
  end if;

  delete from public.memory_proposals where user_id = v_user_id;
  delete from public.profile_facts where user_id = v_user_id;
  delete from public.assessment_runs where user_id = v_user_id;
  delete from public.card_game_results where user_id = v_user_id;
  delete from public.card_game_runs where user_id = v_user_id;
  delete from public.card_game_sessions where user_id = v_user_id;
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

create or replace function private.merge_card_game_user_alias()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_source uuid;
begin
  v_source := case
    when tg_op = 'UPDATE' and old.new_user_id <> new.new_user_id
      then old.new_user_id
    else new.old_user_id
  end;

  update public.card_game_sessions
     set user_id = new.new_user_id
   where user_id = v_source;
  update public.card_game_runs
     set user_id = new.new_user_id
   where user_id = v_source;
  return new;
end;
$$;

create trigger trg_card_game_user_alias
after insert or update of new_user_id on public.app_event_user_aliases
for each row execute function private.merge_card_game_user_alias();

-- Reconcile aliases that might already exist when this migration is deployed.
update public.card_game_sessions session
   set user_id = alias.new_user_id
  from public.app_event_user_aliases alias
 where session.user_id = alias.old_user_id;

update public.card_game_runs run
   set user_id = alias.new_user_id
  from public.app_event_user_aliases alias
 where run.user_id = alias.old_user_id;
