import { useState } from 'react';
import { useAppStore, usePushOpen, usePushPayload } from '@/store/appStore';
import { BOUNTIES } from '@/data/bounties';
import BountyDetail from '../comm/BountyDetail';

/** 悬赏详情 push (原型 #bountyPage + openBounty/renderBountyDetail). */
export default function BountyPush() {
  const open = usePushOpen('bountyPage');
  const payload = usePushPayload('bountyPage');
  const closePush = useAppStore((s) => s.closePush);
  const showToast = useAppStore((s) => s.showToast);
  // Sent-card ids persist across bounties (原型 sentBountyCards).
  const [sentIds, setSentIds] = useState<Set<number>>(() => new Set());

  // CommScreen carries the selected bounty id through the payload's `question` field
  // (PushPayload has no dedicated bounty field, and the store must not be edited).
  const rawId = payload.question;
  const parsed = rawId !== undefined ? Number.parseInt(rawId, 10) : Number.NaN;
  const bounty = BOUNTIES.find((b) => b.id === parsed) ?? BOUNTIES[0];
  if (!bounty) return null;

  const markSent = () => {
    setSentIds((prev) => {
      const next = new Set(prev);
      next.add(bounty.id);
      return next;
    });
  };

  return (
    <section className={`push${open ? ' open' : ''}`} id="bountyPage" data-testid="push-bountyPage">
      <div className="top">
        <button
          type="button"
          className="backbtn"
          data-testid="push-bountyPage-back"
          aria-label="返回"
          onClick={() => {
            closePush('bountyPage');
          }}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <path d="M15 5l-7 7 7 7" />
          </svg>
        </button>
        <div>
          <h2>悬赏详情</h2>
          <div className="sub2">用真实经历回应真实问题</div>
        </div>
      </div>
      <BountyDetail key={bounty.id} bounty={bounty} sent={sentIds.has(bounty.id)} onSend={markSent} showToast={showToast} />
    </section>
  );
}
