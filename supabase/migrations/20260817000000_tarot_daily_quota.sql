create table if not exists public.tarot_daily_usage (
  user_id uuid not null references auth.users(id) on delete cascade,
  usage_date date not null,
  used_count integer not null default 0 check (used_count >= 0),
  share_reward_count integer not null default 0 check (share_reward_count >= 0),
  wechat_shared boolean not null default false,
  moments_shared boolean not null default false,
  xiaohongshu_shared boolean not null default false,
  weibo_shared boolean not null default false,
  other_shared boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, usage_date)
);

alter table public.tarot_daily_usage enable row level security;

create policy "users can read their own tarot quota"
  on public.tarot_daily_usage
  for select
  to authenticated
  using ((select auth.uid()) = user_id);

create or replace function public.get_tarot_quota()
returns table (
  usage_date date,
  used_count integer,
  shared_channels text[],
  share_reward_count integer,
  remaining integer
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_today date := (timezone('Asia/Shanghai', now()))::date;
begin
  if v_user_id is null then
    raise exception 'UNAUTHORIZED' using errcode = '28000';
  end if;

  insert into public.tarot_daily_usage (user_id, usage_date)
  values (v_user_id, v_today)
  on conflict (user_id, usage_date) do nothing;

  return query
  select
    row.usage_date,
    row.used_count,
    array_remove(array[
      case when row.wechat_shared then 'wechat'::text end,
      case when row.moments_shared then 'moments'::text end,
      case when row.xiaohongshu_shared then 'xiaohongshu'::text end,
      case when row.weibo_shared then 'weibo'::text end,
      case when row.other_shared then 'other'::text end
    ], null),
    row.share_reward_count,
    greatest(0, 3 + row.share_reward_count - row.used_count)::integer
  from public.tarot_daily_usage as row
  where row.user_id = v_user_id and row.usage_date = v_today;
end;
$$;

create or replace function public.consume_tarot_attempt()
returns table (
  allowed boolean,
  usage_date date,
  used_count integer,
  shared_channels text[],
  share_reward_count integer,
  remaining integer
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_today date := (timezone('Asia/Shanghai', now()))::date;
  v_allowed boolean := false;
begin
  if v_user_id is null then
    raise exception 'UNAUTHORIZED' using errcode = '28000';
  end if;

  insert into public.tarot_daily_usage (user_id, usage_date)
  values (v_user_id, v_today)
  on conflict (user_id, usage_date) do nothing;

  update public.tarot_daily_usage as row
  set used_count = row.used_count + 1,
      updated_at = now()
  where row.user_id = v_user_id
    and row.usage_date = v_today
    and row.used_count < 3 + row.share_reward_count
  returning true into v_allowed;

  return query
  select
    coalesce(v_allowed, false),
    row.usage_date,
    row.used_count,
    array_remove(array[
      case when row.wechat_shared then 'wechat'::text end,
      case when row.moments_shared then 'moments'::text end,
      case when row.xiaohongshu_shared then 'xiaohongshu'::text end,
      case when row.weibo_shared then 'weibo'::text end,
      case when row.other_shared then 'other'::text end
    ], null),
    row.share_reward_count,
    greatest(0, 3 + row.share_reward_count - row.used_count)::integer
  from public.tarot_daily_usage as row
  where row.user_id = v_user_id and row.usage_date = v_today;
end;
$$;

create or replace function public.claim_tarot_share_reward(p_channel text)
returns table (
  claimed boolean,
  usage_date date,
  used_count integer,
  shared_channels text[],
  share_reward_count integer,
  remaining integer
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_today date := (timezone('Asia/Shanghai', now()))::date;
  v_claimed boolean := false;
begin
  if v_user_id is null then
    raise exception 'UNAUTHORIZED' using errcode = '28000';
  end if;
  if p_channel not in ('wechat', 'moments', 'xiaohongshu', 'weibo', 'other') then
    raise exception 'INVALID_CHANNEL' using errcode = '22023';
  end if;

  insert into public.tarot_daily_usage (user_id, usage_date)
  values (v_user_id, v_today)
  on conflict (user_id, usage_date) do nothing;

  update public.tarot_daily_usage as row
  set share_reward_count = row.share_reward_count + 1,
      wechat_shared = row.wechat_shared or p_channel = 'wechat',
      moments_shared = row.moments_shared or p_channel = 'moments',
      xiaohongshu_shared = row.xiaohongshu_shared or p_channel = 'xiaohongshu',
      weibo_shared = row.weibo_shared or p_channel = 'weibo',
      other_shared = row.other_shared or p_channel = 'other',
      updated_at = now()
  where row.user_id = v_user_id
    and row.usage_date = v_today
  returning true into v_claimed;

  return query
  select
    coalesce(v_claimed, false),
    row.usage_date,
    row.used_count,
    array_remove(array[
      case when row.wechat_shared then 'wechat'::text end,
      case when row.moments_shared then 'moments'::text end,
      case when row.xiaohongshu_shared then 'xiaohongshu'::text end,
      case when row.weibo_shared then 'weibo'::text end,
      case when row.other_shared then 'other'::text end
    ], null),
    row.share_reward_count,
    greatest(0, 3 + row.share_reward_count - row.used_count)::integer
  from public.tarot_daily_usage as row
  where row.user_id = v_user_id and row.usage_date = v_today;
end;
$$;

revoke all on function public.get_tarot_quota() from public;
revoke all on function public.consume_tarot_attempt() from public;
revoke all on function public.claim_tarot_share_reward(text) from public;
grant execute on function public.get_tarot_quota() to authenticated;
grant execute on function public.consume_tarot_attempt() to authenticated;
grant execute on function public.claim_tarot_share_reward(text) to authenticated;
