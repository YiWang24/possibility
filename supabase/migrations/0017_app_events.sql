-- 0017_app_events.sql — 埋点事实表（docs/埋点方案.md §4，三层架构的 Layer 1）
--
-- 为什么要自建这张表而不是只用 PostHog：PostHog Cloud 在国内网络可达性不稳定，
-- 上报失败即永久丢数；app_events 是兜底的事实表，也是唯一能和 match_results /
-- lab_choice_sets / unlocks 等业务表 JOIN 的地方。漏斗、留存、LLM 成本三套核心
-- 指标全部在这里算（查询见 supabase/analytics/*.sql）。

create table if not exists app_events (
  id          bigserial primary key,
  -- on delete set null：注销后事件保留但去标识化。
  -- 与 delete-account/index.ts 的口径一致——该函数只调 auth.admin.deleteUser，
  -- 靠外键动作清理业务表；app_events 按 §1 本就不含 PII（只有派生标量），
  -- 断开 user_id 即完成个人信息删除，同时保住历史聚合指标不塌陷
  -- （若用 cascade，任何一次注销都会让过去的漏斗/留存分母凭空缩水）。
  user_id     uuid references auth.users(id) on delete set null,
  event       text not null check (char_length(event) between 1 and 64),
  -- 只接受 JSON 对象：数组/标量会让 props->>'x' 全线失效，早失败好过分析时才发现。
  props       jsonb not null default '{}' check (jsonb_typeof(props) = 'object'),
  source      text not null check (source in ('ios', 'server')),
  session_id  text,
  app_version text,
  created_at  timestamptz not null default now()
);

-- 漏斗/留存按事件名切时间窗；单用户时间线用于算「到岔路口的轮次」等路径指标。
create index if not exists idx_app_events_event on app_events(event, created_at desc);
create index if not exists idx_app_events_user  on app_events(user_id, created_at desc);

-- ==================== RLS 策略 ====================
-- 与本项目其它用户表（0002/0013）不同：这里刻意「只给 insert，不给 select」。
-- 行为数据一旦可读，任何登录用户都能翻出自己（乃至构造条件试探他人）的完整行为
-- 时间线；而客户端只需要写入副本，从不需要读回。分析一律走 service_role /
-- Dashboard SQL（它们绕过 RLS）。
alter table app_events enable row level security;

drop policy if exists "Users insert own events" on app_events;
create policy "Users insert own events" on app_events
  for insert to authenticated with check (auth.uid() = user_id);

-- ==================== 权限授予 ====================
-- 必须先 revoke：Supabase 的初始化里有
--   alter default privileges in schema public grant all on tables
--     to postgres, anon, authenticated, service_role;
-- 新建的 public 表会自动拿到全量权限。不收回的话，「不可 select」就只剩
-- 「碰巧没有 select 策略」这一道防线——将来谁加一条宽松策略就全线泄露，
-- 而且 select 会静默返回 0 行而不是报错，出问题时根本察觉不到。
-- 收回之后，权限层和策略层两道都拦得住。
revoke all on table app_events from anon, authenticated;
revoke all on sequence app_events_id_seq from anon, authenticated;

-- 只 grant insert：没有 select 权限，PostgREST 的 .insert() 仍可写入
--（前提是客户端不要链 .select() 要求回传行，否则会 403）。
grant insert on table app_events to authenticated;
-- 只给 usage（nextval 所需），不给 select：sequence 的 last_value 会泄露全站事件总量。
grant usage on sequence app_events_id_seq to authenticated;

-- service_role 是唯一的分析入口（track.ts 写入、Dashboard SQL 读取），
-- 显式授予以免依赖默认权限的配置差异。它同时 bypassrls，不受上面的策略约束。
grant all on table app_events to service_role;
grant all on sequence app_events_id_seq to service_role;

-- ==================== 匿名账号合并需一并迁移事件 ====================
-- 0016 的 merge_anonymous_user 早于本表存在，未覆盖 app_events。
-- 不补这一行的后果正是 docs/埋点方案.md §2 警告的那条：Apple 登录会产生新
-- user_id，merge-anonymous 迁完业务数据后会 deleteUser 掉旧匿名账号，届时
-- on delete set null 会把匿名期的全部事件打成孤儿，「app_opened → 付费」
-- 完整漏斗当场断裂。
-- 本函数体与 0016 完全一致，仅新增 app_events 一行（迁移必须在 deleteUser 之前
-- 发生，而 merge-anonymous/index.ts 正是这个顺序）。
create or replace function public.merge_anonymous_user(p_old uuid, p_new uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_old is null or p_new is null or p_old = p_new then
    raise exception 'merge_anonymous_user: invalid arguments';
  end if;

  -- 画像：正式账号已有键优先，缺失键用匿名数据补齐；完成度取较大值
  update public.profiles n
     set dims = o.dims || n.dims,
         portrait_pct = greatest(n.portrait_pct, o.portrait_pct)
    from public.profiles o
   where n.id = p_new and o.id = p_old;
  delete from public.profiles where id = p_old;

  -- 公开主页：正式账号未建档则整行迁移，已建档则保留正式账号行
  update public.public_profiles set id = p_new
   where id = p_old
     and not exists (select 1 from public.public_profiles where id = p_new);
  delete from public.public_profiles where id = p_old;

  -- 无唯一约束（含 user_id）的表：直接重指向
  update public.conversations   set user_id = p_new where user_id = p_old;
  update public.diary_entries   set user_id = p_new where user_id = p_old;
  update public.simulations     set user_id = p_new where user_id = p_old;
  update public.bounties        set user_id = p_new where user_id = p_old;
  update public.kaleidoscope_draws set user_id = p_new where user_id = p_old;
  update public.persona_jobs    set user_id = p_new where user_id = p_old;
  update public.match_results   set user_id = p_new where user_id = p_old;
  update public.lab_choice_sets set user_id = p_new where user_id = p_old;
  update public.app_events      set user_id = p_new where user_id = p_old;

  -- 带 user_id 唯一约束的表：与正式账号冲突的匿名行丢弃，其余重指向
  delete from public.unlocks o
   where o.user_id = p_old
     and exists (select 1 from public.unlocks n
                  where n.user_id = p_new and n.kind = o.kind and n.target_id = o.target_id);
  update public.unlocks set user_id = p_new where user_id = p_old;

  delete from public.profile_dimensions o
   where o.user_id = p_old
     and exists (select 1 from public.profile_dimensions n
                  where n.user_id = p_new and n.dimension = o.dimension);
  update public.profile_dimensions set user_id = p_new where user_id = p_old;

  delete from public.card_game_results o
   where o.user_id = p_old
     and exists (select 1 from public.card_game_results n
                  where n.user_id = p_new and n.kind = o.kind);
  update public.card_game_results set user_id = p_new where user_id = p_old;

  delete from public.bounty_responses o
   where o.user_id = p_old
     and exists (select 1 from public.bounty_responses n
                  where n.user_id = p_new and n.bounty_id = o.bounty_id);
  update public.bounty_responses set user_id = p_new where user_id = p_old;

  delete from public.diary_summary_cache o
   where o.user_id = p_old
     and exists (select 1 from public.diary_summary_cache n
                  where n.user_id = p_new and n.period = o.period and n.ref = o.ref);
  update public.diary_summary_cache set user_id = p_new where user_id = p_old;
end;
$$;

revoke all on function public.merge_anonymous_user(uuid, uuid) from public, anon, authenticated;
grant execute on function public.merge_anonymous_user(uuid, uuid) to service_role;
