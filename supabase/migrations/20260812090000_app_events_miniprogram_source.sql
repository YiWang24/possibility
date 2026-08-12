-- 20260812090000_app_events_miniprogram_source.sql
-- 让微信小程序端也能写 app_events（埋点三层架构的 Layer 1）。
--
-- 背景：0017 建表时只有 iOS 一个客户端在写，所以 source 的 CHECK 与
-- can_insert_app_event() 里都把 'ios' 写死了。Web / Android 至今不写客户端埋点，
-- 小程序是第二个要写的客户端。
--
-- 为什么小程序**必须**写 app_events，而不能像 iOS 那样三层并行：
--   Layer 2 PostHog 与 Layer 3 Sentry 都要求把各自的域名加进小程序的
--   「request 合法域名」白名单，而该白名单只接受已 ICP 备案的域名 ——
--   posthog.com / sentry.io 显然不在我们名下，备不了案。
--   所以小程序端只剩 Layer 1 这一条上报通路（经自有备案域名的反代网关），
--   外加微信自带的 We 分析（内置能力，不需要配域名）。
--   这使 app_events 从 iOS 的「兜底事实表」升级为小程序的**唯一**事实来源。
--
-- 改动是纯放开，不动既有行为：ios 与 server 的判定完全不变。

-- ==================== source 允许小程序 ====================
alter table app_events drop constraint if exists app_events_source_check;
alter table app_events add constraint app_events_source_check
  check (source in ('ios', 'miniprogram', 'server'));

-- ==================== 插入守卫放开 source + 补微信登录事件 ====================
-- 与 0017 原函数逐行一致，只有两处变化：
--   1. p_source = 'ios'  →  p_source in ('ios', 'miniprogram')
--   2. 事件白名单补 'auth_wechat_started'（小程序没有 Apple 登录，
--      对应件是微信一键登录，见 docs/engineering/埋点方案.md §3.2）
-- 仍然锁死客户端不能伪造 source='server' 的服务端事实，也不能写未知事件名。
create or replace function public.can_insert_app_event(
  p_user_id uuid,
  p_source text,
  p_event text
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select p_user_id is not null
     and p_source in ('ios', 'miniprogram')
     and p_event in (
       'app_opened', 'chat_started', 'chat_turn_completed',
       'paywall_viewed', 'paywall_dismissed',
       'purchase_started', 'purchase_completed', 'purchase_failed',
       'experiences_unlocked', 'experience_expanded',
       'action_selected', 'action_feedback_submitted',
       'auth_prompted', 'auth_sms_requested', 'auth_sms_verified',
       'auth_apple_started', 'auth_wechat_started',
       'auth_completed', 'auth_abandoned',
       'lab_result_viewed', 'diary_summary_viewed',
       'assessment_started', 'assessment_completed',
       'card_game_started', 'card_game_completed',
       'kaleidoscope_drawn', 'community_bounty_posted',
       'community_bounty_responded'
     )
     and (
       auth.uid() = p_user_id
       or exists (
         select 1
           from public.app_event_user_aliases a
          where a.old_user_id = auth.uid()
            and a.new_user_id = p_user_id
       )
     );
$$;

-- 权限与 0017 一致：create or replace 会重置属主权限，重新收紧一遍。
revoke all on function public.can_insert_app_event(uuid, text, text) from public, anon;
grant execute on function public.can_insert_app_event(uuid, text, text) to authenticated;
