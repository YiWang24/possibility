-- 支持人生实验室按天/月推演，同时保留 years 兼容旧客户端与历史数据。
alter table public.simulations
  add column if not exists time_horizon text;

update public.simulations
set time_horizon = years::text || '年'
where time_horizon is null;

alter table public.simulations
  alter column time_horizon set default '1年',
  alter column time_horizon set not null;

alter table public.simulations
  drop constraint if exists simulations_time_horizon_check;

alter table public.simulations
  add constraint simulations_time_horizon_check
  check (
    time_horizon in (
      '7天', '30天', '3个月', '6个月',
      '1年', '2年', '3年', '4年', '5年',
      '6年', '7年', '8年', '9年', '10年'
    )
  );
