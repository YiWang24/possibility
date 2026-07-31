-- Published card catalogs are immutable content-addressed contracts.
-- New versions are inserted as drafts and promoted atomically by the
-- service-role-only RPC below.

alter table public.card_game_catalog_versions
  add constraint card_game_catalog_published_is_current
  check (status <> 'published' or is_current);

create or replace function private.guard_card_game_catalog_version()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    if new.status <> 'draft' or new.is_current then
      raise exception using errcode = '22023',
        message = 'new card catalog versions must start as drafts';
    end if;
    return new;
  end if;

  if tg_op = 'DELETE' then
    if old.status in ('published', 'archived') then
      raise exception using errcode = '22023',
        message = 'published card catalog versions cannot be deleted';
    end if;
    return old;
  end if;

  if old.status in ('published', 'archived')
     and (
       new.game_id,
       new.version,
       new.catalog_schema_version,
       new.engine_key,
       new.analysis_key,
       new.catalog,
       new.content_hash,
       new.created_by,
       new.created_at,
       new.published_at
     ) is distinct from (
       old.game_id,
       old.version,
       old.catalog_schema_version,
       old.engine_key,
       old.analysis_key,
       old.catalog,
       old.content_hash,
       old.created_by,
       old.created_at,
       old.published_at
     ) then
    raise exception using errcode = '22023',
      message = 'published card catalog content is immutable';
  end if;

  if old.status = 'archived' and new.status <> 'archived' then
    raise exception using errcode = '22023',
      message = 'archived card catalog versions cannot be republished';
  end if;
  if old.status = 'published'
     and new.status not in ('published', 'archived') then
    raise exception using errcode = '22023',
      message = 'published card catalog versions can only be archived';
  end if;
  return new;
end;
$$;

create trigger trg_card_game_catalog_version_guard
before insert or update or delete on public.card_game_catalog_versions
for each row execute function private.guard_card_game_catalog_version();

create or replace function public.publish_card_game_catalog_v1(
  p_game_key text,
  p_version integer
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_game public.card_games;
  v_version public.card_game_catalog_versions;
  v_hash text;
begin
  select *
    into v_game
    from public.card_games
   where game_key = p_game_key
     and status in ('active', 'hidden')
   for update;
  if not found then
    raise exception using errcode = 'P0002', message = 'card game not found';
  end if;

  select *
    into v_version
    from public.card_game_catalog_versions
   where game_id = v_game.id
     and version = p_version
   for update;
  if not found then
    raise exception using errcode = 'P0002',
      message = 'card catalog version not found';
  end if;
  if v_version.status <> 'draft' then
    raise exception using errcode = '22023',
      message = 'only draft card catalog versions can be published';
  end if;

  v_hash := encode(
    extensions.digest(convert_to(v_version.catalog::text, 'UTF8'), 'sha256'),
    'hex'
  );

  update public.card_game_catalog_versions
     set status = 'archived',
         is_current = false
   where game_id = v_game.id
     and status = 'published';

  update public.card_game_catalog_versions
     set status = 'published',
         is_current = true,
         content_hash = v_hash,
         published_at = now()
   where id = v_version.id
   returning * into v_version;

  return to_jsonb(v_version);
end;
$$;

revoke all on function public.publish_card_game_catalog_v1(text, integer)
  from public, anon, authenticated;
grant execute on function public.publish_card_game_catalog_v1(text, integer)
  to service_role;
