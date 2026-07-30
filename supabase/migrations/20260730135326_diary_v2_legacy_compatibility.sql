-- Keep legacy text-only writers compatible with diary v2.
-- Old clients insert only (user_id, transcript, emotions, keywords). The
-- trigger derives the new timeline fields and marks that text entry ready.

create or replace function public.normalize_diary_entry()
returns trigger
language plpgsql
set search_path = pg_catalog, public
as $$
begin
  new.recorded_at := coalesce(new.recorded_at, new.created_at, now());
  new.timezone := coalesce(nullif(new.timezone, ''), 'UTC');
  new.local_date := coalesce(
    new.local_date,
    (new.recorded_at at time zone new.timezone)::date
  );

  if nullif(trim(coalesce(new.transcript_raw, '')), '') is null
     and nullif(trim(coalesce(new.transcript, '')), '') is not null then
    new.transcript_raw := new.transcript;
  end if;

  if new.source = 'text'
     and new.status = 'draft'
     and nullif(trim(coalesce(new.transcript, '')), '') is not null then
    new.status := 'ready';
    new.analyzed_at := coalesce(new.analyzed_at, new.created_at, now());
  end if;

  return new;
end;
$$;

drop trigger if exists trg_diary_entries_normalize on public.diary_entries;
create trigger trg_diary_entries_normalize
before insert or update of recorded_at, local_date, timezone, transcript,
  transcript_raw, source, status
on public.diary_entries
for each row execute function public.normalize_diary_entry();
