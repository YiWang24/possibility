\set ON_ERROR_STOP on

begin;

insert into auth.users (id, role, created_at, updated_at)
values
  ('11111111-1111-4111-8111-111111111111', 'authenticated', now(), now()),
  ('22222222-2222-4222-8222-222222222222', 'authenticated', now(), now());

-- 公开内容允许匿名读取，但不允许匿名写入。
set local role anon;
do $$
begin
  if (select count(*) from public.travelers) <> 12 then
    raise exception 'anon should read all seeded travelers';
  end if;
  begin
    insert into public.bounties (question, reward, responses)
    values ('forbidden', '0', '0');
    raise exception 'anon content write unexpectedly succeeded';
  exception
    when insufficient_privilege then null;
  end;
end
$$;
reset role;

-- 用户 A 能写自己的数据。
select set_config(
  'request.jwt.claim.sub',
  '11111111-1111-4111-8111-111111111111',
  true
);
set local role authenticated;
insert into public.profiles (id, portrait_pct, dims)
values ('11111111-1111-4111-8111-111111111111', 10, '{"阶段":"转型"}')
on conflict (id) do update
set portrait_pct = excluded.portrait_pct,
    dims = excluded.dims;
insert into public.conversations (id, user_id, topic)
values (
  'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  '11111111-1111-4111-8111-111111111111',
  '职业'
);
insert into public.messages (conversation_id, role, content)
values ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'user', '是否转行');
reset role;

-- 用户 B 看不到也改不了用户 A 的对话、消息和画像。
select set_config(
  'request.jwt.claim.sub',
  '22222222-2222-4222-8222-222222222222',
  true
);
set local role authenticated;
do $$
begin
  if (select count(*) from public.conversations) <> 0 then
    raise exception 'cross-user conversation read unexpectedly succeeded';
  end if;
  if (select count(*) from public.messages) <> 0 then
    raise exception 'cross-user message read unexpectedly succeeded';
  end if;
  if (
    select count(*) from public.profiles
    where id = '11111111-1111-4111-8111-111111111111'
  ) <> 0 then
    raise exception 'cross-user profile read unexpectedly succeeded';
  end if;
  begin
    insert into public.messages (conversation_id, role, content)
    values ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'user', 'forbidden');
    raise exception 'cross-user message write unexpectedly succeeded';
  exception
    when insufficient_privilege then null;
  end;
end
$$;
reset role;

-- Storage 首层目录必须等于 auth.uid()。
select set_config(
  'request.jwt.claim.sub',
  '11111111-1111-4111-8111-111111111111',
  true
);
set local role authenticated;
insert into storage.objects (bucket_id, name)
values (
  'diary-audio',
  '11111111-1111-4111-8111-111111111111/entry.m4a'
);
do $$
begin
  begin
    insert into storage.objects (bucket_id, name)
    values (
      'diary-audio',
      '22222222-2222-4222-8222-222222222222/forbidden.m4a'
    );
    raise exception 'cross-user storage write unexpectedly succeeded';
  exception
    when insufficient_privilege then null;
  end;
end
$$;
reset role;

rollback;
