-- 0010_bounty_fixes.sql — 悬赏回应计数同步 + 线上脏数据回填

-- ==================== 回应计数触发器 ====================
-- respond_bounty 只写 bounty_responses，bounties.responses 文案（create_bounty
-- 固定「0 人回应」、seed 为静态文案）永不更新。AFTER INSERT 按实际 count 重算；
-- upsert 命中已有回应走 UPDATE，不触发、不重复计数。
-- security definer：回应者通常不是悬赏作者，需要越过 bounties 的自有更新 RLS；
-- search_path 收紧为空并撤销直接执行权限（参照 0005 的加固写法）。
create or replace function public.sync_bounty_response_count()
returns trigger language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.bounties
  set responses = (
    select count(*)::text || ' 人回应'
    from public.bounty_responses
    where bounty_id = new.bounty_id
  )
  where id = new.bounty_id;
  return new;
end;
$$;
revoke all on function public.sync_bounty_response_count() from public, anon, authenticated;

drop trigger if exists trg_bounty_responses_count on bounty_responses;
create trigger trg_bounty_responses_count after insert on bounty_responses
  for each row execute function public.sync_bounty_response_count();

-- ==================== 线上脏数据回填 ====================
-- 早期前端把 undefined 直接写进 reward/detail。按 seed.sql 的正确文案回填；
-- where 条件只命中脏数据行，重复执行无害（幂等），本地全新库上为空操作。
update bounties set reward = '¥29 悬赏'   where id = 1 and reward = 'undefined';
update bounties set reward = '¥19.9 悬赏' where id = 2 and reward = 'undefined';
update bounties set reward = '¥39 悬赏'   where id = 3 and reward = 'undefined';

update bounties
set detail = '我做了 4 年视觉设计，最近在自学 SQL 和 Python。真正担心的不是课程学不会，而是没有数据项目经验，也不知道第一份工作是否一定会降薪。希望听到设计背景转数据分析的真实经历，尤其是入行第一年的困难和准备方式。'
where id = 1 and (detail = '' or detail = 'undefined');

update bounties
set detail = '目前工作两年，收入稳定但看不到想要的发展。想跨专业读心理学研究生，家里认为先工作、结婚更现实。我希望了解辞职备考的现金流压力、失败后的退路，以及怎样和家人沟通。'
where id = 2 and (detail = '' or detail = 'undefined');

update bounties
set detail = '在上海做运营第 6 年，越来越想搬去生活成本低、节奏慢一点的城市。但担心收入、社交圈和以后回大城市的难度。想听已经搬走两年以上的人讲讲真实得失，而不只是旅行滤镜。'
where id = 3 and (detail = '' or detail = 'undefined');
