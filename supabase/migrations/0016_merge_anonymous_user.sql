-- 0016_merge_anonymous_user.sql — 匿名账号数据迁移（Apple 登录产生新账号时调用）
--
-- 手机号转正走 updateUser 原地链接 identity，user_id 不变、无需迁移；
-- Apple signInWithIdToken 会创建/命中另一个正式账号，旧匿名账号的业务数据
-- 由 merge-anonymous Edge Function（service role）调本函数事务性重指向，
-- 随后 auth.admin.deleteUser 删除匿名用户（profiles 等 cascade 兜底清理）。
--
-- 仅 service_role 可执行：revoke public/anon/authenticated。

create or replace function public.merge_anonymous_user(p_old uuid, p_new uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_old is null or p_new is null or p_old = p_new then
    raise exception 'merge_anonymous_user: invalid arguments';
  end if;

  -- 画像：正式账号已有键优先，缺失键用匿名数据补齐；完成度取较大值
  update public.profiles n
     set dims = o.dims || n.dims,
         portrait_pct = greatest(n.portrait_pct, o.portrait_pct)
    from public.profiles o
   where n.id = p_new and o.id = p_old;
  delete from public.profiles where id = p_old;

  -- 公开主页：正式账号未建档则整行迁移，已建档则保留正式账号行
  update public.public_profiles set id = p_new
   where id = p_old
     and not exists (select 1 from public.public_profiles where id = p_new);
  delete from public.public_profiles where id = p_old;

  -- 无唯一约束（含 user_id）的表：直接重指向
  update public.conversations   set user_id = p_new where user_id = p_old;
  update public.diary_entries   set user_id = p_new where user_id = p_old;
  update public.simulations     set user_id = p_new where user_id = p_old;
  update public.bounties        set user_id = p_new where user_id = p_old;
  update public.kaleidoscope_draws set user_id = p_new where user_id = p_old;
  update public.persona_jobs    set user_id = p_new where user_id = p_old;
  update public.match_results   set user_id = p_new where user_id = p_old;
  update public.lab_choice_sets set user_id = p_new where user_id = p_old;

  -- 带 user_id 唯一约束的表：与正式账号冲突的匿名行丢弃，其余重指向
  delete from public.unlocks o
   where o.user_id = p_old
     and exists (select 1 from public.unlocks n
                  where n.user_id = p_new and n.kind = o.kind and n.target_id = o.target_id);
  update public.unlocks set user_id = p_new where user_id = p_old;

  delete from public.profile_dimensions o
   where o.user_id = p_old
     and exists (select 1 from public.profile_dimensions n
                  where n.user_id = p_new and n.dimension = o.dimension);
  update public.profile_dimensions set user_id = p_new where user_id = p_old;

  delete from public.card_game_results o
   where o.user_id = p_old
     and exists (select 1 from public.card_game_results n
                  where n.user_id = p_new and n.kind = o.kind);
  update public.card_game_results set user_id = p_new where user_id = p_old;

  delete from public.bounty_responses o
   where o.user_id = p_old
     and exists (select 1 from public.bounty_responses n
                  where n.user_id = p_new and n.bounty_id = o.bounty_id);
  update public.bounty_responses set user_id = p_new where user_id = p_old;

  delete from public.diary_summary_cache o
   where o.user_id = p_old
     and exists (select 1 from public.diary_summary_cache n
                  where n.user_id = p_new and n.period = o.period and n.ref = o.ref);
  update public.diary_summary_cache set user_id = p_new where user_id = p_old;
end;
$$;

revoke all on function public.merge_anonymous_user(uuid, uuid) from public, anon, authenticated;
grant execute on function public.merge_anonymous_user(uuid, uuid) to service_role;
