-- 0008_persona_lab.sql — 动态画像异步任务 + 推演底线分析字段
-- 对应原型 AI_INTEGRATION_PROMPTS.dynamicPersona / labSimulationResult。

-- ==================== 推演表增强：底线压力测试 ====================
-- labSimulationResult.bottomLineAnalysis：{is_acceptable, risks, protective_conditions}
alter table simulations
  add column if not exists bottom_line jsonb not null default '{}';

alter table simulations
  drop constraint if exists simulations_bottom_line_object;
alter table simulations
  add constraint simulations_bottom_line_object
  check (jsonb_typeof(bottom_line) = 'object');

-- ==================== 动态画像异步任务 ====================
-- 原型建议：POST 创建生成任务返回 jobId，再轮询/SSE 获取 status 与最终 persona。
-- persona：{seed, shape, hue, lobes, summary, model_version}
create table if not exists persona_jobs (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users(id) on delete cascade,
  status        text not null default 'queued'
                  check (status in ('queued','processing','completed','failed')),
  persona       jsonb not null default '{}',
  model_version text not null default '',
  error         text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  constraint persona_jobs_persona_object check (jsonb_typeof(persona) = 'object')
);
create index if not exists idx_persona_jobs_user
  on persona_jobs(user_id, created_at desc);

-- ==================== RLS ====================
alter table persona_jobs enable row level security;
drop policy if exists "Users manage own persona jobs" on persona_jobs;
create policy "Users manage own persona jobs" on persona_jobs
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ==================== 触发器：updated_at ====================
-- touch_updated_at 已在 0001/0007 定义；此处仅挂载触发器。
drop trigger if exists trg_persona_jobs_touch on persona_jobs;
create trigger trg_persona_jobs_touch before update on persona_jobs
  for each row execute function public.touch_updated_at();

-- ==================== 权限授予 ====================
grant select, insert, update, delete on table persona_jobs to authenticated;
