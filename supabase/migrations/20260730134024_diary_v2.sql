-- diary v2: real audio entries, same-day multi-entry support, and versioned summaries.
-- Additive migration: keep the legacy bigint primary key and transcript column so
-- existing native clients remain compatible while Web moves to entry_uuid.

alter table public.diary_entries
  add column if not exists entry_uuid uuid not null default gen_random_uuid(),
  add column if not exists source text not null default 'text',
  add column if not exists status text not null default 'draft',
  add column if not exists recorded_at timestamptz,
  add column if not exists local_date date,
  add column if not exists timezone text not null default 'UTC',
  add column if not exists audio_mime text,
  add column if not exists audio_bytes bigint,
  add column if not exists duration_ms integer,
  add column if not exists transcript_raw text,
  add column if not exists transcript_edited text,
  add column if not exists transcript_language text,
  add column if not exists title text,
  add column if not exists entry_summary text,
  add column if not exists analysis jsonb not null default '{}',
  add column if not exists content_version integer not null default 1,
  add column if not exists transcription_provider text,
  add column if not exists transcription_model text,
  add column if not exists analysis_provider text,
  add column if not exists analysis_model text,
  add column if not exists prompt_version text,
  add column if not exists attempt_count integer not null default 0,
  add column if not exists error_code text,
  add column if not exists uploaded_at timestamptz,
  add column if not exists transcribed_at timestamptz,
  add column if not exists analyzed_at timestamptz,
  add column if not exists updated_at timestamptz not null default now(),
  add column if not exists deleted_at timestamptz;

update public.diary_entries
set
  source = case when audio_path is null then 'text' else 'voice' end,
  status = case
    when nullif(trim(transcript), '') is not null then 'ready'
    when audio_path is not null then 'uploaded'
    else 'draft'
  end,
  recorded_at = coalesce(recorded_at, created_at),
  local_date = coalesce(local_date, (created_at at time zone 'UTC')::date),
  transcript_raw = coalesce(transcript_raw, transcript),
  analyzed_at = case
    when nullif(trim(transcript), '') is not null then coalesce(analyzed_at, created_at)
    else analyzed_at
  end
where
  recorded_at is null
  or local_date is null
  or transcript_raw is null
  or status = 'draft';

alter table public.diary_entries
  alter column recorded_at set default now(),
  alter column recorded_at set not null,
  alter column local_date set not null;

alter table public.diary_entries
  drop constraint if exists diary_entries_source_check,
  add constraint diary_entries_source_check
    check (source in ('voice', 'text')),
  drop constraint if exists diary_entries_status_check,
  add constraint diary_entries_status_check
    check (status in (
      'draft',
      'uploaded',
      'transcribing',
      'transcribed',
      'analyzing',
      'ready',
      'failed'
    )),
  drop constraint if exists diary_entries_audio_bytes_check,
  add constraint diary_entries_audio_bytes_check
    check (audio_bytes is null or audio_bytes >= 0),
  drop constraint if exists diary_entries_duration_ms_check,
  add constraint diary_entries_duration_ms_check
    check (duration_ms is null or duration_ms >= 0),
  drop constraint if exists diary_entries_content_version_check,
  add constraint diary_entries_content_version_check
    check (content_version >= 1),
  drop constraint if exists diary_entries_attempt_count_check,
  add constraint diary_entries_attempt_count_check
    check (attempt_count >= 0),
  drop constraint if exists diary_entries_analysis_object_check,
  add constraint diary_entries_analysis_object_check
    check (jsonb_typeof(analysis) = 'object');

create unique index if not exists idx_diary_entry_uuid
  on public.diary_entries(entry_uuid);
create unique index if not exists idx_diary_audio_path
  on public.diary_entries(audio_path)
  where audio_path is not null;
create index if not exists idx_diary_user_local_date
  on public.diary_entries(user_id, local_date desc, recorded_at desc)
  where deleted_at is null;

drop trigger if exists trg_diary_entries_touch on public.diary_entries;
create trigger trg_diary_entries_touch
before update on public.diary_entries
for each row execute function public.touch_updated_at();

-- Summary rows are server-generated. Clients may read only their own rows.
create table if not exists public.diary_summaries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  period_type text not null
    check (period_type in ('day', 'month', 'year')),
  period_start date not null,
  status text not null default 'pending'
    check (status in ('pending', 'generating', 'ready', 'failed')),
  source_fingerprint text,
  entry_count integer not null default 0 check (entry_count >= 0),
  active_day_count integer not null default 0 check (active_day_count >= 0),
  total_duration_ms bigint not null default 0 check (total_duration_ms >= 0),
  summary jsonb not null default '{}'
    check (jsonb_typeof(summary) = 'object'),
  provider text,
  model text,
  prompt_version text,
  schema_version integer not null default 1 check (schema_version >= 1),
  data_cutoff_at timestamptz,
  generated_at timestamptz,
  error_code text,
  attempt_count integer not null default 0 check (attempt_count >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, period_type, period_start)
);

alter table public.diary_summaries enable row level security;
drop policy if exists "Users read own diary summaries" on public.diary_summaries;
create policy "Users read own diary summaries"
on public.diary_summaries
for select
to authenticated
using ((select auth.uid()) = user_id);

revoke all on table public.diary_summaries from anon, authenticated;
grant select on table public.diary_summaries to authenticated;
grant all privileges on table public.diary_summaries to service_role;

drop trigger if exists trg_diary_summaries_touch on public.diary_summaries;
create trigger trg_diary_summaries_touch
before update on public.diary_summaries
for each row execute function public.touch_updated_at();

-- Preserve existing real month/year summaries while the old endpoint remains live.
insert into public.diary_summaries (
  user_id,
  period_type,
  period_start,
  status,
  source_fingerprint,
  entry_count,
  summary,
  data_cutoff_at,
  generated_at
)
select
  user_id,
  period,
  case
    when period = 'month' then (ref || '-01')::date
    else (ref || '-01-01')::date
  end,
  'ready',
  encode(digest(period || ':' || ref || ':' || entry_count::text, 'sha256'), 'hex'),
  entry_count,
  summary,
  updated_at,
  updated_at
from public.diary_summary_cache
where
  (period = 'month' and ref ~ '^[0-9]{4}-(0[1-9]|1[0-2])$')
  or (period = 'year' and ref ~ '^[0-9]{4}$')
on conflict (user_id, period_type, period_start) do nothing;

-- Private audio bucket restrictions. Keep paths immutable (no UPDATE/upsert policy).
update storage.buckets
set
  public = false,
  file_size_limit = 20971520,
  allowed_mime_types = array[
    'audio/webm',
    'audio/mp4',
    'audio/mpeg',
    'audio/wav',
    'audio/x-m4a'
  ]::text[]
where id = 'diary-audio';

drop policy if exists "diary owner read" on storage.objects;
drop policy if exists "diary owner insert" on storage.objects;
drop policy if exists "diary owner delete" on storage.objects;

create policy "diary owner read"
on storage.objects
for select
to authenticated
using (
  bucket_id = 'diary-audio'
  and (storage.foldername(name))[1] = (select auth.uid())::text
  and coalesce((auth.jwt() ->> 'is_anonymous')::boolean, false) = false
);

create policy "diary owner insert"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'diary-audio'
  and (storage.foldername(name))[1] = (select auth.uid())::text
  and coalesce((auth.jwt() ->> 'is_anonymous')::boolean, false) = false
);

create policy "diary owner delete"
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'diary-audio'
  and (storage.foldername(name))[1] = (select auth.uid())::text
  and coalesce((auth.jwt() ->> 'is_anonymous')::boolean, false) = false
);
