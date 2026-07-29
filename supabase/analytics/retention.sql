-- retention.sql — 按首次 app_opened 分 cohort 的 D1 / D7 / D30 留存（§5）
--
-- 用途：回答「新用户还回不回来」。同一批人（同一天首次打开 App）在第 1/7/30 天
-- 是否又打开过 App。直接粘进 Supabase Dashboard → SQL Editor 执行。
--
-- 改时间范围：只改下面 params 这一个 CTE。
--   cohort_since / cohort_until 限定「哪几天的新用户」进入统计；
--   注意 D30 需要 cohort 日之后满 30 天才有意义，cohort_until 建议留出观察期
--   （例：看 D30 就把 cohort_until 设成 now() - interval '30 days'）。
--   时区：Postgres 默认 UTC；要按北京时间分天，把 date_trunc 换成
--   date_trunc('day', created_at at time zone 'Asia/Shanghai')。
--
-- 口径：经典留存（classic retention）——D1 指「恰好在第 1 天」回来，不是「第 1 天起
-- 任意一天」。分母是 cohort 全员，未满观察期的 cohort 会天然偏低，看的时候注意
-- 「新增用户数」那列的日期是否已经满 N 天。滚动留存（第 N 天及以后回来过）见文末。

with params as (
  select
    (now() - interval '60 days')::date as cohort_since,
    (now() - interval '1 day')::date   as cohort_until
),

-- 每个用户的首次打开日（app_opened 由 iOS 在 bootstrap 完成时上报，§3.1）
first_open as (
  select
    user_id,
    min(created_at)                     as first_at,
    date_trunc('day', min(created_at))  as cohort_day
  from app_events
  where event = 'app_opened'
    and user_id is not null      -- 已注销用户去标识化后无法归因到 cohort
  group by user_id
),

cohorts as (
  select f.user_id, f.cohort_day
  from first_open f, params p
  where f.cohort_day >= p.cohort_since
    and f.cohort_day <= p.cohort_until
),

-- 每个用户「首开后第几天」有过活跃（同样以 app_opened 为活跃口径）
activity as (
  select distinct
    c.user_id,
    c.cohort_day,
    (date_trunc('day', e.created_at) - c.cohort_day) as day_offset
  from cohorts c
  join app_events e
    on e.user_id = c.user_id
   and e.event   = 'app_opened'
)

select
  cohort_day::date                                  as "首开日期",
  count(distinct user_id)                           as "新增用户数",
  count(distinct user_id) filter (
    where day_offset = interval '1 day'
  )                                                 as "D1 回访",
  round(100.0 * count(distinct user_id) filter (
    where day_offset = interval '1 day'
  ) / nullif(count(distinct user_id), 0), 2)        as "D1 留存(%)",
  count(distinct user_id) filter (
    where day_offset = interval '7 days'
  )                                                 as "D7 回访",
  round(100.0 * count(distinct user_id) filter (
    where day_offset = interval '7 days'
  ) / nullif(count(distinct user_id), 0), 2)        as "D7 留存(%)",
  count(distinct user_id) filter (
    where day_offset = interval '30 days'
  )                                                 as "D30 回访",
  round(100.0 * count(distinct user_id) filter (
    where day_offset = interval '30 days'
  ) / nullif(count(distinct user_id), 0), 2)        as "D30 留存(%)"
from activity
group by cohort_day
order by cohort_day desc;

-- ============================================================
-- 附：滚动留存（第 N 天「及以后」还回来过）
-- ============================================================
-- 经典留存在日活不高的产品上噪声很大（用户只是隔天没开）。滚动留存更稳，
-- 适合看趋势；把上面 `day_offset = interval 'N days'` 换成 `>=` 即可：
--
--   count(distinct user_id) filter (where day_offset >= interval '7 days')
--
-- ============================================================
-- 附：全体 cohort 汇总一行（贴周报用）
-- ============================================================
-- 把上面的 `group by cohort_day` 去掉、`cohort_day::date as "首开日期"` 一列删掉，
-- 即得到所选窗口内全部新用户的合并留存。
