-- 0006_profile_rpc.sql — 补齐 _shared/db.ts 依赖的画像更新 RPC；重建线上缺失的注册建档触发器。

-- 画像更新：按调用者身份（RLS）合并 dims 并累加完成度，行不存在时创建。
-- edge functions 以用户 JWT 经 PostgREST rpc 调用，返回合并后的最新画像。
create or replace function public.apply_profile_update(p_dims jsonb, p_portrait_delta integer)
returns table (portrait_pct smallint, dims jsonb)
language sql
set search_path = ''
as $$
  insert into public.profiles as p (id, portrait_pct, dims)
  values (
    auth.uid(),
    least(100, greatest(0, coalesce(p_portrait_delta, 0)))::smallint,
    coalesce(p_dims, '{}'::jsonb)
  )
  on conflict (id) do update
    set portrait_pct =
          least(100, greatest(0, p.portrait_pct + coalesce(p_portrait_delta, 0)))::smallint,
        dims = coalesce(p.dims, '{}'::jsonb) || coalesce(excluded.dims, '{}'::jsonb)
  returning p.portrait_pct, p.dims;
$$;

revoke all on function public.apply_profile_update(jsonb, integer) from public, anon;
grant execute on function public.apply_profile_update(jsonb, integer) to authenticated;

-- 匿名/正式注册即建 profiles 行（与 0001 同义；线上库缺失，此处幂等重建）
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles (id) values (new.id) on conflict (id) do nothing;
  return new;
end;
$$;
revoke all on function public.handle_new_user() from public, anon, authenticated;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- 回填触发器缺失期间注册、尚无画像行的存量用户
insert into public.profiles (id)
select id from auth.users
on conflict (id) do nothing;
