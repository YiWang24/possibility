-- observability.sql — 埋点采集与 LLM 运行健康
--
-- 直接在 Supabase Dashboard SQL Editor 运行。每段查询独立，可分别保存成面板；
-- 时间窗/阈值是上线初值，有一周真实基线后再校准。

-- 1. 采集心跳：生产有活跃用户时，核心 source 超过 30 分钟没有新事件应告警。
select
  source,
  count(*) filter (where created_at >= now() - interval '24 hours') as events_24h,
  max(created_at) as latest_event_at,
  extract(epoch from (now() - max(created_at)))::bigint as lag_seconds
from app_events
group by source
order by source;

-- 2. 近期无主事件。正常注销会产生少量 NULL；突增通常代表匿名合并竞态或错误 user_id。
select
  count(*) as total_24h,
  count(*) filter (where user_id is null) as orphaned_24h,
  round(
    100.0 * count(*) filter (where user_id is null) / nullif(count(*), 0),
    2
  ) as orphaned_pct
from app_events
where created_at >= now() - interval '24 hours';

-- 3. LLM SLO：15 分钟失败率 >10% 或 P95 >45s 作为初始告警线。
select
  props->>'function' as function,
  count(*) as calls,
  count(*) filter (where not (props->>'ok')::boolean) as failures,
  round(
    100.0 * count(*) filter (where not (props->>'ok')::boolean)
      / nullif(count(*), 0),
    2
  ) as failure_pct,
  round(percentile_cont(0.95) within group (
    order by (props->>'latency_ms')::bigint
  )) as p95_latency_ms,
  max(created_at) as latest_call_at
from app_events
where event = 'llm_request'
  and created_at >= now() - interval '15 minutes'
group by props->>'function'
order by failure_pct desc, p95_latency_ms desc;

-- 4. 近似重复：服务端权威事件同用户、同秒出现多行时需调查调用点是否双写。
-- chat 极端情况下可在一秒内完成两轮，故这里只作诊断，不自动删数据。
select
  user_id,
  event,
  date_trunc('second', created_at) as second_bucket,
  count(*) as copies,
  array_agg(source order by source) as sources
from app_events
where event in (
  'chat_turn_completed', 'diary_created', 'identity_merged',
  'lab_choices_requested', 'simulation_requested'
)
  and created_at >= now() - interval '24 hours'
group by user_id, event, date_trunc('second', created_at)
having count(*) > 1
order by second_bucket desc;
