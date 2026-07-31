-- Privacy operations for diary audio retention and account deletion.

alter table public.diary_entries
  add column if not exists audio_deleted_at timestamptz;

create or replace function public.purge_diary_jobs(p_user_id uuid)
returns bigint
language plpgsql
security definer
set search_path = pg_catalog, public, pgmq
as $$
declare
  v_deleted bigint;
begin
  delete from pgmq.q_diary_jobs
  where message ->> 'user_id' = p_user_id::text;
  get diagnostics v_deleted = row_count;
  return v_deleted;
end;
$$;

revoke all on function public.purge_diary_jobs(uuid)
  from public, anon, authenticated;
grant execute on function public.purge_diary_jobs(uuid) to service_role;
