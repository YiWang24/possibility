-- Durable diary processing queue, summary invalidation, and realtime status.

create extension if not exists pgmq;

do $$
begin
  if not exists (
    select 1 from pgmq.meta where queue_name = 'diary_jobs'
  ) then
    perform pgmq.create('diary_jobs');
  end if;
end
$$;

alter table public.diary_entries
  drop constraint if exists diary_entries_audio_bytes_check,
  add constraint diary_entries_audio_bytes_check
    check (audio_bytes is null or audio_bytes between 0 and 20971520),
  drop constraint if exists diary_entries_duration_ms_check,
  add constraint diary_entries_duration_ms_check
    check (duration_ms is null or duration_ms between 0 and 600000);

alter table public.diary_summaries
  drop constraint if exists diary_summaries_status_check,
  add constraint diary_summaries_status_check
    check (status in ('pending', 'generating', 'ready', 'stale', 'failed'));

-- Queue wrappers are callable only with the server-side service role. Keeping
-- pgmq itself out of the exposed API prevents clients from reading task data.
create or replace function public.enqueue_diary_job(
  p_job_key text,
  p_task_type text,
  p_user_id uuid,
  p_entry_id uuid default null,
  p_period_start date default null,
  p_delay_seconds integer default 0
)
returns bigint
language plpgsql
security definer
set search_path = pg_catalog, public, pgmq
as $$
declare
  v_msg_id bigint;
begin
  if p_task_type not in (
    'transcribe_entry',
    'analyze_entry',
    'generate_day_summary',
    'generate_month_summary',
    'generate_year_summary'
  ) then
    raise exception 'unsupported diary task type';
  end if;
  if p_job_key is null or length(p_job_key) < 3 or length(p_job_key) > 240 then
    raise exception 'invalid diary job key';
  end if;
  if p_delay_seconds < 0 or p_delay_seconds > 86400 then
    raise exception 'invalid diary job delay';
  end if;

  if exists (
    select 1
    from pgmq.q_diary_jobs
    where message ->> 'job_key' = p_job_key
  ) then
    return null;
  end if;

  select send
  into v_msg_id
  from pgmq.send(
    'diary_jobs',
    jsonb_build_object(
      'job_key', p_job_key,
      'task_type', p_task_type,
      'user_id', p_user_id,
      'entry_id', p_entry_id,
      'period_start', p_period_start
    ),
    p_delay_seconds
  );
  return v_msg_id;
end;
$$;

create or replace function public.read_diary_jobs(
  p_visibility_seconds integer default 180,
  p_quantity integer default 1
)
returns table (
  msg_id bigint,
  read_ct bigint,
  enqueued_at timestamptz,
  vt timestamptz,
  message jsonb
)
language sql
security definer
set search_path = pg_catalog, public, pgmq
as $$
  select
    item.msg_id,
    item.read_ct,
    item.enqueued_at,
    item.vt,
    item.message
  from pgmq.read(
    'diary_jobs',
    greatest(30, least(p_visibility_seconds, 900)),
    greatest(1, least(p_quantity, 5))
  ) as item;
$$;

create or replace function public.delete_diary_job(p_message_id bigint)
returns boolean
language sql
security definer
set search_path = pg_catalog, public, pgmq
as $$
  select pgmq.delete('diary_jobs', p_message_id);
$$;

revoke all on function public.enqueue_diary_job(
  text, text, uuid, uuid, date, integer
) from public, anon, authenticated;
revoke all on function public.read_diary_jobs(integer, integer)
  from public, anon, authenticated;
revoke all on function public.delete_diary_job(bigint)
  from public, anon, authenticated;
grant execute on function public.enqueue_diary_job(
  text, text, uuid, uuid, date, integer
) to service_role;
grant execute on function public.read_diary_jobs(integer, integer)
  to service_role;
grant execute on function public.delete_diary_job(bigint)
  to service_role;

create schema if not exists private;

create or replace function private.invalidate_diary_summaries()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_user_id uuid := coalesce(new.user_id, old.user_id);
  v_local_date date := coalesce(new.local_date, old.local_date);
begin
  update public.diary_summaries
  set status = 'stale', updated_at = now()
  where user_id = v_user_id
    and status = 'ready'
    and (
      (period_type = 'day' and period_start = v_local_date)
      or (
        period_type = 'month'
        and period_start = date_trunc('month', v_local_date)::date
      )
      or (
        period_type = 'year'
        and period_start = date_trunc('year', v_local_date)::date
      )
    );
  return coalesce(new, old);
end;
$$;

revoke all on function private.invalidate_diary_summaries() from public;

drop trigger if exists trg_diary_entries_invalidate_summaries
  on public.diary_entries;
create trigger trg_diary_entries_invalidate_summaries
after insert or delete or update of status, content_version, transcript,
  transcript_raw, transcript_edited, entry_summary, emotions, keywords,
  deleted_at
on public.diary_entries
for each row execute function private.invalidate_diary_summaries();

do $$
begin
  if not exists (
    select 1
    from pg_catalog.pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'diary_entries'
  ) then
    alter publication supabase_realtime add table public.diary_entries;
  end if;
  if not exists (
    select 1
    from pg_catalog.pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'diary_summaries'
  ) then
    alter publication supabase_realtime add table public.diary_summaries;
  end if;
end
$$;
