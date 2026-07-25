-- 0011_diary_summary_cache.sql — 日记回顾结果缓存
-- diary-summary 每次打开日记页都会并发触发 month+year 两次 LLM 调用；
-- 按 (user_id, period, ref) 缓存最近一次成功结果，entry_count 一致时直接命中，
-- 新增日记后条数变化会触发重算并覆盖缓存。

create table if not exists diary_summary_cache (
  user_id     uuid not null references auth.users(id) on delete cascade,
  period      text not null check (period in ('month', 'year')),
  ref         text not null,
  entry_count int not null default 0,
  summary     jsonb not null default '{}',
  updated_at  timestamptz not null default now(),
  primary key (user_id, period, ref),
  constraint diary_summary_cache_summary_object
    check (jsonb_typeof(summary) = 'object')
);

-- ==================== RLS ====================
alter table diary_summary_cache enable row level security;
drop policy if exists "Users manage own diary summary cache" on diary_summary_cache;
create policy "Users manage own diary summary cache" on diary_summary_cache
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ==================== 触发器：updated_at ====================
-- touch_updated_at 已在 0001/0007 定义；此处仅挂载触发器。
drop trigger if exists trg_diary_summary_cache_touch on diary_summary_cache;
create trigger trg_diary_summary_cache_touch before update on diary_summary_cache
  for each row execute function public.touch_updated_at();

-- ==================== 权限授予 ====================
grant select, insert, update, delete on table diary_summary_cache to authenticated;
