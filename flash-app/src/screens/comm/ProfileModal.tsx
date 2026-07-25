import { useRef, useState } from 'react';
import type { MouseEvent } from 'react';
import type { User } from '@/data/users';
import type { ProfileMeta } from '@/data/profileMeta';
import type { ProfileServiceCard } from './services';

export type ModalView = 'unlock' | 'consult' | 'materials' | 'companion';

export interface ModalState {
  view: ModalView;
  /** Bumped on every open so the inner form remounts fresh. */
  seq: number;
}

interface ProfileModalProps {
  modal: ModalState | null;
  user: User;
  meta: ProfileMeta;
  services: ProfileServiceCard[];
  onClose: () => void;
  onUnlock: () => void;
  showToast: (msg: string) => void;
}

interface ModalContentProps extends Omit<ProfileModalProps, 'modal'> {
  view: ModalView;
}

function ModalContent({ view, user, meta, services, onClose, onUnlock, showToast }: ModalContentProps) {
  const [done, setDone] = useState(false);
  const [topic, setTopic] = useState(0);
  const [text, setText] = useState('');
  const textRef = useRef<HTMLTextAreaElement | null>(null);
  const service = services.find((s) => s.id === view);

  const head = (title: string) => (
    <div className="prof-dialog-head">
      <h3 id="profileModalTitle">{title}</h3>
      <button type="button" className="prof-dialog-close" data-testid="profile-modal-close" aria-label="关闭" onClick={onClose}>
        ✕
      </button>
    </div>
  );

  const success = (title: string, body: string, btn: string) => (
    <div className="prof-success">
      <div className="icon">✓</div>
      <h3>{title}</h3>
      <p>{body}</p>
      <button type="button" className="prof-dialog-action" data-testid="profile-modal-success" onClick={onClose}>
        {btn}
      </button>
    </div>
  );

  const choices = (options: string[]) => (
    <div className="consult-choice-row">
      {options.map((x, i) => (
        <button
          type="button"
          key={x}
          className={`consult-choice${i === topic ? ' on' : ''}`}
          data-testid={`consult-choice-${String(i)}`}
          onClick={() => {
            setTopic(i);
          }}
        >
          {x}
        </button>
      ))}
    </div>
  );

  const requireText = (emptyMsg: string, okMsg: string) => {
    if (text.trim() === '') {
      showToast(emptyMsg);
      textRef.current?.focus();
      return;
    }
    setDone(true);
    showToast(okMsg);
  };

  if (view === 'unlock') {
    return (
      <>
        {head('解锁完整经验')}
        <div className="order-card">
          <div>
            <b>{user.name}的完整经验与建议</b>
            <p>转型判断 · 能力迁移 · 求职面试</p>
          </div>
          <strong>¥9.9</strong>
        </div>
        <p className="pay-note">一次解锁，长期可看。故事和时间线保持完整公开，付费仅用于解锁进阶经验与建议。</p>
        <button
          type="button"
          className="prof-dialog-action"
          data-testid="profile-unlock-confirm"
          onClick={() => {
            onUnlock();
            onClose();
            showToast('完整经验已解锁 ✦');
          }}
        >
          确认支付 ¥9.9
        </button>
      </>
    );
  }

  if (view === 'consult') {
    if (done) {
      return success('咨询请求已提交', `${user.name}会在约定时间内回复你。收到回复后，你还可以围绕原问题追问一次。`, '完成');
    }
    return (
      <>
        {head(service?.title ?? '路径咨询')}
        <div className="order-card">
          <div>
            <b>与{user.name}进行 1 小时咨询</b>
            <p>
              {meta.from} → {meta.to} · {meta.response}
            </p>
          </div>
          <strong>¥{service?.price ?? '29'}</strong>
        </div>
        <label className="consult-form-label">你最想咨询哪一类问题？</label>
        {choices(service?.topics ?? [])}
        <label className="consult-form-label" htmlFor="consultQuestion">
          补充你的具体情况
        </label>
        <textarea
          ref={textRef}
          className="consult-question"
          id="consultQuestion"
          data-testid="consult-question"
          placeholder={`例如：我目前从事相关工作，正在考虑${meta.to}方向，最担心的是进入新阶段的准备不足……`}
          value={text}
          onChange={(e) => {
            setText(e.target.value);
          }}
        />
        <p className="pay-note">你的问题只会发送给咨询者本人，不会公开展示。</p>
        <button
          type="button"
          className="prof-dialog-action"
          data-testid="consult-submit"
          onClick={() => {
            requireText('请先简单描述你的具体情况', '已向她发起咨询');
          }}
        >
          确认并支付 ¥{service?.price ?? '29'}
        </button>
      </>
    );
  }

  if (view === 'materials') {
    if (done) {
      return success(`${service?.title ?? '资料工具包'}已解锁`, '服务内容已放入「我的服务」。你可以随时回来查看和使用。', '立即查看');
    }
    const items = service?.items ?? [];
    return (
      <>
        {head(service?.title ?? '资料工具包')}
        <div className="order-card">
          <div>
            <b>{items.length} 份亲历工具模板</b>
            <p>{items.join(' · ')}</p>
          </div>
          <strong>¥{service?.price ?? '9.9'}</strong>
        </div>
        <div className="story-full">
          <h4>购买后可获得</h4>
          <p>
            {items.join('、')}。内容由{user.name}根据从{meta.from}到{meta.to}的经历整理。
          </p>
        </div>
        <p className="pay-note">数字内容购买后立即解锁，可在「我的服务」中长期查看。</p>
        <button
          type="button"
          className="prof-dialog-action"
          data-testid="materials-confirm"
          onClick={() => {
            setDone(true);
            showToast('材料包已添加到我的服务');
          }}
        >
          确认支付 ¥{service?.price ?? '9.9'}
        </button>
      </>
    );
  }

  if (done) {
    return success('陪跑申请已提交', `${user.name}会先确认你的目标与时间安排。匹配成功后，将从第一次目标拆解开始计入 4 周服务期。`, '完成');
  }
  return (
    <>
      {head(service?.title ?? '行动陪跑')}
      <div className="order-card">
        <div>
          <b>4 周行动陪跑</b>
          <p>目标拆解 · 每周复盘 · 关键反馈</p>
        </div>
        <strong>¥{service?.price ?? '599'}</strong>
      </div>
      <label className="consult-form-label">你目前处在哪个阶段？</label>
      {choices(service?.stages ?? [])}
      <label className="consult-form-label" htmlFor="serviceQuestion">
        简单介绍你的当前目标
      </label>
      <textarea
        ref={textRef}
        className="consult-question"
        id="serviceQuestion"
        data-testid="service-question"
        placeholder={`例如：我想向${meta.to}方向前进，目前已经做过哪些准备、最需要推进的节点是什么……`}
        value={text}
        onChange={(e) => {
          setText(e.target.value);
        }}
      />
      <p className="pay-note">提交后会先确认目标与服务边界，双方确认适合后再开始 4 周陪跑。</p>
      <button
        type="button"
        className="prof-dialog-action"
        data-testid="companion-submit"
        onClick={() => {
          requireText('请先简单介绍你的当前目标', '行动陪跑申请已提交');
        }}
      >
        提交申请并支付 ¥{service?.price ?? '599'}
      </button>
    </>
  );
}

/** 用户主页付费弹窗 (原型 profileModal + openProfileCheckout/openProfileService). */
export default function ProfileModal({ modal, user, meta, services, onClose, onUnlock, showToast }: ProfileModalProps) {
  const stop = (e: MouseEvent<HTMLDivElement>) => {
    e.stopPropagation();
  };
  return (
    <div className={`prof-modal${modal ? ' open' : ''}`} id="profileModal" data-testid="profile-modal" onClick={onClose}>
      <div className="prof-dialog" role="dialog" aria-modal="true" aria-labelledby="profileModalTitle" onClick={stop}>
        <div className="grab" />
        <div id="profileModalBody">
          {modal ? (
            <ModalContent
              key={String(modal.seq)}
              view={modal.view}
              user={user}
              meta={meta}
              services={services}
              onClose={onClose}
              onUnlock={onUnlock}
              showToast={showToast}
            />
          ) : null}
        </div>
      </div>
    </div>
  );
}
