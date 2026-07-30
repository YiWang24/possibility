-- funnel.sql — 核心付费漏斗各环节转化（docs/埋点方案.md §3.1 / §5）
--
-- 用途：回答「用户在哪一步掉下去的」。链路取自 §3.1 的价值链：
--   app_opened → chat_started → crossroad_formed → paywall_viewed → purchase_completed
-- 直接粘进 Supabase Dashboard → SQL Editor 执行（Dashboard 以 service_role 运行，
-- 绕过 app_events 的「任何人不可 select」策略，见 0017_app_events.sql）。
--
-- 改时间范围：只改下面 params 这一个 CTE。
--   最近 7 天：  now() - interval '7 days'  →  now()
--   指定自然月：'2026-07-01'::timestamptz   →  '2026-08-01'::timestamptz
--
-- 口径说明（与 §5 一致）：分子分母都是「窗口内做过该事件的去重用户数」，
-- 不要求事件按顺序发生。这在刚上线、单次会话内走完全程的量级下足够；
-- 若日后要严格时序漏斗，把 first_seen 里的 min(created_at) 两两比较即可
--（要求 step N 的首次时间 <= step N+1 的首次时间）。
-- 匿名用户也计入：App 启动即 signInAnonymously，任何时刻都有 user_id（§2）。

with params as (
  select
    now() - interval '30 days' as since,
    now()                      as until
),

-- 每个用户在每个漏斗步骤上的首次发生时间。
-- 服务端可确认的事实只在 app_events 写一份；这里仍按 user_id 去重，
-- 消解用户在窗口内多次重复完成同一漏斗步骤。
first_seen as (
  select
    e.user_id,
    e.event,
    min(e.created_at) as first_at
  from app_events e, params p
  where e.created_at >= p.since
    and e.created_at <  p.until
    and e.user_id is not null      -- 已注销用户去标识化后无法归因到人
    and e.event in (
      'app_opened',
      'chat_started',
      'crossroad_formed',
      'paywall_viewed',
      'purchase_completed'
    )
  group by e.user_id, e.event
),

steps as (
  select * from (values
    (1, 'app_opened',         '打开 App'),
    (2, 'chat_started',       '开始对话'),
    (3, 'crossroad_formed',   '澄清出岔路口'),
    (4, 'paywall_viewed',     '看到付费墙'),
    (5, 'purchase_completed', '完成支付')
  ) as t(step_no, event, label)
),

counted as (
  select
    s.step_no,
    s.label,
    s.event,
    count(distinct f.user_id) as users
  from steps s
  left join first_seen f on f.event = s.event
  group by s.step_no, s.label, s.event
)

select
  step_no                                     as "步骤",
  label                                       as "环节",
  users                                       as "用户数",
  -- 相对上一环节的转化：直接指出漏在哪一节。
  round(
    100.0 * users
      / nullif(lag(users) over (order by step_no), 0),
    2
  )                                           as "环节转化率(%)",
  -- 相对入口（app_opened）的全链路转化，对应 §5「漏斗全链路转化」。
  round(
    100.0 * users
      / nullif(first_value(users) over (order by step_no), 0),
    2
  )                                           as "累计转化率(%)"
from counted
order by step_no;

-- ============================================================
-- 附：§5 直接定义的两个比率（单独跑，便于贴周报）
-- ============================================================
-- 岔路口形成率 = crossroad_formed 用户数 / chat_started 用户数
-- 付费转化率   = purchase_completed 用户数 / paywall_viewed 用户数
--
-- with params as (select now() - interval '30 days' as since, now() as until),
-- u as (
--   select event, count(distinct user_id) as users
--   from app_events e, params p
--   where e.created_at >= p.since and e.created_at < p.until and e.user_id is not null
--   group by event
-- )
-- select
--   round(100.0 * max(users) filter (where event = 'crossroad_formed')
--       / nullif(max(users) filter (where event = 'chat_started'), 0), 2)   as "岔路口形成率(%)",
--   round(100.0 * max(users) filter (where event = 'purchase_completed')
--       / nullif(max(users) filter (where event = 'paywall_viewed'), 0), 2) as "付费转化率(%)"
-- from u;

-- ============================================================
-- 附：对话深度 —— 到岔路口需要几轮（§5）
-- ============================================================
-- 用 crossroad_formed.turn_count（服务端精确 count，不受 20 条历史上限影响，
-- 见 chat/index.ts:trackCrossroadFormed），而不是 chat_turn_completed.turn_index。
--
-- with params as (select now() - interval '30 days' as since, now() as until)
-- select
--   percentile_cont(0.5) within group (order by (props->>'turn_count')::int) as "轮次中位数",
--   percentile_cont(0.9) within group (order by (props->>'turn_count')::int) as "轮次 P90",
--   round(avg((props->>'time_to_form_ms')::numeric) / 1000, 1)              as "平均耗时(秒)",
--   count(*)                                                                as "样本数"
-- from app_events e, params p
-- where e.event = 'crossroad_formed'
--   and e.created_at >= p.since and e.created_at < p.until
--   and e.props ? 'turn_count';
