-- 统一悬赏列表文案与真实回应记录数，并让新增/删除回应都自动同步。

create or replace function public.sync_bounty_response_count()
returns trigger language plpgsql
security definer
set search_path = ''
as $$
declare
  target_bounty_id bigint;
begin
  target_bounty_id := case
    when tg_op = 'DELETE' then old.bounty_id
    else new.bounty_id
  end;

  update public.bounties
  set responses = (
    select count(*)::text || ' 人回应'
    from public.bounty_responses
    where bounty_id = target_bounty_id
  )
  where id = target_bounty_id;

  return null;
end;
$$;

revoke all on function public.sync_bounty_response_count() from public, anon, authenticated;

drop trigger if exists trg_bounty_responses_count on public.bounty_responses;
create trigger trg_bounty_responses_count
after insert or delete on public.bounty_responses
for each row execute function public.sync_bounty_response_count();

-- 修正历史静态文案（例如 31 人回应）与实际空数组不一致的问题。
update public.bounties as bounty
set responses = (
  select count(*)::text || ' 人回应'
  from public.bounty_responses as response
  where response.bounty_id = bounty.id
);
