import type { KeyboardEvent } from 'react';
import type { Bounty } from '@/data/bounties';

interface BountyCardProps {
  bounty: Bounty;
  onOpen: (id: number) => void;
}

/** 悬赏贴 list card (原型 bountyHTML). */
export default function BountyCard({ bounty, onOpen }: BountyCardProps) {
  const open = () => {
    onOpen(bounty.id);
  };
  const onKeyDown = (e: KeyboardEvent<HTMLElement>) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      open();
    }
  };

  return (
    <article className="bounty" role="button" tabIndex={0} data-testid={`bounty-card-${String(bounty.id)}`} onClick={open} onKeyDown={onKeyDown}>
      <div className="bounty-tags">
        {bounty.tags.map((t) => (
          <span key={t}>{t}</span>
        ))}
      </div>
      <h4>{bounty.q}</h4>
      <div className="bounty-foot">
        <div className="bounty-reward">
          悬赏 <b>¥{bounty.amount}</b>
        </div>
        <div className="bounty-stats">
          {bounty.goal}
          <br />
          {bounty.n}
        </div>
      </div>
    </article>
  );
}
