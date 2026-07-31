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

insert into public.memory_proposals (
  user_id,
  dimension,
  value,
  normalized_value,
  source_type,
  source_id,
  confidence,
  dedupe_key
)
values (
  '66666666-6666-4666-8666-666666666666',
  'skill',
  '产品策略',
  '产品策略',
  'diary',
  '66666666-1111-4111-8111-111111111111',
  0.7,
  'diary-proposal-before-edit'
);

update public.diary_entries
   set content_version = content_version + 1
 where entry_uuid = '66666666-1111-4111-8111-111111111111';

do $$
begin
  if exists (
    select 1 from public.memory_proposals
     where dedupe_key = 'diary-proposal-before-edit'
  ) then
    raise exception 'editing a diary must remove its stale pending proposals';
  end if;
end
$$;

insert into public.diary_entries (
  user_id,
  entry_uuid,
  source,
  status,
  recorded_at,
  local_date,
  timezone,
  transcript
)
values (
  '66666666-6666-4666-8666-666666666666',
  '66666666-2222-4222-8222-222222222222',
  'text',
  'ready',
  '2026-07-31T03:00:00Z',
  '2026-07-30',
  'America/Toronto',
  '这条日记将被删除。'
);

insert into public.memory_proposals (
  user_id,
  dimension,
  value,
  normalized_value,
  source_type,
  source_id,
  confidence,
  dedupe_key
)
values (
  '66666666-6666-4666-8666-666666666666',
  'like',
  '安静地散步',
  '安静地散步',
  'diary',
  '66666666-2222-4222-8222-222222222222',
  0.7,
  'diary-proposal-before-delete'
);

delete from public.diary_entries
 where entry_uuid = '66666666-2222-4222-8222-222222222222';

do $$
begin
  if exists (
    select 1 from public.memory_proposals
     where dedupe_key = 'diary-proposal-before-delete'
  ) then
    raise exception 'deleting a diary must remove its pending proposals';
  end if;
end
$$;

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
