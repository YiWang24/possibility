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

-- ==================== 1. 内容表：匿名既读不到也写不进 ====================
-- 20260730170500 起四张内容表收成 authenticated 专属。anon 角色对应的不是「匿名用户」
-- （匿名登录已停用），而是「只带客户端里那把 publishable key、没有任何用户 JWT」的裸
-- 请求 —— 以前它能直接拉走 traveler_details.full_text 这类标着付费解锁的正文。
set local role anon;
do $$
begin
  -- 读：策略（to authenticated）与表授权（revoke select from anon）两道闸都关着，
  -- 所以连 select 都过不去，报的是 42501 insufficient_privilege 而非返回 0 行。
  begin
    perform count(*) from public.travelers;
    raise exception 'anon read of travelers unexpectedly succeeded';
  exception
    when insufficient_privilege then null;
  end;
  begin
    perform count(*) from public.traveler_details;
    raise exception 'anon read of traveler_details unexpectedly succeeded';
  exception
    when insufficient_privilege then null;
  end;
  begin
    perform count(*) from public.traveler_services;
    raise exception 'anon read of traveler_services unexpectedly succeeded';
  exception
    when insufficient_privilege then null;
  end;
  begin
    perform count(*) from public.bounties;
    raise exception 'anon read of bounties unexpectedly succeeded';
  exception
    when insufficient_privilege then null;
  end;

  -- 匿名写入内容表必须被拒。
  begin
    insert into public.bounties (question, reward, responses)
    values ('forbidden', '0', '0');
    raise exception 'anon content write unexpectedly succeeded';
  exception
    when insufficient_privilege then null;
  end;

  -- 埋点表（0017）只 grant 给 authenticated：未登录角色一律写不进。
  begin
    insert into public.app_events (event, source) values ('app_opened', 'ios');
    raise exception 'anon app_events write unexpectedly succeeded';
  exception
    when insufficient_privilege then null;
  end;

end
$$;
reset role;

-- ==================== 1b. 已登录用户：内容表照常可读（种子数量钳制） ====================
-- 收口只针对 anon；登录后内容必须一条不少，否则登录墙就把正常用户也挡住了。
select set_config(
  'request.jwt.claim.sub',
  '11111111-1111-4111-8111-111111111111',
  true
);
set local role authenticated;
do $$
begin
  if (select count(*) from public.travelers) <> 12 then
    raise exception 'authenticated should read all 12 seeded travelers';
  end if;
  if (select count(*) from public.traveler_details) <> 12 then
    raise exception 'authenticated should read all 12 traveler_details';
  end if;
  if (select count(*) from public.traveler_services) <> 10 then
    raise exception 'authenticated should read all 10 traveler_services';
  end if;
  if (select count(*) from public.bounties) <> 3 then
    raise exception 'authenticated should read all 3 seeded bounties';
  end if;
  -- 相似旅人（万花筒「相似」模式候选）应恰为 id 1,2,4,5。
  if (select count(*) from public.travelers where is_similar) <> 4 then
    raise exception 'expected exactly 4 similar travelers in seed';
  end if;
end
$$;
reset role;

-- ==================== 2. 用户 A：画像完成度 RPC（钳制） ====================
select set_config(
  'request.jwt.claim.sub',
  '11111111-1111-4111-8111-111111111111',
  true
);
set local role authenticated;

do $$
declare
  v_pct  smallint;
begin
  select portrait_pct into v_pct
  from public.update_profile_progress(30);
  if v_pct <> 30 then
    raise exception 'rpc first call portrait expected 30, got %', v_pct;
  end if;

  select portrait_pct into v_pct
  from public.update_profile_progress(90);
  if v_pct <> 100 then
    raise exception 'rpc portrait should clamp to 100, got %', v_pct;
  end if;

  select portrait_pct into v_pct
  from public.update_profile_progress(-200);
  if v_pct <> 0 then
    raise exception 'rpc portrait should clamp to 0, got %', v_pct;
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

select * from public.replace_profile_dimension(
  'skill',
  array['编程', '写作'],
  'manual',
  null,
  1,
  true,
  0,
  0
);

insert into public.card_game_results (user_id, kind, final_cards, rounds)
values (
  '11111111-1111-4111-8111-111111111111',
  'life',
  '[{"id":"c1","name":"\u7a33\u5b9a\u6536\u5165"}]'::jsonb,
  3
);

select public.save_public_profile(
  '{"profile_version":2,"name":"测试用户A","quote":"人生如棋"}'::jsonb
);

select * from public.set_profile_fact_visibility(
  (
    select id from public.profile_facts
     where dimension = 'skill' and value = '编程'
  ),
  'public',
  1
);

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

-- 埋点事实表（0017）：客户端事件副本由 iOS 用登录态直写，source 标 'ios'。
insert into public.app_events (user_id, event, props, source, session_id, app_version)
values (
  '11111111-1111-4111-8111-111111111111',
  'chat_started',
  '{"entry_point":"home"}'::jsonb,
  'ios',
  'sess-1',
  '1.0.0'
);

-- 埋点表的安全边界：只能 insert 自己的行，任何人都不可 select（0017 的核心约束——
-- 行为数据一旦可读，登录用户就能翻出完整行为时间线）。
do $$
begin
  -- 读取必须被拒：既无 select 策略，也无 select 权限。
  begin
    perform count(*) from public.app_events;
    raise exception 'app_events select unexpectedly succeeded';
  exception when insufficient_privilege then null; end;

  -- 冒充他人写入必须被拒（RLS with check: auth.uid() = user_id）。
  begin
    insert into public.app_events (user_id, event, source)
    values ('22222222-2222-4222-8222-222222222222', 'app_opened', 'ios');
    raise exception 'cross-user app_events insert unexpectedly succeeded';
  exception when insufficient_privilege then null; end;

  -- user_id 留空同样被拒：auth.uid() = null 不成立，避免匿名事件混入。
  begin
    insert into public.app_events (event, source) values ('app_opened', 'ios');
    raise exception 'null-user app_events insert unexpectedly succeeded';
  exception when insufficient_privilege then null; end;

  -- 客户端不能伪造服务端事实；否则 crossroad_formed / llm_request 等指标毫无可信度。
  begin
    insert into public.app_events (user_id, event, source)
    values ('11111111-1111-4111-8111-111111111111', 'llm_request', 'server');
    raise exception 'authenticated client forged a server event';
  exception when insufficient_privilege then null; end;

  -- 即使把 source 写成 ios，也不能伪造明确由服务端权威产生的业务事实。
  begin
    insert into public.app_events (user_id, event, source)
    values (
      '11111111-1111-4111-8111-111111111111',
      'diary_created',
      'ios'
    );
    raise exception 'authenticated client forged a server-authoritative event';
  exception when insufficient_privilege then null; end;

  -- event_id 是重试幂等键：相同事件重放只能保留一行。
  insert into public.app_events (event_id, user_id, event, source)
  values (
    'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee',
    '11111111-1111-4111-8111-111111111111',
    'app_opened',
    'ios'
  );
  begin
    insert into public.app_events (event_id, user_id, event, source)
    values (
      'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee',
      '11111111-1111-4111-8111-111111111111',
      'app_opened',
      'ios'
    );
    raise exception 'duplicate event_id unexpectedly succeeded';
  exception when unique_violation then null; end;

  -- update / delete 无策略也无权限：事件一经写入不可篡改。
  begin
    update public.app_events set event = 'hacked';
    raise exception 'app_events update unexpectedly succeeded';
  exception when insufficient_privilege then null; end;

  begin
    delete from public.app_events;
    raise exception 'app_events delete unexpectedly succeeded';
  exception when insufficient_privilege then null; end;

  -- source 白名单：只允许 ios / server。
  begin
    insert into public.app_events (user_id, event, source)
    values ('11111111-1111-4111-8111-111111111111', 'app_opened', 'web');
    raise exception 'app_events.source check not enforced';
  exception
    when check_violation or insufficient_privilege then null;
  end;

  -- props 必须是 JSON 对象：数组会让 props->>'x' 全线失效。
  begin
    insert into public.app_events (user_id, event, props, source)
    values (
      '11111111-1111-4111-8111-111111111111', 'app_opened', '[]'::jsonb, 'ios'
    );
    raise exception 'app_events.props object check not enforced';
  exception when check_violation then null; end;
end
$$;
reset role;

-- 反向确认分析路径没被上面的收权连坐：service_role 必须读得到，
-- 否则 supabase/analytics/*.sql 和 Dashboard 查询会全线失效。
set local role service_role;
do $$
begin
  if (select count(*) from public.app_events) < 1 then
    raise exception 'service_role must be able to read app_events for analytics';
  end if;
end
$$;
reset role;

-- 回到用户 A 的身份继续后续用例。
select set_config(
  'request.jwt.claim.sub',
  '11111111-1111-4111-8111-111111111111',
  true
);
set local role authenticated;

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

-- ==================== 4. 最终画像表结构 ====================
do $$
begin
  if to_regclass('public.profile_dimensions') is not null then
    raise exception 'profile_dimensions compatibility table must not exist';
  end if;
  if exists (
    select 1 from information_schema.columns
     where table_schema = 'public'
       and table_name = 'profiles'
       and column_name = 'dims'
  ) then
    raise exception 'profiles.dims compatibility column must not exist';
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

  -- 事实可见性只能是 public/private。
  begin
    perform * from public.set_profile_fact_visibility(
      (
        select id from public.profile_facts
         where dimension = 'skill' and value = '写作'
      ),
      'friends',
      2
    );
    raise exception 'profile visibility check not enforced';
  exception when invalid_parameter_value then null; end;

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
  if (select count(*) from public.profile_facts) <> 0 then
    raise exception 'cross-user profile_facts leaked';
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
    insert into public.profile_facts (
      user_id, dimension, value, normalized_value, source
    ) values (
      '11111111-1111-4111-8111-111111111111',
      'love',
      '音乐',
      '音乐',
      'manual'
    );
    raise exception 'direct fact write unexpectedly succeeded';
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
  begin
    update public.public_profiles set name = 'hacked'
    where id = '11111111-1111-4111-8111-111111111111';
    raise exception 'published profile direct update unexpectedly succeeded';
  exception when insufficient_privilege then null; end;

  update public.bounties set detail = 'hacked'
  where user_id = '11111111-1111-4111-8111-111111111111';
  if found then
    raise exception 'cross-user bounty update unexpectedly succeeded';
  end if;
end
$$;

-- 完成度 RPC 以调用者身份运行：B 调用只应影响 B 自己，A 不受影响。
do $$
declare
  v_pct smallint;
begin
  select portrait_pct into v_pct
  from public.update_profile_progress(15);
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
-- profiles 只保留完成度与画像修订号；画像内容由 profile_facts 承载。
update public.profiles
  set portrait_pct = 40, profile_revision = 3
  where id = '33333333-3333-4333-8333-333333333333';
update public.profiles
  set portrait_pct = 10, profile_revision = 5
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

-- profile_facts：相同原子事实冲突时保留正式账号行，其他事实迁入。
insert into public.profile_facts (
  user_id, dimension, value, normalized_value, source, source_ref
)
values
  ('33333333-3333-4333-8333-333333333333', 'skill', 'shared', 'shared', 'manual', 'old'),
  ('33333333-3333-4333-8333-333333333333', 'love', '信任', '信任', 'manual', 'old'),
  ('44444444-4444-4444-8444-444444444444', 'skill', 'shared', 'shared', 'manual', 'new');

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

-- 公开发布表：两账号均建档 → 合并应保留 new、删除 old。
insert into public.public_profiles (id, name)
values
  ('33333333-3333-4333-8333-333333333333', 'old-name'),
  ('44444444-4444-4444-8444-444444444444', 'new-name');

-- app_events（0017 补进合并函数）：匿名期事件必须跟着迁到正式账号。
-- 不迁的话，merge-anonymous 随后 deleteUser 会把它们 set null 成孤儿事件，
-- 「app_opened → 付费」完整漏斗直接断裂（docs/engineering/埋点方案.md §2）。
insert into public.app_events (user_id, event, source)
values
  ('33333333-3333-4333-8333-333333333333', 'app_opened', 'ios'),
  ('33333333-3333-4333-8333-333333333333', 'chat_started', 'ios');

-- 执行迁移（postgres 拥有 execute 权限）。
select public.merge_anonymous_user(
  '33333333-3333-4333-8333-333333333333',
  '44444444-4444-4444-8444-444444444444'
);

do $$
declare
  v_pct  smallint;
  v_profile_revision bigint;
begin
  -- profiles：完成度取较大值，修订号在两边最大值上递增，old 行删除。
  select portrait_pct, profile_revision
    into v_pct, v_profile_revision
  from public.profiles where id = '44444444-4444-4444-8444-444444444444';
  if v_pct <> 40 then
    raise exception 'merge portrait_pct should be greatest=40, got %', v_pct;
  end if;
  if v_profile_revision <> 6 then
    raise exception
      'merge revision should advance from max value, got %',
      v_profile_revision;
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

  -- profile_facts：重复 skill 保留 new 来源，love 迁入 → new 恰 2 行。
  if (
    select count(*) from public.profile_facts
    where user_id = '44444444-4444-4444-8444-444444444444'
  ) <> 2 then
    raise exception 'new user should have exactly 2 profile facts after merge';
  end if;
  if (
    select source_ref from public.profile_facts
    where user_id = '44444444-4444-4444-8444-444444444444'
      and dimension = 'skill'
      and value = 'shared'
  ) <> 'new' then
    raise exception 'conflicting profile fact should keep new user row';
  end if;
  if exists (
    select 1 from public.profile_facts
    where user_id = '33333333-3333-4333-8333-333333333333'
  ) then
    raise exception 'no profile facts should remain on old user';
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

  -- app_events：匿名期两条事件都归到正式账号，旧账号无残留。
  if (
    select count(*) from public.app_events
    where user_id = '44444444-4444-4444-8444-444444444444'
  ) <> 2 then
    raise exception 'anonymous app_events must be reassigned to the new user';
  end if;
  if exists (
    select 1 from public.app_events
    where user_id = '33333333-3333-4333-8333-333333333333'
  ) then
    raise exception 'no app_events should remain on old user';
  end if;
end
$$;

-- 模拟 merge SQL 已完成、deleteUser 尚未执行时才抵达数据库的旧 JWT 事件。
-- BEFORE INSERT trigger 应把 old user_id 改挂到 new；alias 表本身仍不可读。
select set_config(
  'request.jwt.claim.sub',
  '33333333-3333-4333-8333-333333333333',
  true
);
set local role authenticated;
insert into public.app_events (user_id, event, source)
values (
  '33333333-3333-4333-8333-333333333333',
  'app_opened',
  'ios'
);
do $$
begin
  begin
    perform count(*) from public.app_event_user_aliases;
    raise exception 'authenticated must not read app_event_user_aliases';
  exception when insufficient_privilege then null; end;
end
$$;
reset role;

do $$
begin
  if (
    select count(*) from public.app_events
    where user_id = '44444444-4444-4444-8444-444444444444'
  ) <> 3 then
    raise exception 'late anonymous app_event must be redirected to the new user';
  end if;
  if exists (
    select 1 from public.app_events
    where user_id = '33333333-3333-4333-8333-333333333333'
  ) then
    raise exception 'late anonymous app_event remained on old user';
  end if;
end
$$;

-- ==================== 9. app_events：注销后去标识化而非删除 ====================
-- 0017 用 on delete set null（业务表清一色 cascade）。这是刻意的差异：
-- 事件按 §1 不含 PII，断开 user_id 即完成个人信息删除；若跟着 cascade，
-- 每一次注销都会让历史漏斗/留存的分母凭空缩水。
insert into auth.users (id, role, created_at, updated_at)
values ('55555555-5555-4555-8555-555555555555', 'authenticated', now(), now());

insert into public.app_events (user_id, event, source)
values ('55555555-5555-4555-8555-555555555555', 'purchase_completed', 'server');

delete from auth.users where id = '55555555-5555-4555-8555-555555555555';

do $$
begin
  -- 事件行仍在，但已不指向任何人。
  if (
    select count(*) from public.app_events
    where event = 'purchase_completed' and user_id is null
  ) <> 1 then
    raise exception
      'app_events must survive account deletion with user_id set to null';
  end if;
  -- 业务表的对照组：注销后应被 cascade 清空。
  if exists (
    select 1 from public.profiles
    where id = '55555555-5555-4555-8555-555555555555'
  ) then
    raise exception 'profiles should cascade away on account deletion';
  end if;
end
$$;

rollback;

-- Keep the profile privacy contract in the same database test entrypoint.
\ir profile_privacy_rls_test.sql
