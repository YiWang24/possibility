-- 删除社区联调阶段遗留的测试悬赏；限定标题前缀和测试字段，避免误删正常内容。
delete from public.bounties
where question like 'API联调测试悬赏%'
  and reward = '无'
  and responses = '0 人回应';
