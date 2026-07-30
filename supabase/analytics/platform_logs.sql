-- platform_logs.sql — Supabase 平台层日志面板（不接 Sentry 时的 0 成本错误定位）
--
-- ⚠️ 运行位置和本目录其它文件不同：这些查询跑在
--    Supabase Dashboard → Logs & Analytics → **Logs Explorer**（ClickHouse 引擎），
--    不是 SQL Editor。funnel/retention/llm_cost/observability.sql 查的是 app_events
--    这张 Postgres 业务表，跑在 SQL Editor；本文件查的是平台自带的 edge/postgres/
--    function/auth 日志，只有 Logs Explorer 能读。两者别混用。
--
-- 覆盖 Sentry / Grafana 通常负责的「出错了去哪看」：API 错误率、Edge Function 异常与
-- 延迟、Postgres 错误码、认证失败。全部是平台自带日志，0 成本、无外部依赖。
--
-- 语法说明（ClickHouse，2026-06 起为默认引擎）：
--   • 每行日志是 logs 表一行，用 source 列区分来源；结构化字段在 log_attributes map 里。
--   • 取值用 log_attributes['a.b.c']（保留完整点分键），数值套 toInt32OrZero(...) 兜底。
--   • 原始整行在 event_message，计数用 count() 而非 count(*)。
--   • 单次最多返回 1000 行；务必带 timestamp 过滤 + LIMIT，一次只查一个 source。
--
-- 也可以用 Supabase MCP 的 query_logs 工具在 CLI 里直接跑下面这些查询，开发期排错更快。


-- ============================================================
-- 0. 键发现 —— 用前必跑
-- ============================================================
-- 文档明确警告不要猜 log_attributes 键名：错键不会报错，只会静默返回空，让一条本该
-- 有结果的查询看起来「没数据」。换 source 或换项目排查前，先跑这段确认真实键名。
-- 把下面的 source 换成你要查的那个（edge_logs / postgres_logs / function_logs / ...）。
select arrayJoin(mapKeys(log_attributes)) as key, count() as n
from logs
where source = 'edge_logs'
  and timestamp >= now() - interval 24 hour
group by key
order by n desc
limit 100;


-- ============================================================
-- 1. API 错误率（edge_logs）—— 4xx/5xx 按 路径 × 状态码
-- ============================================================
-- 网关层第一现场：客户端拿到的非 2xx 都在这。5xx 优先（服务端故障），
-- 4xx 看是否集中在某条路径（鉴权/参数问题）。
select
  log_attributes['request.path']                          as path,
  toInt32OrZero(log_attributes['response.status_code'])   as status,
  count()                                                 as hits
from logs
where source = 'edge_logs'
  and timestamp >= now() - interval 24 hour
  and toInt32OrZero(log_attributes['response.status_code']) >= 400
group by path, status
order by hits desc
limit 100;


-- ============================================================
-- 2. Edge Function 异常与延迟（function_edge_logs）
-- ============================================================
-- 每个函数的调用量、失败数、P95 执行耗时。失败率突增或 P95 飙高，就去第 3 段按
-- request_id 捞对应的 runtime 报错。
select
  log_attributes['request.path']                          as fn,
  count()                                                 as calls,
  countIf(toInt32OrZero(log_attributes['response.status_code']) >= 500) as errors_5xx,
  round(quantile(0.95)(
    toInt32OrZero(log_attributes['execution_time_ms'])
  ))                                                      as p95_exec_ms
from logs
where source = 'function_edge_logs'
  and timestamp >= now() - interval 24 hour
group by fn
order by errors_5xx desc, p95_exec_ms desc
limit 100;


-- ============================================================
-- 3. 未捕获异常（function_logs）—— Sentry 的 0 成本替代入口
-- ============================================================
-- _shared/errors.ts 对「没预期到的异常」会 console.error 一条结构化 JSON：
--   {"level":"error","event":"unhandled_exception","request_id":..,"transaction":..,
--    "error_type":..}
-- 这些整行落在 function_logs 的 event_message。按下面捞到 request_id 后，可回到第 1/2 段
-- 或 edge_logs 用同一 request_id 串起整条请求链路（等价于 Sentry 的 trace 关联）。
-- 注意：出于隐私，正文不入日志，定位靠 error_type + transaction + request_id + 代码。
select
  timestamp,
  event_message
from logs
where source = 'function_logs'
  and timestamp >= now() - interval 24 hour
  and event_message like '%unhandled_exception%'
order by timestamp desc
limit 100;

-- 用已知 request_id 精确定位单次故障（把占位串换成响应体/前端截图里的 request_id）：
-- select timestamp, source, event_message
-- from logs
-- where timestamp >= now() - interval 24 hour
--   and event_message like '%<REQUEST_ID>%'
-- order by timestamp
-- limit 100;


-- ============================================================
-- 4. Postgres 错误（postgres_logs）—— 错误码分布
-- ============================================================
-- RLS / 迁移问题的第一现场。常见码：42501 权限不足（RLS 策略或 GRANT 缺失）、
-- 42P01 关系不存在（迁移顺序/表名）、23505 唯一约束冲突（重复写入）。
select
  log_attributes['parsed.sql_state_code']  as sql_state,
  log_attributes['parsed.error_severity']  as severity,
  log_attributes['parsed.user_name']       as role,
  count()                                  as hits
from logs
where source = 'postgres_logs'
  and timestamp >= now() - interval 24 hour
  and log_attributes['parsed.error_severity'] in ('ERROR', 'FATAL', 'PANIC')
group by sql_state, severity, role
order by hits desc
limit 100;

-- 看具体报错正文（event_message 才有完整语句/错误详情，parsed.* 里通常为空）：
-- select timestamp, log_attributes['parsed.sql_state_code'] as sql_state, event_message
-- from logs
-- where source = 'postgres_logs'
--   and timestamp >= now() - interval 24 hour
--   and log_attributes['parsed.sql_state_code'] = '42501'
-- order by timestamp desc
-- limit 50;


-- ============================================================
-- 5. 认证失败（auth_logs）
-- ============================================================
-- 登录/发码/验码失败按动作聚合。某类失败突增通常意味着短信通道异常、
-- 第三方登录配置变更或有人在撞验证码。
select
  log_attributes['path']                     as path,
  toInt32OrZero(log_attributes['status'])    as status,
  count()                                    as hits
from logs
where source = 'auth_logs'
  and timestamp >= now() - interval 24 hour
  and toInt32OrZero(log_attributes['status']) >= 400
group by path, status
order by hits desc
limit 100;
