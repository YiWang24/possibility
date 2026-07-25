// 编辑我的主页 push (source: prototype #myEditPage ~2333, `renderMyProfileEditor`
// ~5621 mode header/meta, `saveMyProfile` ~5906). Routes the five edit modes.

import { useAppStore, usePushOpen } from '@/store/appStore';
import { useMyProfileStore, type EditMode, type EditorProps } from '../me/myProfileStore';
import BasicEditor from '../me/edit/BasicEditor';
import StoryEditor from '../me/edit/StoryEditor';
import AdviceEditor from '../me/edit/AdviceEditor';
import ServiceEditor from '../me/edit/ServiceEditor';
import PersonaVisibilityEditor from '../me/edit/PersonaVisibilityEditor';

interface EditMeta {
  title: string;
  subtitle: string;
  saveLabel: string;
}

const EDIT_META: Record<EditMode, EditMeta> = {
  basic: { title: '编辑基础资料', subtitle: '只修改主页名片上的公开信息', saveLabel: '保存基础资料' },
  story: { title: '编辑我的故事', subtitle: '修改故事内容和人生时间线', saveLabel: '保存故事' },
  advice: { title: '编辑经验与建议', subtitle: '自由组合标题、内容、图片与链接', saveLabel: '保存建议' },
  service: { title: '编辑提供服务', subtitle: '设置服务内容、价格和公开状态', saveLabel: '保存服务' },
  persona: { title: '设置动态画像', subtitle: '选择主页允许公开的画像内容', saveLabel: '保存展示设置' },
};

function renderEditor(mode: EditMode, props: EditorProps): React.ReactElement {
  switch (mode) {
    case 'basic':
      return <BasicEditor {...props} />;
    case 'story':
      return <StoryEditor {...props} />;
    case 'advice':
      return <AdviceEditor {...props} />;
    case 'service':
      return <ServiceEditor {...props} />;
    case 'persona':
      return <PersonaVisibilityEditor {...props} />;
  }
}

export default function MyEditPush() {
  const open = usePushOpen('myEditPage');
  const editMode = useMyProfileStore((s) => s.editMode);
  const editDraft = useMyProfileStore((s) => s.editDraft);
  const updateDraft = useMyProfileStore((s) => s.updateDraft);
  const saveEdit = useMyProfileStore((s) => s.saveEdit);
  const cancelEdit = useMyProfileStore((s) => s.cancelEdit);
  const closePush = useAppStore((s) => s.closePush);
  const showToast = useAppStore((s) => s.showToast);

  const meta = editMode !== null ? EDIT_META[editMode] : EDIT_META.basic;

  const back = (): void => {
    closePush('myEditPage');
    cancelEdit();
  };

  const save = (): void => {
    const mode = editMode;
    const result = saveEdit();
    if (!result.ok) {
      showToast(result.reason === 'empty-name' ? '昵称不能为空' : '保存失败，请减少图片数量或更换较小的图片');
      return;
    }
    closePush('myEditPage');
    showToast(mode === 'persona' ? `${result.savedLabel}已更新 · 当前公开 ${String(result.personaCount)} 项` : `${result.savedLabel}已更新`);
  };

  return (
    <section className={`push${open ? ' open' : ''}`} id="myEditPage" data-testid="push-myEditPage">
      <div className="top">
        <button type="button" className="backbtn" data-testid="push-myEditPage-back" aria-label="返回我的主页" onClick={back}>
          ‹
        </button>
        <div>
          <h2 id="myEditTitle">{meta.title}</h2>
          <div className="sub2" id="myEditSubtitle">
            {meta.subtitle}
          </div>
        </div>
      </div>
      <div className="scroll edit-profile-scroll" id="myEditBody">
        {open && editMode !== null && editDraft !== null ? renderEditor(editMode, { draft: editDraft, updateDraft }) : null}
      </div>
      <div className="edit-savebar">
        <button type="button" id="myEditSaveButton" data-testid="my-edit-save" onClick={save}>
          {meta.saveLabel}
        </button>
      </div>
    </section>
  );
}
