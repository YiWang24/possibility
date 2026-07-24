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
values ('11111111-1111-4111-8111-111111111111', 10, '{"\u9636\u6bb5":"\u8f6c\u578b"}')
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

-- 用户 A 写入新表数据
insert into public.profile_dimensions (user_id, dimension, tags)
values ('11111111-1111-4111-8111-111111111111', 'skill', '{"\u7f16\u7a0b","\u5199\u4f5c"}')
on conflict (user_id, dimension) do update set tags = excluded.tags;

insert into public.card_game_results (user_id, kind, final_cards, rounds)
values (
  '11111111-1111-4111-8111-111111111111',
  'life',
  '[{"id":"c1","name":"\u7a33\u5b9a\u6536\u5165"}]'::jsonb,
  3
) on conflict (user_id, kind) do update set rounds = excluded.rounds;

insert into public.public_profiles (id, name, quote)
values ('11111111-1111-4111-8111-111111111111', '测试用户A', '人生如棋')
on conflict (id) do update set name = excluded.name;

insert into public.kaleidoscope_draws (user_id, mode, traveler_id)
values ('11111111-1111-4111-8111-111111111111', 'similar', 1);
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
  -- 新表隔离检查
  if (select count(*) from public.profile_dimensions) <> 0 then
    raise exception 'cross-user profile_dimensions read unexpectedly succeeded';
  end if;
  if (select count(*) from public.card_game_results) <> 0 then
    raise exception 'cross-user card_game_results read unexpectedly succeeded';
  end if;
  if (select count(*) from public.kaleidoscope_draws) <> 0 then
    raise exception 'cross-user kaleidoscope_draws read unexpectedly succeeded';
  end if;
  -- public_profiles 是公开可读的，应该能看到
  if (select count(*) from public.public_profiles) <> 1 then
    raise exception 'public_profiles should be readable by all authenticated users';
  end if;
  begin
    insert into public.messages (conversation_id, role, content)
    values ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'user', 'forbidden');
    raise exception 'cross-user message write unexpectedly succeeded';
  exception
    when insufficient_privilege then null;
  end;
  -- 用户 B 不能写入用户 A 的维度
  begin
    insert into public.profile_dimensions (user_id, dimension, tags)
    values ('11111111-1111-4111-8111-111111111111', 'like', '{"\u97f3\u4e50"}')
    on conflict do nothing;
    raise exception 'cross-user dimension write unexpectedly succeeded';
  exception
    when insufficient_privilege then null;
  end;
  -- 用户 B 不能修改用户 A 的公开资料
  begin
    update public.public_profiles set name = 'hacked'
    where id = '11111111-1111-4111-8111-111111111111';
    if found then
      raise exception 'cross-user public_profile update unexpectedly succeeded';
    end if;
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
