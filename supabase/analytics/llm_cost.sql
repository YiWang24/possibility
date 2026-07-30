-- llm_cost.sql — 按功能/模型的 token 消耗与单用户成本（§3.4 llm_request）
--
-- 用途：回答「哪个功能在烧钱、一个用户值多少钱」。数据源是 _shared/llm.ts 与
-- _shared/chat-stream.ts 在每次 DeepSeek 调用后上报的 llm_request 事件——
-- 注意是「每次上游调用一条」，重试也各记一条，所以这里的量等于账单量。
-- 直接粘进 Supabase Dashboard → SQL Editor 执行。
--
-- 改时间范围：只改下面 params 这一个 CTE。
--   最近 7 天：  now() - interval '7 days'  →  now()
--   指定自然月：'2026-07-01'::timestamptz   →  '2026-08-01'::timestamptz
--
-- ⚠️ 单价必须先填：model_prices 里的价格是占位 0，不填的话「成本」列恒为 0，
--    只有 token 数是真的。按 DeepSeek 现行价目表填入「每百万 token 单价（元）」。

with params as (
  select
    now() - interval '30 days' as since,
    now()                      as until
),

-- 单价表：本查询唯一需要人工维护的地方。调价后改这里，历史数据会按新价重算
--（要按当时价格结算就把单价随事件一起上报，当前不值得为此加字段）。
model_prices(model, input_per_1m, output_per_1m) as (
  values
    ('deepseek-v4-flash', 0.0::numeric, 0.0::numeric),  -- TODO: 填入实际单价（元 / 百万 token）
    ('deepseek-v4-pro',   0.0::numeric, 0.0::numeric)   -- TODO: 填入实际单价（元 / 百万 token）
),

calls as (
  select
    e.user_id,
    e.props->>'function'                as feature,
    e.props->>'model'                   as model,
    (e.props->>'prompt_tokens')::bigint as prompt_tokens,
    (e.props->>'completion_tokens')::bigint as completion_tokens,
    (e.props->>'latency_ms')::bigint    as latency_ms,
    (e.props->>'ok')::boolean           as ok,
    e.props->>'error_code'              as error_code
  from app_events e, params p
  where e.event = 'llm_request'
    and e.created_at >= p.since
    and e.created_at <  p.until
),

priced as (
  select
    c.*,
    coalesce(mp.input_per_1m,  0) * c.prompt_tokens     / 1e6
      + coalesce(mp.output_per_1m, 0) * c.completion_tokens / 1e6 as cost
  from calls c
  left join model_prices mp on mp.model = c.model
)

-- ==================== 1. 按功能 × 模型看消耗 ====================
select
  coalesce(feature, '(未知)')                    as "功能",
  coalesce(model, '(未知)')                      as "模型",
  count(*)                                       as "调用次数",
  count(*) filter (where not ok)                 as "失败次数",
  round(100.0 * count(*) filter (where not ok)
        / nullif(count(*), 0), 2)                as "失败率(%)",
  sum(prompt_tokens)                             as "输入 token",
  sum(completion_tokens)                         as "输出 token",
  round(sum(cost), 4)                            as "成本(元)",
  count(distinct user_id)                        as "涉及用户数",
  round(sum(cost) / nullif(count(distinct user_id), 0), 4) as "单用户成本(元)",
  round(avg(latency_ms))                         as "平均延迟(ms)",
  round(percentile_cont(0.95)
        within group (order by latency_ms))      as "P95 延迟(ms)"
from priced
group by feature, model
order by sum(cost) desc nulls last, count(*) desc;

-- ============================================================
-- 附：单用户 LLM 成本分布（判断毛利，§3.4）
-- ============================================================
-- 平均值会被少数重度用户拉高，看中位数和 P95 才知道定价是否覆盖得住成本。
--
-- with params as (select now() - interval '30 days' as since, now() as until),
-- model_prices(model, input_per_1m, output_per_1m) as (
--   values ('deepseek-v4-flash', 0.0::numeric, 0.0::numeric),
--          ('deepseek-v4-pro',   0.0::numeric, 0.0::numeric)
-- ),
-- per_user as (
--   select e.user_id,
--          sum(coalesce(mp.input_per_1m, 0)  * (e.props->>'prompt_tokens')::bigint     / 1e6
--            + coalesce(mp.output_per_1m, 0) * (e.props->>'completion_tokens')::bigint / 1e6) as cost
--   from app_events e
--   join params p on true
--   left join model_prices mp on mp.model = e.props->>'model'
--   where e.event = 'llm_request'
--     and e.created_at >= p.since and e.created_at < p.until
--     and e.user_id is not null
--   group by e.user_id
-- )
-- select count(*)                                                      as "用户数",
--        round(avg(cost), 4)                                           as "人均成本(元)",
--        round(percentile_cont(0.5) within group (order by cost), 4)   as "中位数(元)",
--        round(percentile_cont(0.95) within group (order by cost), 4)  as "P95(元)",
--        round(max(cost), 4)                                           as "最高(元)"
-- from per_user;

-- ============================================================
-- 附：付费用户毛利（§3.4）
-- ============================================================
-- 把上面的 per_user 与 purchase_completed 的收入相 join：
--
-- revenue as (
--   select user_id, sum((props->>'price')::numeric) as revenue
--   from app_events
--   where event = 'purchase_completed' and user_id is not null
--   group by user_id
-- )
-- select round(sum(r.revenue), 2)                       as "收入(元)",
--        round(sum(u.cost), 2)                          as "LLM 成本(元)",
--        round(100.0 * (sum(r.revenue) - sum(u.cost))
--              / nullif(sum(r.revenue), 0), 2)          as "毛利率(%)"
-- from revenue r left join per_user u on u.user_id = r.user_id;

-- ============================================================
-- 附：失败原因分布（error_code）
-- ============================================================
-- HTTP_429 说明被限流该加退避，AbortError 集中出现说明超时阈值偏紧。
--
-- with params as (select now() - interval '30 days' as since, now() as until)
-- select props->>'function' as "功能",
--        props->>'error_code' as "错误码",
--        count(*) as "次数"
-- from app_events e, params p
-- where e.event = 'llm_request'
--   and e.created_at >= p.since and e.created_at < p.until
--   and (e.props->>'ok')::boolean is false
-- group by 1, 2
-- order by 3 desc;
