\set ON_ERROR_STOP on

-- 全面的后端「实际业务 + 安全」SQL 测试。
-- 覆盖：注册建档触发器、公开内容读取/写入边界、画像更新 RPC 的合并与钳制、
-- 全部用户表的自有读写、updated_at 触发器、CHECK/UNIQUE 约束强制、
-- 跨用户 RLS 隔离，以及 Storage 首层目录归属。
-- 运行：npm run db:test（supabase db reset 应用迁移+seed 后执行本文件）。

begin;

-- ==================== 0. 注册即建档触发器 ====================
-- 插入 auth.users 应经 handle_new_user 自动在 profiles 建行。
insert into auth.users (id, role, created_at, updated_at)
values
  ('11111111-1111-4111-8111-111111111111', 'authenticated', now(), now()),
  ('22222222-2222-4222-8222-222222222222', 'authenticated', now(), now());

do $$
begin
  if (
    select count(*) from public.profiles
    where id in (
      '11111111-1111-4111-8111-111111111111',
      '22222222-2222-4222-8222-222222222222'
    )
  ) <> 2 then
    raise exception 'handle_new_user should auto-create a profiles row per user';
  end if;
end
$$;

-- ==================== 1. 公开内容：匿名可读、不可写 ====================
set local role anon;
do $$
begin
  if (select count(*) from public.travelers) <> 12 then
    raise exception 'anon should read all 12 seeded travelers';
  end if;
  if (select count(*) from public.traveler_details) <> 12 then
    raise exception 'anon should read all 12 traveler_details';
  end if;
  if (select count(*) from public.traveler_services) <> 10 then
    raise exception 'anon should read all 10 traveler_services';
  end if;
  if (select count(*) from public.bounties) <> 3 then
    raise exception 'anon should read all 3 seeded bounties';
  end if;
  -- 相似旅人（万花筒「相似」模式候选）应恰为 id 1,2,4,5。
  if (select count(*) from public.travelers where is_similar) <> 4 then
    raise exception 'expected exactly 4 similar travelers in seed';
  end if;
  -- 匿名写入内容表必须被拒。
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

-- ==================== 2. 用户 A：画像更新 RPC（合并 + 钳制） ====================
select set_config(
  'request.jwt.claim.sub',
  '11111111-1111-4111-8111-111111111111',
  true
);
set local role authenticated;

do $$
declare
  v_pct  smallint;
  v_dims jsonb;
begin
  -- 首次：portrait 0 -> 30，dims 写入「阶段」。
  select portrait_pct, dims into v_pct, v_dims
  from public.apply_profile_update('{"\u9636\u6bb5":"\u8f6c\u578b"}'::jsonb, 30);
  if v_pct <> 30 then
    raise exception 'rpc first call portrait expected 30, got %', v_pct;
  end if;

  -- 上钳制：30 + 90 = 120 -> 100；dims 合并「技能」。
  select portrait_pct, dims into v_pct, v_dims
  from public.apply_profile_update('{"\u6280\u80fd":"\u7f16\u7a0b"}'::jsonb, 90);
  if v_pct <> 100 then
    raise exception 'rpc portrait should clamp to 100, got %', v_pct;
  end if;

  -- 下钳制：100 - 200 = -100 -> 0；dims 传空对象不应删除既有键。
  select portrait_pct, dims into v_pct, v_dims
  from public.apply_profile_update('{}'::jsonb, -200);
  if v_pct <> 0 then
    raise exception 'rpc portrait should clamp to 0, got %', v_pct;
  end if;
  if not (v_dims ? '阶段' and v_dims ? '技能') then
    raise exception 'rpc should merge dims cumulatively, got %', v_dims;
  end if;
end
$$;

-- ==================== 3. 用户 A：写入全部自有业务表 ====================
insert into public.conversations (id, user_id, topic)
values (
  'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  '11111111-1111-4111-8111-111111111111',
  '职业'
);
insert into public.messages (conversation_id, role, content)
values
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'user', '是否转行'),
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'assistant', '你最担心什么？');

insert into public.diary_entries (user_id, transcript, emotions, keywords)
values (
  '11111111-1111-4111-8111-111111111111',
  '今天想清楚了一件事',
  '{"平静"}',
  '{"转型"}'
);

-- 推演：scenarios 与 bottom_line 均为 jsonb 对象，carry_cards 为底线卡。
insert into public.simulations
  (user_id, question, choice, years, scenarios, bottom_line, carry_cards)
values (
  '11111111-1111-4111-8111-111111111111',
  '要不要转行',
  '转',
  5,
  '{"general":"稳步过渡"}'::jsonb,
  '{"is_acceptable":true,"risks":["收入波动"],"protective_conditions":["半年储备"]}'::jsonb,
  '{"稳定收入","家人支持"}'
);

insert into public.unlocks (user_id, kind, target_id, amount)
values ('11111111-1111-4111-8111-111111111111', 'profile', '1', 29);

insert into public.profile_dimensions (user_id, dimension, tags)
values ('11111111-1111-4111-8111-111111111111', 'skill', '{"\u7f16\u7a0b","\u5199\u4f5c"}');

insert into public.card_game_results (user_id, kind, final_cards, rounds)
values (
  '11111111-1111-4111-8111-111111111111',
  'life',
  '[{"id":"c1","name":"\u7a33\u5b9a\u6536\u5165"}]'::jsonb,
  3
);

insert into public.public_profiles (id, name, quote)
values ('11111111-1111-4111-8111-111111111111', '测试用户A', '人生如棋');

insert into public.kaleidoscope_draws (user_id, mode, traveler_id)
values ('11111111-1111-4111-8111-111111111111', 'similar', 1);

-- 旅人匹配记录（0013）：payload 形状对齐 db.ts:insertMatchResult
-- （user_state 快照 jsonb + matches 数组 jsonb）。
insert into public.match_results (user_id, user_state, matches)
values (
  '11111111-1111-4111-8111-111111111111',
  '{"life_stage":"职业转型期","tension":"稳定与热爱冲突"}'::jsonb,
  '[{"traveler_id":1,"reason":"同样从大厂转型","not_applicable":"行业不同"}]'::jsonb
);

-- 人生实验室选择卡（0013）：payload 形状对齐 db.ts:insertLabChoiceSet
-- （question/topic/constraints/previous_choices + cards jsonb + rationale）。
insert into public.lab_choice_sets
  (user_id, question, topic, constraints, previous_choices, cards, rationale)
values (
  '11111111-1111-4111-8111-111111111111',
  '要不要辞职创业',
  '职业',
  '{"半年储备","家人支持"}',
  '{"继续打工"}',
  '[{"id":"a","glyph":"◆","title":"稳中求进","description":"边工作边试","color":"#4A90D9"}]'::jsonb,
  '基于你的画像给出三条差异化路径'
);

insert into public.persona_jobs (user_id, status, persona)
values (
  '11111111-1111-4111-8111-111111111111',
  'completed',
  '{"seed":123,"shape":"星轨旅者","hue":248,"lobes":5}'::jsonb
);

-- 日记回顾缓存（0011）：A 写入自己的月度缓存。
insert into public.diary_summary_cache (user_id, period, ref, entry_count, summary)
values (
  '11111111-1111-4111-8111-111111111111',
  'month',
  '2026-07',
  1,
  '{"top_emotions":["平静"],"top_keywords":["转型"],"insight":"测试洞察","highlights":[]}'::jsonb
);

-- 用户 A 创建自己的悬赏（0007 起 authenticated 可写、RLS 锁 user_id）。
insert into public.bounties (question, reward, responses, user_id)
values ('转行第一年最难的是什么', '感谢', '0', '11111111-1111-4111-8111-111111111111');

-- 用户 A 回应种子悬赏（get_bounty 依赖回应公开可读，见 0009）。
insert into public.bounty_responses (bounty_id, user_id, message)
values (1, '11111111-1111-4111-8111-111111111111', '我有类似经历，可以分享');

-- 回应计数同步触发器（0010）：insert 后 bounties.responses 按实际 count 重算；
-- 更新已有回应（upsert 命中 UPDATE 路径）不重复计数。
do $$
declare
  v_responses text;
begin
  select responses into v_responses from public.bounties where id = 1;
  if v_responses <> '1 人回应' then
    raise exception
      'bounties.responses should sync to "1 人回应" after respond, got %',
      v_responses;
  end if;

  update public.bounty_responses set message = '补充：第一年确实有降薪'
  where bounty_id = 1
    and user_id = '11111111-1111-4111-8111-111111111111';

  select responses into v_responses from public.bounties where id = 1;
  if v_responses <> '1 人回应' then
    raise exception
      'updating an existing response must not double count, got %',
      v_responses;
  end if;
end
$$;

-- ==================== 4. updated_at 触发器 ====================
-- INSERT 不触发 BEFORE UPDATE 触发器，故可用一个旧时间写入基线；
-- 随后 UPDATE 应被 touch_updated_at 刷新为事务时间（不再等于旧值）。
insert into public.profile_dimensions (user_id, dimension, tags, updated_at)
values (
  '11111111-1111-4111-8111-111111111111',
  'like',
  '{"\u9605\u8bfb"}',
  '2000-01-01T00:00:00Z'
);
update public.profile_dimensions
set tags = '{"\u9605\u8bfb","\u5f92\u6b65"}'
where user_id = '11111111-1111-4111-8111-111111111111' and dimension = 'like';
do $$
begin
  if (
    select updated_at from public.profile_dimensions
    where user_id = '11111111-1111-4111-8111-111111111111' and dimension = 'like'
  ) = '2000-01-01T00:00:00Z' then
    raise exception 'touch_updated_at should refresh updated_at on UPDATE';
  end if;
end
$$;

-- ==================== 5. CHECK / UNIQUE 约束强制 ====================
do $$
begin
  -- messages.role 只允许 user/assistant
  begin
    insert into public.messages (conversation_id, role, content)
    values ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'system', 'x');
    raise exception 'messages.role check not enforced';
  exception when check_violation then null; end;

  -- card_game_results.kind 白名单
  begin
    insert into public.card_game_results (user_id, kind, final_cards)
    values ('11111111-1111-4111-8111-111111111111', 'career', '[]'::jsonb);
    raise exception 'card_game_results.kind check not enforced';
  exception when check_violation then null; end;

  -- kaleidoscope_draws.mode 白名单
  begin
    insert into public.kaleidoscope_draws (user_id, mode, traveler_id)
    values ('11111111-1111-4111-8111-111111111111', 'random', 1);
    raise exception 'kaleidoscope_draws.mode check not enforced';
  exception when check_violation then null; end;

  -- persona_jobs.status 白名单
  begin
    insert into public.persona_jobs (user_id, status)
    values ('11111111-1111-4111-8111-111111111111', 'unknown');
    raise exception 'persona_jobs.status check not enforced';
  exception when check_violation then null; end;

  -- unlocks.kind 白名单
  begin
    insert into public.unlocks (user_id, kind, target_id, amount)
    values ('11111111-1111-4111-8111-111111111111', 'gift', '9', 1);
    raise exception 'unlocks.kind check not enforced';
  exception when check_violation then null; end;

  -- unlocks.amount 必须为正
  begin
    insert into public.unlocks (user_id, kind, target_id, amount)
    values ('11111111-1111-4111-8111-111111111111', 'service', '9', 0);
    raise exception 'unlocks positive-amount check not enforced';
  exception when check_violation then null; end;

  -- simulations.bottom_line 必须是对象（非数组）
  begin
    insert into public.simulations
      (user_id, question, choice, years, scenarios, bottom_line)
    values (
      '11111111-1111-4111-8111-111111111111', 'q', 'c', 1,
      '{}'::jsonb, '[]'::jsonb
    );
    raise exception 'simulations.bottom_line object check not enforced';
  exception when check_violation then null; end;

  -- persona_jobs.persona 必须是对象（非数组）
  begin
    insert into public.persona_jobs (user_id, persona)
    values ('11111111-1111-4111-8111-111111111111', '[]'::jsonb);
    raise exception 'persona_jobs.persona object check not enforced';
  exception when check_violation then null; end;

  -- profiles.dims 必须是对象（非数组）
  begin
    update public.profiles set dims = '[]'::jsonb
    where id = '11111111-1111-4111-8111-111111111111';
    raise exception 'profiles.dims object check not enforced';
  exception when check_violation then null; end;

  -- UNIQUE(user_id, dimension)
  begin
    insert into public.profile_dimensions (user_id, dimension, tags)
    values ('11111111-1111-4111-8111-111111111111', 'skill', '{}');
    raise exception 'profile_dimensions unique(user_id,dimension) not enforced';
  exception when unique_violation then null; end;

  -- UNIQUE(user_id, kind)
  begin
    insert into public.card_game_results (user_id, kind, final_cards)
    values ('11111111-1111-4111-8111-111111111111', 'life', '[]'::jsonb);
    raise exception 'card_game_results unique(user_id,kind) not enforced';
  exception when unique_violation then null; end;

  -- UNIQUE(user_id, kind, target_id)
  begin
    insert into public.unlocks (user_id, kind, target_id, amount)
    values ('11111111-1111-4111-8111-111111111111', 'profile', '1', 29);
    raise exception 'unlocks unique(user_id,kind,target_id) not enforced';
  exception when unique_violation then null; end;
end
$$;
reset role;

-- ==================== 6. 用户 B：跨用户隔离 ====================
select set_config(
  'request.jwt.claim.sub',
  '22222222-2222-4222-8222-222222222222',
  true
);
set local role authenticated;
do $$
begin
  -- 私有表：B 读不到 A 的任何行。
  if (select count(*) from public.conversations) <> 0 then
    raise exception 'cross-user conversations leaked';
  end if;
  if (select count(*) from public.messages) <> 0 then
    raise exception 'cross-user messages leaked';
  end if;
  if (select count(*) from public.diary_entries) <> 0 then
    raise exception 'cross-user diary_entries leaked';
  end if;
  if (select count(*) from public.simulations) <> 0 then
    raise exception 'cross-user simulations leaked';
  end if;
  if (select count(*) from public.unlocks) <> 0 then
    raise exception 'cross-user unlocks leaked';
  end if;
  if (select count(*) from public.profile_dimensions) <> 0 then
    raise exception 'cross-user profile_dimensions leaked';
  end if;
  if (select count(*) from public.card_game_results) <> 0 then
    raise exception 'cross-user card_game_results leaked';
  end if;
  if (select count(*) from public.kaleidoscope_draws) <> 0 then
    raise exception 'cross-user kaleidoscope_draws leaked';
  end if;
  if (select count(*) from public.match_results) <> 0 then
    raise exception 'cross-user match_results leaked';
  end if;
  if (select count(*) from public.lab_choice_sets) <> 0 then
    raise exception 'cross-user lab_choice_sets leaked';
  end if;
  if (select count(*) from public.persona_jobs) <> 0 then
    raise exception 'cross-user persona_jobs leaked';
  end if;
  if (select count(*) from public.diary_summary_cache) <> 0 then
    raise exception 'cross-user diary_summary_cache leaked';
  end if;
  if (
    select count(*) from public.profiles
    where id = '11111111-1111-4111-8111-111111111111'
  ) <> 0 then
    raise exception 'cross-user profile leaked';
  end if;

  -- 公开可读：public_profiles、travelers、bounties（含 A 的悬赏）。
  if (select count(*) from public.public_profiles) <> 1 then
    raise exception 'public_profiles should be readable by all authenticated users';
  end if;
  if (select count(*) from public.travelers) <> 12 then
    raise exception 'travelers should be readable by all';
  end if;
  if (select count(*) from public.bounties) < 4 then
    raise exception 'bounties (incl. others) should be readable by all';
  end if;

  -- 悬赏回应公开可读（0009）：B 能读到 A 对悬赏 1 的回应。
  if (
    select count(*) from public.bounty_responses
    where bounty_id = 1
      and user_id = '11111111-1111-4111-8111-111111111111'
  ) <> 1 then
    raise exception 'bounty_responses should be readable by all authenticated users';
  end if;

  -- 但 B 不能改写 A 的回应（策略过滤为 0 行，found=false）。
  update public.bounty_responses set message = 'hacked'
  where user_id = '11111111-1111-4111-8111-111111111111';
  if found then
    raise exception 'cross-user bounty_response update unexpectedly succeeded';
  end if;

  -- 写入 A 的从属数据必须被拒。
  begin
    insert into public.messages (conversation_id, role, content)
    values ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'user', 'forbidden');
    raise exception 'cross-user message write unexpectedly succeeded';
  exception when insufficient_privilege then null; end;

  begin
    insert into public.profile_dimensions (user_id, dimension, tags)
    values ('11111111-1111-4111-8111-111111111111', 'love', '{"\u97f3\u4e50"}');
    raise exception 'cross-user dimension write unexpectedly succeeded';
  exception when insufficient_privilege then null; end;

  begin
    insert into public.persona_jobs (user_id)
    values ('11111111-1111-4111-8111-111111111111');
    raise exception 'cross-user persona_job write unexpectedly succeeded';
  exception when insufficient_privilege then null; end;

  begin
    insert into public.diary_summary_cache (user_id, period, ref)
    values ('11111111-1111-4111-8111-111111111111', 'year', '2026');
    raise exception 'cross-user diary_summary_cache write unexpectedly succeeded';
  exception when insufficient_privilege then null; end;

  -- B 无法修改 A 的公开资料 / 悬赏（策略过滤为 0 行，found=false）。
  update public.public_profiles set name = 'hacked'
  where id = '11111111-1111-4111-8111-111111111111';
  if found then
    raise exception 'cross-user public_profile update unexpectedly succeeded';
  end if;

  update public.bounties set detail = 'hacked'
  where user_id = '11111111-1111-4111-8111-111111111111';
  if found then
    raise exception 'cross-user bounty update unexpectedly succeeded';
  end if;
end
$$;

-- 画像 RPC 以调用者身份运行：B 调用只应影响 B 自己，A 的画像不受影响。
do $$
declare
  v_pct smallint;
begin
  select portrait_pct into v_pct
  from public.apply_profile_update('{"x":"y"}'::jsonb, 15);
  if v_pct <> 15 then
    raise exception 'B rpc should update only B, expected 15 got %', v_pct;
  end if;
end
$$;
reset role;

-- 越权 RPC 未污染 A：A 的 portrait 仍为第 2 步钳制后的 0。
do $$
begin
  if (
    select portrait_pct from public.profiles
    where id = '11111111-1111-4111-8111-111111111111'
  ) <> 0 then
    raise exception 'user A portrait must stay isolated from user B rpc';
  end if;
end
$$;

-- ==================== 7. Storage：首层目录必须等于 auth.uid() ====================
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
  exception when insufficient_privilege then null; end;
end
$$;
reset role;

-- ==================== 8. merge_anonymous_user：匿名账号数据迁移（登录系统） ====================
-- old 模拟匿名账号，new 为正式账号；构造重叠数据后合并，校验：
-- 迁移正确、唯一冲突丢弃匿名侧保留正式侧、profiles 合并规则、旧行清空、
-- 以及权限仅 service_role（authenticated 不得执行）。
insert into auth.users (id, role, created_at, updated_at)
values
  ('33333333-3333-4333-8333-333333333333', 'authenticated', now(), now()),
  ('44444444-4444-4444-8444-444444444444', 'authenticated', now(), now());

-- 授权校验：authenticated 角色不得执行迁移函数（仅 grant 给 service_role）。
select set_config(
  'request.jwt.claim.sub',
  '44444444-4444-4444-8444-444444444444',
  true
);
set local role authenticated;
do $$
begin
  begin
    perform public.merge_anonymous_user(
      '33333333-3333-4333-8333-333333333333',
      '44444444-4444-4444-8444-444444444444'
    );
    raise exception 'authenticated must NOT execute merge_anonymous_user';
  exception when insufficient_privilege then null; end;
end
$$;
reset role;

-- 构造迁移前数据（postgres 直接写，模拟两账号既有数据）。
-- profiles：old 覆盖 dims 与 pct，验证合并时 new 键优先 + pct 取较大。
update public.profiles
  set dims = '{"a":"1","shared":"old"}'::jsonb, portrait_pct = 40
  where id = '33333333-3333-4333-8333-333333333333';
update public.profiles
  set dims = '{"b":"2","shared":"new"}'::jsonb, portrait_pct = 10
  where id = '44444444-4444-4444-8444-444444444444';

-- conversations：无 user_id 唯一约束 → 直接改归属。
insert into public.conversations (id, user_id, topic)
values (
  'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
  '33333333-3333-4333-8333-333333333333',
  'anon-topic'
);

-- unlocks：old 有 (profile,1)(profile,2)；new 有 (profile,1)
-- → 冲突丢弃 old 的 1，迁入 old 的 2；new 最终恰 2 行。
insert into public.unlocks (user_id, kind, target_id, amount)
values
  ('33333333-3333-4333-8333-333333333333', 'profile', '1', 9),
  ('33333333-3333-4333-8333-333333333333', 'profile', '2', 9),
  ('44444444-4444-4444-8444-444444444444', 'profile', '1', 9);

-- profile_dimensions：old 有 skill/love；new 有 skill
-- → 冲突丢弃 old skill（保留 new 值），迁入 old love。
insert into public.profile_dimensions (user_id, dimension, tags)
values
  ('33333333-3333-4333-8333-333333333333', 'skill', '{"old"}'),
  ('33333333-3333-4333-8333-333333333333', 'love', '{"old"}'),
  ('44444444-4444-4444-8444-444444444444', 'skill', '{"new"}');

-- card_game_results：仅 old 有 life → 直接迁入。
insert into public.card_game_results (user_id, kind, final_cards)
values ('33333333-3333-4333-8333-333333333333', 'life', '[]'::jsonb);

-- bounty_responses：old 回应悬赏 1、2；new 回应悬赏 1
-- → 冲突丢弃 old 对 1 的回应，迁入 old 对 2 的回应。
insert into public.bounty_responses (bounty_id, user_id, message)
values
  (1, '33333333-3333-4333-8333-333333333333', 'old-resp'),
  (2, '33333333-3333-4333-8333-333333333333', 'old-resp-2'),
  (1, '44444444-4444-4444-8444-444444444444', 'new-resp');

-- public_profiles：两账号均建档 → 合并应保留 new、删除 old。
insert into public.public_profiles (id, name)
values
  ('33333333-3333-4333-8333-333333333333', 'old-name'),
  ('44444444-4444-4444-8444-444444444444', 'new-name');

-- 执行迁移（postgres 拥有 execute 权限）。
select public.merge_anonymous_user(
  '33333333-3333-4333-8333-333333333333',
  '44444444-4444-4444-8444-444444444444'
);

do $$
declare
  v_dims jsonb;
  v_pct  smallint;
begin
  -- profiles：dims 合并（new 覆盖 shared），pct 取较大值 40，old 行删除。
  select dims, portrait_pct into v_dims, v_pct
  from public.profiles where id = '44444444-4444-4444-8444-444444444444';
  if not (v_dims ? 'a' and v_dims ? 'b' and v_dims->>'shared' = 'new') then
    raise exception 'merge profiles dims wrong: %', v_dims;
  end if;
  if v_pct <> 40 then
    raise exception 'merge portrait_pct should be greatest=40, got %', v_pct;
  end if;
  if exists (
    select 1 from public.profiles
    where id = '33333333-3333-4333-8333-333333333333'
  ) then
    raise exception 'old profiles row must be deleted after merge';
  end if;

  -- conversations：old 的会话已归属 new，old 无残留。
  if (
    select count(*) from public.conversations
    where user_id = '44444444-4444-4444-8444-444444444444'
      and id = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc'
  ) <> 1 then
    raise exception 'conversation should be reassigned to new user';
  end if;
  if exists (
    select 1 from public.conversations
    where user_id = '33333333-3333-4333-8333-333333333333'
  ) then
    raise exception 'no conversation should remain on old user';
  end if;

  -- unlocks：冲突 (profile,1) 保留 new、丢弃 old；(profile,2) 迁入 → new 恰 2 行。
  if (
    select count(*) from public.unlocks
    where user_id = '44444444-4444-4444-8444-444444444444'
  ) <> 2 then
    raise exception 'new user should have exactly 2 unlocks after merge';
  end if;
  if exists (
    select 1 from public.unlocks
    where user_id = '33333333-3333-4333-8333-333333333333'
  ) then
    raise exception 'no unlocks should remain on old user';
  end if;

  -- profile_dimensions：skill 保留 new 值，love 迁入 → new 恰 2 行。
  if (
    select count(*) from public.profile_dimensions
    where user_id = '44444444-4444-4444-8444-444444444444'
  ) <> 2 then
    raise exception 'new user should have exactly 2 dimensions after merge';
  end if;
  if (
    select tags[1] from public.profile_dimensions
    where user_id = '44444444-4444-4444-8444-444444444444'
      and dimension = 'skill'
  ) <> 'new' then
    raise exception 'conflicting skill dimension should keep new user value';
  end if;

  -- card_game_results：old 的 life 直接迁入。
  if (
    select count(*) from public.card_game_results
    where user_id = '44444444-4444-4444-8444-444444444444' and kind = 'life'
  ) <> 1 then
    raise exception 'card_game_results should be reassigned to new user';
  end if;

  -- bounty_responses：冲突悬赏 1 保留 new、丢弃 old；悬赏 2 迁入 → new 恰 2 行。
  if (
    select count(*) from public.bounty_responses
    where user_id = '44444444-4444-4444-8444-444444444444'
  ) <> 2 then
    raise exception 'new user should have exactly 2 bounty_responses after merge';
  end if;
  if (
    select message from public.bounty_responses
    where user_id = '44444444-4444-4444-8444-444444444444' and bounty_id = 1
  ) <> 'new-resp' then
    raise exception 'conflicting bounty_response should keep new user message';
  end if;
  if exists (
    select 1 from public.bounty_responses
    where user_id = '33333333-3333-4333-8333-333333333333'
  ) then
    raise exception 'no bounty_responses should remain on old user';
  end if;

  -- public_profiles：保留 new-name，old 行删除。
  if (
    select name from public.public_profiles
    where id = '44444444-4444-4444-8444-444444444444'
  ) <> 'new-name' then
    raise exception 'public_profiles should keep new user row';
  end if;
  if exists (
    select 1 from public.public_profiles
    where id = '33333333-3333-4333-8333-333333333333'
  ) then
    raise exception 'old public_profiles row must be removed after merge';
  end if;
end
$$;

rollback;

