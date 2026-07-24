-- 0009_bounty_responses_read.sql — 悬赏回应公开可读
-- 社区悬赏的回应本来就是公开展示内容；0007 的策略只允许本人读自己的回应，
-- 导致 community.get_bounty 无法返回他人的回应列表。补充 select 策略：
-- authenticated 可读全部回应，写入仍由 0007 的自有策略约束。

drop policy if exists "Bounty responses are readable" on bounty_responses;
create policy "Bounty responses are readable" on bounty_responses
  for select to authenticated using (true);
