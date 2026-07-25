import { useState } from 'react';
import type { MouseEvent } from 'react';
import type { Bounty } from '@/data/bounties';
import { bountyAvatar } from './avatars';

interface BountyDetailProps {
  bounty: Bounty;
  sent: boolean;
  onSend: () => void;
  showToast: (msg: string) => void;
}

/** 悬赏详情正文 + 名片弹窗 (原型 renderBountyDetail + openBountyCardModal). */
export default function BountyDetail({ bounty, sent, onSend, showToast }: BountyDetailProps) {
  const [modalOpen, setModalOpen] = useState(false);
  const [message, setMessage] = useState('');

  const openCardModal = () => {
    if (sent) {
      showToast('你的名片已经发送');
      return;
    }
    setModalOpen(true);
  };
  const closeModal = () => {
    setModalOpen(false);
  };
  const confirmSend = () => {
    onSend();
    setModalOpen(false);
    showToast('名片已发送给发帖人');
  };
  const stop = (e: MouseEvent<HTMLDivElement>) => {
    e.stopPropagation();
  };

  return (
    <>
      <div className="scroll" id="bountyScroll" data-testid="bounty-scroll">
        <article className="bounty-detail">
          <div className="bounty-detail-tags">
            {bounty.tags.map((t) => (
              <span key={t}>{t}</span>
            ))}
          </div>
          <h1>{bounty.q}</h1>
          <div className="bounty-publisher">
            <img className="av" src={bountyAvatar(bounty.id + 11)} alt={`${bounty.asker}的头像`} />
            <div>
              <b>{bounty.asker}</b>
              <span>
                {bounty.city} · {bounty.time}发布
              </span>
            </div>
          </div>
          <div className="bounty-prize">
            <div>
              <span>本帖悬赏</span>
              <strong>¥{bounty.amount}</strong>
            </div>
            <span>{bounty.goal}</span>
          </div>
          <div className="bounty-copy">
            <h3>TA 想了解的具体情况</h3>
            <p>{bounty.detail}</p>
          </div>
          <div className="bounty-replies">
            <div className="bounty-replies-head">
              <h3>亲历者回应</h3>
              <span>{bounty.n}</span>
            </div>
            {bounty.replies.map((r) => (
              <div className="bounty-reply" key={`${r.name}-${r.role}`}>
                <img src={bountyAvatar(r.avatar)} alt={`${r.name}的头像`} />
                <div>
                  <b>{r.name}</b>
                  <small>{r.role}</small>
                  <p>{r.text}</p>
                </div>
              </div>
            ))}
          </div>
          {sent ? <div className="bounty-sent">你的名片与补充说明已发送，发帖人可以查看你的经历并与你联系。</div> : null}
        </article>
      </div>

      <div className="bounty-actionbar">
        <button type="button" id="bountyCardBtn" data-testid="bounty-card-btn" disabled={sent} onClick={openCardModal}>
          {sent ? '名片已发送 ✓' : '发送我的名片'}
        </button>
      </div>

      <div className={`prof-modal${modalOpen ? ' open' : ''}`} id="bountyModal" data-testid="bounty-modal" onClick={closeModal}>
        <div className="prof-dialog" role="dialog" aria-modal="true" aria-labelledby="bountyModalTitle" onClick={stop}>
          <div className="grab" />
          <div id="bountyModalBody">
            <div className="prof-dialog-head">
              <h3 id="bountyModalTitle">发送我的名片</h3>
              <button type="button" className="prof-dialog-close" data-testid="bounty-modal-close" aria-label="关闭" onClick={closeModal}>
                ✕
              </button>
            </div>
            <div className="bounty-card-preview">
              <div className="row">
                <img className="av" src={bountyAvatar(1)} alt="屿岸的头像" />
                <div>
                  <h4>屿岸</h4>
                  <p>交互设计师 · 正在探索 AI 产品</p>
                </div>
              </div>
              <div className="stags">
                <span className="stag">结构化思考</span>
                <span className="stag">共情</span>
                <span className="stag">视觉表达</span>
              </div>
            </div>
            <label className="consult-form-label" htmlFor="bountyCardMessage">
              补充一句话，让对方知道你为什么能回答
            </label>
            <textarea
              className="consult-question"
              id="bountyCardMessage"
              data-testid="bounty-card-message"
              placeholder="例如：我去年完成了相似转型，可以分享第一份工作的准备过程。"
              value={message}
              onChange={(e) => {
                setMessage(e.target.value);
              }}
            />
            <p className="pay-note">发送后，对方将看到你的公开画像和这段补充说明；你的联系方式不会直接公开。</p>
            <button type="button" className="prof-dialog-action" data-testid="bounty-card-confirm" onClick={confirmSend}>
              确认发送名片
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
