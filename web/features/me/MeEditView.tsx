"use client";
/* 我的主页编辑浮层 —— 移植 iOS MeEditView.swift（原型 #myEditPage · renderMyProfileEditor）。
   5 种编辑模式：basic / story / advice / service / persona（展示开关）。
   基于草稿副本编辑，保存时整体写回本地档案并同步云端 save_public_profile。
   移动端底部全宽 sheet / 桌面居中 modal（rounded-sheet + framer-motion）。 */

import { useState, type ReactNode } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useToast } from "@/components/ui/Toast";
import { callFunction } from "@/lib/supabase";
import { useData } from "@/stores/data";
import { hue } from "@/lib/theme";
import {
  AI_SCOPE_OPTIONS,
  useMyProfile,
  myProfileRemotePayload,
  type MyProfile,
  type ProfileAIPermissions,
} from "@/stores/my-profile";
import type { PersonaItem } from "./MeView";

export type MeEditMode = "basic" | "story" | "advice" | "service" | "persona";

const MODE_META: Record<MeEditMode, { title: string; subtitle: string; save: string; toast: string }> = {
  basic: { title: "编辑基础资料", subtitle: "只修改主页名片上的公开信息", save: "保存基础资料", toast: "已保存基础资料" },
  story: { title: "编辑我的故事", subtitle: "修改故事内容和人生时间线", save: "保存故事", toast: "已保存故事" },
  advice: { title: "编辑经验与建议", subtitle: "自由组合标题、内容与链接", save: "保存建议", toast: "已保存建议" },
  service: { title: "编辑提供服务", subtitle: "设置服务内容、价格和公开状态", save: "保存服务", toast: "已保存服务" },
  persona: { title: "设置动态画像", subtitle: "分别设置公开展示与 AI 使用授权", save: "保存权限设置", toast: "已保存权限设置" },
};

export function MeEditView({
  mode,
  personaItems,
  onClose,
}: {
  mode: MeEditMode | null;
  personaItems: PersonaItem[];
  onClose: () => void;
}) {
  return (
    <AnimatePresence>
      {mode && <EditSheet key={mode} mode={mode} personaItems={personaItems} onClose={onClose} />}
    </AnimatePresence>
  );
}

function EditSheet({
  mode,
  personaItems,
  onClose,
}: {
  mode: MeEditMode;
  personaItems: PersonaItem[];
  onClose: () => void;
}) {
  const showToast = useToast((s) => s.show);
  const meta = MODE_META[mode];

  const [draft, setDraft] = useState<MyProfile>(() => useMyProfile.getState().profile);
  const [aiPermissions, setAIPermissions] = useState<ProfileAIPermissions>(
    () => useMyProfile.getState().aiPermissions,
  );
  const [tagsText, setTagsText] = useState(() => draft.tags.join("，"));
  const [ageText, setAgeText] = useState(() => String(draft.meta.age));

  const patch = (p: Partial<MyProfile>) => setDraft((d) => ({ ...d, ...p }));
  const patchMeta = (p: Partial<MyProfile["meta"]>) => setDraft((d) => ({ ...d, meta: { ...d.meta, ...p } }));

  const save = () => {
    const updated: MyProfile = { ...draft };
    if (mode === "basic") {
      updated.tags = tagsText
        .split(/[，,\s]+/)
        .map((t) => t.trim())
        .filter(Boolean);
      updated.meta = { ...updated.meta, age: Number.parseInt(ageText, 10) || draft.meta.age };
    }
    if (mode === "story") {
      updated.traj = updated.traj.filter((n) => n.t.trim().length > 0);
    }
    // 本地整体写回（localStorage 持久化）
    useMyProfile.getState().setProfile(updated);
    if (mode === "persona") {
      useMyProfile.getState().setAIPermissions(aiPermissions);
    }
    // 云端同步（失败静默：本地已保存，下次成功保存自然同步）
    void (async () => {
      try {
        await callFunction("save-profile", {
          action: "save_public_profile",
          ...myProfileRemotePayload(updated),
        });
        if (mode === "persona") {
          const response = await callFunction<{ permission_revision: number }>(
            "save-profile",
            {
              action: "save_ai_permissions",
              permissions: aiPermissions,
              permission_revision: useMyProfile.getState().permissionRevision,
            },
          );
          useMyProfile.getState().setAIPermissions(
            aiPermissions,
            response.permission_revision,
          );
        }
        useData.getState().invalidateProfile();
      } catch {
        /* 静默 */
      }
    })();
    showToast(meta.toast);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[80] flex items-end justify-center md:items-center md:p-6">
      <motion.div
        className="absolute inset-0 bg-black/60"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
      />
      <motion.div
        className="relative flex max-h-[92vh] w-full flex-col overflow-hidden rounded-t-sheet border border-line bg-[#0a0c12] shadow-[0_18px_50px_rgba(0,0,0,0.7)] md:w-[560px] md:max-h-[86vh] md:rounded-sheet"
        initial={{ y: 60, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: 60, opacity: 0 }}
        transition={{ type: "spring", stiffness: 360, damping: 34 }}
      >
        {/* 顶栏 */}
        <div className="flex items-center gap-3 border-b border-line px-5 py-3.5">
          <button
            onClick={onClose}
            aria-label="返回"
            className="flex h-[34px] w-[34px] shrink-0 items-center justify-center rounded-full bg-raised text-[15px] font-semibold text-ink transition active:scale-95"
          >
            ‹
          </button>
          <div className="flex flex-col">
            <span className="text-[16px] font-bold text-ink">{meta.title}</span>
            <span className="text-[10.5px] text-faint">{meta.subtitle}</span>
          </div>
        </div>

        {/* 编辑区 */}
        <div className="no-scrollbar flex-1 overflow-y-auto px-5 py-4">
          {mode === "basic" && (
            <BasicEditor
              draft={draft}
              tagsText={tagsText}
              ageText={ageText}
              setTagsText={setTagsText}
              setAgeText={setAgeText}
              patch={patch}
              patchMeta={patchMeta}
            />
          )}
          {mode === "story" && <StoryEditor draft={draft} setDraft={setDraft} patch={patch} patchMeta={patchMeta} />}
          {mode === "advice" && <AdviceEditor draft={draft} setDraft={setDraft} />}
          {mode === "service" && <ServiceEditor draft={draft} setDraft={setDraft} />}
          {mode === "persona" && (
            <PersonaEditor
              draft={draft}
              aiPermissions={aiPermissions}
              personaItems={personaItems}
              setDraft={setDraft}
              setAIPermissions={setAIPermissions}
            />
          )}
        </div>

        {/* 保存栏 */}
        <div className="border-t border-line px-5 py-3.5">
          <button
            onClick={save}
            className="w-full rounded-chip bg-btn-g py-[15px] text-[14px] font-semibold text-white transition active:scale-[0.97]"
          >
            {meta.save}
          </button>
        </div>
      </motion.div>
    </div>
  );
}

/* ============ 通用输入组件 ============ */

function Field({
  label,
  value,
  onChange,
  multiline = false,
  className = "",
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  multiline?: boolean;
  className?: string;
}) {
  return (
    <div className={`flex flex-col gap-1.5 ${className}`}>
      <span className="text-[10.5px] text-faint">{label}</span>
      {multiline ? (
        <textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          rows={3}
          className="resize-none rounded-[12px] border border-line bg-raised px-3 py-2.5 text-[13.5px] text-ink placeholder:text-faint focus:outline-none"
        />
      ) : (
        <input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="rounded-[12px] border border-line bg-raised px-3 py-2.5 text-[13.5px] text-ink placeholder:text-faint focus:outline-none"
        />
      )}
    </div>
  );
}

function SectionTitle({ title, note }: { title: string; note: string }) {
  return (
    <div className="flex items-baseline justify-between">
      <span className="text-[13.5px] font-bold text-ink">{title}</span>
      <span className="text-[10.5px] text-faint">{note}</span>
    </div>
  );
}

function Toggle({ on, onChange }: { on: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      onClick={() => onChange(!on)}
      className={`relative h-[26px] w-[46px] shrink-0 rounded-chip transition ${on ? "bg-brand" : "bg-raised border border-line"}`}
    >
      <span
        className={`absolute top-[3px] h-5 w-5 rounded-full bg-white transition-all ${on ? "left-[23px]" : "left-[3px]"}`}
      />
    </button>
  );
}

function AddButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button onClick={onClick} className="self-start text-[12.5px] text-brand transition active:scale-95">
      {label}
    </button>
  );
}

function EditCard({ children }: { children: ReactNode }) {
  return (
    <div className="flex flex-col gap-2.5 rounded-[14px] border border-line bg-card p-3.5">{children}</div>
  );
}

/* ============ 基础资料 ============ */

function BasicEditor({
  draft,
  tagsText,
  ageText,
  setTagsText,
  setAgeText,
  patch,
  patchMeta,
}: {
  draft: MyProfile;
  tagsText: string;
  ageText: string;
  setTagsText: (v: string) => void;
  setAgeText: (v: string) => void;
  patch: (p: Partial<MyProfile>) => void;
  patchMeta: (p: Partial<MyProfile["meta"]>) => void;
}) {
  return (
    <div className="flex flex-col gap-3.5">
      <SectionTitle title="头像色彩" note="点击切换主页配色" />
      <div className="flex gap-3">
        {[0, 1, 2, 3, 4].map((h) => (
          <button
            key={h}
            onClick={() => patch({ hue: h })}
            className={`h-11 w-11 rounded-full transition active:scale-95 ${
              draft.hue === h ? "ring-2 ring-white ring-offset-2 ring-offset-[#0a0c12]" : ""
            }`}
            style={{ background: hue(h).gradient }}
            aria-label={`配色 ${h + 1}`}
          />
        ))}
      </div>

      <SectionTitle title="基础信息" note="显示在主页名片" />
      <Field label="昵称" value={draft.name} onChange={(v) => patch({ name: v })} />
      <div className="flex gap-2.5">
        <Field label="年龄" value={ageText} onChange={setAgeText} className="flex-1" />
        <Field label="所在城市" value={draft.meta.city} onChange={(v) => patchMeta({ city: v })} className="flex-1" />
      </div>
      <div className="flex gap-2.5">
        <Field label="过去身份" value={draft.meta.from} onChange={(v) => patchMeta({ from: v })} className="flex-1" />
        <Field label="现在身份" value={draft.meta.to} onChange={(v) => patchMeta({ to: v })} className="flex-1" />
      </div>
      <Field label="当前阶段" value={draft.meta.years} onChange={(v) => patchMeta({ years: v })} />
      <Field label="目前状态" value={draft.meta.result} onChange={(v) => patchMeta({ result: v })} />
      <Field label="主页标签（用逗号分隔）" value={tagsText} onChange={setTagsText} />
    </div>
  );
}

/* ============ 我的故事 ============ */

function StoryEditor({
  draft,
  setDraft,
  patch,
  patchMeta,
}: {
  draft: MyProfile;
  setDraft: React.Dispatch<React.SetStateAction<MyProfile>>;
  patch: (p: Partial<MyProfile>) => void;
  patchMeta: (p: Partial<MyProfile["meta"]>) => void;
}) {
  const updateNode = (idx: number, key: "age" | "t" | "d", value: string) =>
    setDraft((d) => ({ ...d, traj: d.traj.map((n, i) => (i === idx ? { ...n, [key]: value } : n)) }));
  const removeNode = (idx: number) => setDraft((d) => ({ ...d, traj: d.traj.filter((_, i) => i !== idx) }));
  const addNode = () => setDraft((d) => ({ ...d, traj: [...d.traj, { age: "", t: "", d: "" }] }));

  return (
    <div className="flex flex-col gap-3.5">
      <SectionTitle title="我的故事" note="公开叙事" />
      <Field label="故事题记" value={draft.quote} onChange={(v) => patch({ quote: v })} multiline />
      <Field label="故事摘要" value={draft.meta.intro} onChange={(v) => patchMeta({ intro: v })} multiline />
      <Field label="完整故事" value={draft.meta.full} onChange={(v) => patchMeta({ full: v })} multiline />

      <div className="mt-1.5">
        <SectionTitle title="故事时间线" note="可增删节点" />
      </div>
      {draft.traj.map((node, idx) => (
        <EditCard key={idx}>
          <div className="flex items-center justify-between gap-2.5">
            <Field label="年龄" value={node.age} onChange={(v) => updateNode(idx, "age", v)} className="w-[120px]" />
            <button onClick={() => removeNode(idx)} className="self-end pb-2.5 text-[11.5px] text-[#FF8A8A]">
              删除
            </button>
          </div>
          <Field label="节点标题" value={node.t} onChange={(v) => updateNode(idx, "t", v)} />
          <Field label="节点描述" value={node.d} onChange={(v) => updateNode(idx, "d", v)} multiline />
        </EditCard>
      ))}
      <AddButton label="＋ 添加一个人生节点" onClick={addNode} />
    </div>
  );
}

/* ============ 经验与建议 ============ */

function AdviceEditor({
  draft,
  setDraft,
}: {
  draft: MyProfile;
  setDraft: React.Dispatch<React.SetStateAction<MyProfile>>;
}) {
  const updateModule = (id: string, key: "title" | "content", value: string) =>
    setDraft((d) => ({ ...d, adviceModules: d.adviceModules.map((m) => (m.id === id ? { ...m, [key]: value } : m)) }));
  const removeModule = (id: string) =>
    setDraft((d) => ({ ...d, adviceModules: d.adviceModules.filter((m) => m.id !== id) }));
  const addModule = () =>
    setDraft((d) => ({
      ...d,
      adviceModules: [...d.adviceModules, { id: newId(), title: "", content: "", links: [] }],
    }));
  const updateLink = (mid: string, idx: number, key: "label" | "url", value: string) =>
    setDraft((d) => ({
      ...d,
      adviceModules: d.adviceModules.map((m) =>
        m.id === mid ? { ...m, links: m.links.map((l, i) => (i === idx ? { ...l, [key]: value } : l)) } : m,
      ),
    }));
  const addLink = (mid: string) =>
    setDraft((d) => ({
      ...d,
      adviceModules: d.adviceModules.map((m) =>
        m.id === mid ? { ...m, links: [...m.links, { label: "", url: "" }] } : m,
      ),
    }));

  return (
    <div className="flex flex-col gap-3.5">
      <SectionTitle title="经验与建议模块" note="标题、正文与链接" />
      {draft.adviceModules.map((m) => (
        <EditCard key={m.id}>
          <div className="flex items-center justify-between">
            <span className="text-[10.5px] text-faint">模块</span>
            <button onClick={() => removeModule(m.id)} className="text-[11.5px] text-[#FF8A8A]">
              删除
            </button>
          </div>
          <Field label="标题" value={m.title} onChange={(v) => updateModule(m.id, "title", v)} />
          <Field label="内容（每行一条）" value={m.content} onChange={(v) => updateModule(m.id, "content", v)} multiline />
          {m.links.map((link, i) => (
            <div key={i} className="flex gap-2.5">
              <Field label="链接标题" value={link.label} onChange={(v) => updateLink(m.id, i, "label", v)} className="flex-1" />
              <Field label="URL" value={link.url} onChange={(v) => updateLink(m.id, i, "url", v)} className="flex-1" />
            </div>
          ))}
          <AddButton label="＋ 添加链接" onClick={() => addLink(m.id)} />
        </EditCard>
      ))}
      <AddButton label="＋ 新增经验模块" onClick={addModule} />
      <span className="text-[10.5px] text-faint">每个模块都可以独立增删；链接保存后可直接访问。</span>
    </div>
  );
}

/* ============ 提供服务 ============ */

function ServiceEditor({
  draft,
  setDraft,
}: {
  draft: MyProfile;
  setDraft: React.Dispatch<React.SetStateAction<MyProfile>>;
}) {
  const updateService = (id: string, key: "enabled" | "title" | "price" | "type" | "desc", value: string | boolean) =>
    setDraft((d) => ({ ...d, services: d.services.map((s) => (s.id === id ? { ...s, [key]: value } : s)) }));

  return (
    <div className="flex flex-col gap-3.5">
      <SectionTitle title="提供服务" note="可自定义与开关" />
      {draft.services.map((s) => (
        <EditCard key={s.id}>
          <div className="flex items-center justify-between">
            <span className="text-[12px] font-semibold text-ink">{s.type}</span>
            <Toggle on={s.enabled} onChange={(v) => updateService(s.id, "enabled", v)} />
          </div>
          <Field label="服务标题" value={s.title} onChange={(v) => updateService(s.id, "title", v)} />
          <div className="flex gap-2.5">
            <Field label="价格 ¥" value={s.price} onChange={(v) => updateService(s.id, "price", v)} className="w-[120px]" />
            <Field label="类型" value={s.type} onChange={(v) => updateService(s.id, "type", v)} className="flex-1" />
          </div>
          <Field label="服务说明" value={s.desc} onChange={(v) => updateService(s.id, "desc", v)} multiline />
        </EditCard>
      ))}
    </div>
  );
}

/* ============ 画像展示开关 ============ */

function PersonaEditor({
  draft,
  aiPermissions,
  personaItems,
  setDraft,
  setAIPermissions,
}: {
  draft: MyProfile;
  aiPermissions: ProfileAIPermissions;
  personaItems: PersonaItem[];
  setDraft: React.Dispatch<React.SetStateAction<MyProfile>>;
  setAIPermissions: React.Dispatch<React.SetStateAction<ProfileAIPermissions>>;
}) {
  const togglePublic = (key: string, on: boolean) =>
    setDraft((d) => ({ ...d, visibility: { ...d.visibility, [key]: on } }));
  const toggleAI = (key: string, scope: string, on: boolean) =>
    setAIPermissions((current) => ({
      ...current,
      [key]: { ...(current[key] ?? {}), [scope]: on },
    }));

  return (
    <div className="flex flex-col gap-3.5">
      <SectionTitle title="动态画像权限" note="公开展示与 AI 使用分别授权" />
      {personaItems.map((item) => (
        <div key={item.key} className="flex flex-col gap-3 rounded-[14px] border border-line bg-card px-3.5 py-3">
          <div className="flex min-w-0 flex-1 flex-col gap-0.5">
            <span className="text-[13px] font-semibold text-ink">{item.label}</span>
            <span className="truncate text-[11px] text-sub">{item.value}</span>
          </div>
          <div className="flex items-center justify-between gap-4 text-[11.5px] text-sub">
            <span>公开展示</span>
            <Toggle
              on={draft.visibility[item.key] ?? false}
              onChange={(v) => togglePublic(item.key, v)}
            />
          </div>
          <div className="h-px bg-line" />
          <span className="text-[10.5px] font-semibold text-faint">AI 使用范围</span>
          <div className="grid grid-cols-1 gap-2.5">
            {AI_SCOPE_OPTIONS.map((scope) => (
              <div key={scope.key} className="flex items-center justify-between gap-4">
                <div className="flex min-w-0 flex-col">
                  <span className="text-[11.5px] text-sub">{scope.label}</span>
                  <span className="text-[9.5px] text-faint">{scope.detail}</span>
                </div>
                <Toggle
                  on={aiPermissions[item.key]?.[scope.key] === true}
                  onChange={(v) => toggleAI(item.key, scope.key, v)}
                />
              </div>
            ))}
          </div>
        </div>
      ))}
      <span className="text-[10.5px] text-faint">
        每种 AI 用途独立授权，未开启的维度不会发送给对应模型；公开展示与 AI 授权互不影响。
      </span>
    </div>
  );
}

function newId(): string {
  return crypto.randomUUID();
}
