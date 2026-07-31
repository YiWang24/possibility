-- Diary-derived profile proposals are reviewable derivatives of a diary entry.
-- If the source text changes or the entry is deleted, stale pending proposals
-- must disappear immediately. Accepted facts remain user-owned profile data and
-- continue to be managed through the profile privacy controls.

create or replace function private.cleanup_diary_profile_proposals()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  delete from public.memory_proposals proposal
   where proposal.user_id = old.user_id
     and proposal.source_type = 'diary'
     and proposal.status = 'pending'
     and proposal.source_id in (old.id::text, old.entry_uuid::text);

  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

revoke all on function private.cleanup_diary_profile_proposals()
  from public, anon, authenticated, service_role;

drop trigger if exists trg_diary_entries_cleanup_profile_proposals
  on public.diary_entries;
create trigger trg_diary_entries_cleanup_profile_proposals
after update of content_version or delete
on public.diary_entries
for each row
execute function private.cleanup_diary_profile_proposals();
