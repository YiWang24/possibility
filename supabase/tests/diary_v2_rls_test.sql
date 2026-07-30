\set ON_ERROR_STOP on

begin;

insert into auth.users (id, role, created_at, updated_at)
values
  ('66666666-6666-4666-8666-666666666666', 'authenticated', now(), now()),
  ('77777777-7777-4777-8777-777777777777', 'authenticated', now(), now());

insert into public.diary_entries (
  user_id,
  entry_uuid,
  source,
  status,
  recorded_at,
  local_date,
  timezone,
  audio_path,
  audio_mime
)
values (
  '66666666-6666-4666-8666-666666666666',
  '66666666-1111-4111-8111-111111111111',
  'voice',
  'draft',
  '2026-07-31T02:30:00Z',
  '2026-07-30',
  'America/Toronto',
  '66666666-6666-4666-8666-666666666666/2026/07/66666666-1111-4111-8111-111111111111/source.webm',
  'audio/webm'
);

insert into public.diary_summaries (
  user_id,
  period_type,
  period_start,
  status,
  entry_count,
  summary
)
values
  (
    '66666666-6666-4666-8666-666666666666',
    'day',
    '2026-07-30',
    'ready',
    1,
    '{"insight":"用户 A 的私有总结"}'::jsonb
  ),
  (
    '77777777-7777-4777-8777-777777777777',
    'day',
    '2026-07-30',
    'ready',
    1,
    '{"insight":"用户 B 的私有总结"}'::jsonb
  );

select set_config(
  'request.jwt.claims',
  '{"sub":"66666666-6666-4666-8666-666666666666","role":"authenticated","is_anonymous":false}',
  true
);
set local role authenticated;

do $$
begin
  if (select count(*) from public.diary_entries) <> 1 then
    raise exception 'diary entries must be isolated to their owner';
  end if;
  if (select count(*) from public.diary_summaries) <> 1 then
    raise exception 'diary summaries must be isolated to their owner';
  end if;

  begin
    insert into public.diary_summaries (
      user_id,
      period_type,
      period_start
    )
    values (
      '66666666-6666-4666-8666-666666666666',
      'month',
      '2026-07-01'
    );
    raise exception 'clients must not write AI summary rows';
  exception when insufficient_privilege then null; end;

  begin
    perform public.enqueue_diary_job(
      'forbidden-client-job',
      'transcribe_entry',
      '66666666-6666-4666-8666-666666666666',
      '66666666-1111-4111-8111-111111111111',
      null,
      0
    );
    raise exception 'clients must not enqueue diary worker jobs';
  exception when insufficient_privilege then null; end;

  begin
    perform public.purge_diary_jobs(
      '66666666-6666-4666-8666-666666666666'
    );
    raise exception 'clients must not purge diary worker jobs';
  exception when insufficient_privilege then null; end;
end
$$;

insert into storage.objects (bucket_id, name)
values (
  'diary-audio',
  '66666666-6666-4666-8666-666666666666/2026/07/normal/source.webm'
);

reset role;
select set_config(
  'request.jwt.claims',
  '{"sub":"66666666-6666-4666-8666-666666666666","role":"authenticated","is_anonymous":true}',
  true
);
set local role authenticated;

do $$
begin
  begin
    insert into storage.objects (bucket_id, name)
    values (
      'diary-audio',
      '66666666-6666-4666-8666-666666666666/2026/07/anonymous/source.webm'
    );
    raise exception 'anonymous sessions must not upload diary audio';
  exception when insufficient_privilege then null; end;
end
$$;

rollback;
