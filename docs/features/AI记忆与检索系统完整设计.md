# Possibility AI 记忆与检索系统路线图

> 状态：画像事实层已实现；跨对话经历记忆与向量检索尚未实现
> 日期：2026-07-30
> 当前画像权威设计：`docs/features/个人档案与AI使用设计.md`

## 0. 范围边界

“个人档案”与“可检索经历记忆”是两个层次：

| 层次 | 回答的问题 | 当前状态 |
|---|---|---|
| `profile_facts` | 这个用户有哪些稳定偏好、能力、价值、目标、约束和关系需要 | 已实现 |
| `profile_fact_evidence` | 为什么系统相信这条事实 | 已实现 |
| `memory_proposals` | AI 想记住什么、是否得到用户确认 | 已实现 |
| `memory_items` | 哪段具体对话、日记、选择或实验经历与当前问题相关 | 未实现 |
| 公共经历检索 | 哪些经过发布/验证的他人经历适合匹配和推荐 | 未实现 |

当前版本不引入 Mem0、Graphiti、LlamaIndex、LangGraph、独立向量数据库或知识图谱。先用 Postgres/Supabase 完成稳定的事实、公开/私人边界、提案、证据和数据权利边界。

## 1. 当前已实现的画像记忆

### 1.1 正式事实

`profile_facts` 是唯一权威画像内容。旧 `profiles.dims` 和 `profile_dimensions` 已删除，不保留双读、双写或兼容投影。

正式事实包含：

- 固定维度和事实类型
- 原始值与规范化值
- 来源和来源引用
- 置信度与本人确认状态
- `public/private` 可见性
- 敏感度
- 状态与有效期
- 支持次数和最近支持时间

本人手填、测评和卡牌通过受控 RPC 写正式事实。Chat、日记、实验和推演不能直接替换正式事实。

### 1.2 AI 提案

AI 抽取写入 `memory_proposals`：

```text
source + source_version + dimension + normalized_value
→ 稳定 dedupe_key
→ pending proposal
→ 用户接受/拒绝
```

接受后：

1. upsert `profile_facts`
2. 写入 `profile_fact_evidence`
3. 把候选标记为 `applied`
4. 递增 `profile_revision`

拒绝只更新候选状态，不改变正式画像版本。

### 1.3 公开与私人

每条事实只有两个权限状态：

- `private`：默认值，只能在服务该用户本人时使用。
- `public`：服务本人时可用，也可以进入安全发布快照，供公开主页、跨用户匹配和社区推荐使用。

Chat、Persona、Match、Lab、Simulation、Community 等 `purpose` 继续作为审计字段，但不再形成权限矩阵。用户本人使用这些功能时，可以读取自己符合质量门槛的公开和私人事实。

### 1.4 公开边界

`profile_facts` 原始行始终只允许本人读取。事实级可见性只决定其是否进入安全发布快照：

```text
本人 profile_facts.visibility = public
→ save_public_profile
→ 安全 public_profiles.published_facts
```

其他用户和匿名用户只能读取发布表，不能读取事实表。设置可见性、修改或删除事实后，发布快照同步刷新。

## 2. 当前 AI 读取

共享画像上下文读取器执行：

1. 用当前用户 JWT 读取自己的 `profiles` 和 `profile_facts`。
2. 同时考虑本人的公开和私人 active 事实。
3. 按确认状态、置信度、支持次数和时间排序。
4. 最多选择 20 条事实，并限制注入 Prompt 的字符预算。
5. 返回结构化事实、使用的事实 ID、`profile_revision` 与公开/私人数量。
6. 记录不含原文的 `profile_ai_context_used` 最小回执。

优先级：

```text
用户本轮明确内容
> 用户已确认事实
> 置信度至少 0.7 的未确认事实
> 不使用的长期数据
```

任何画像查询失败都 fail closed：不附加长期画像，但不阻断用户当前请求。跨用户读取不经过这个本人上下文读取器，只能使用 `public_profiles.published_facts`。

## 3. 下一阶段：经历记忆 `memory_items`

只有当产品需要“召回一段具体经历”，而不是读取稳定画像事实时，才新增 `memory_items`。

建议结构：

```sql
create table public.memory_items (
  id                 uuid primary key default gen_random_uuid(),
  user_id            uuid not null references auth.users(id) on delete cascade,
  kind               text not null check (
                       kind in (
                         'conversation',
                         'diary',
                         'decision',
                         'experiment',
                         'simulation'
                       )
                     ),
  source_type         text not null,
  source_id           text not null,
  source_version      integer not null default 1,
  title               text,
  summary             text not null,
  occurred_at         timestamptz,
  search_text         text not null,
  embedding           vector(1536),
  embedding_model     text,
  content_hash        text not null,
  status              text not null default 'active',
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  unique (user_id, source_type, source_id, source_version)
);
```

第一版所有 `memory_items` 都是私密数据，只允许所有者本人通过 RLS 读取。不要复用它作为公共社区内容池。

### 3.1 Chat 写入

1. 正常保存 messages。
2. 画像信号继续写 `memory_proposals`。
3. 对话形成明确岔路口或结束时，再生成 `memory_items(kind='conversation')`。
4. 摘要保存与 Embedding 解耦；Embedding 失败不影响对话。

### 3.2 日记写入

复用日记 Worker：

1. 转写和结构化分析完成。
2. 以 `entry_uuid + content_version` upsert `memory_items(kind='diary')`。
3. 用户修改转写时创建/更新对应来源版本。
4. 删除日记时同步删除对应经历记忆和 Embedding。

画像候选和经历记忆是两个输出：

- “我可能重视稳定”进入 `memory_proposals`。
- “2026-07-30 的日记讲了辞职前的担心”进入 `memory_items`。

### 3.3 人生实验室

选择卡生成本身不写长期经历。只有用户实际提交的选择、实验、结果和复盘才能进入 `memory_items`。AI 推演的未来情景不能被记录成用户真实经历。

## 4. 下一阶段：混合检索

未来的 `memory-context.ts` 接口：

```ts
type MemoryContextRequest = {
  userId: string;
  query: string;
  purpose: "chat" | "lab" | "match" | "persona" | "community";
  factLimit?: number;
  memoryLimit?: number;
};
```

流程：

```text
本人的 profile facts
        +
query embedding → 私有 memory_items Top K
        +
当前请求内容
        ↓
有来源、有确认状态、有字符预算的上下文
```

建议：

- 事实 8–12 条。
- 经历记忆 3–5 条。
- 混合向量相似度、时间、kind 和来源状态。
- Embedding 失败时回退到最近且同 kind 的经历。
- 检索结果作为数据，不作为系统指令，防止历史文本中的提示注入。

## 5. 公共经历与相似匹配

公共经历应使用独立的社区/旅人发布模型，不直接公开用户私有 `memory_items`。

规模变大后采用：

```text
结构化硬过滤
→ pgvector 召回 Top 20
→ LLM 在候选内选择 3 条并解释
→ 代码校验 ID、发布状态、真实性和唯一性
```

硬过滤必须在 SQL/RPC 内完成：

- 已发布
- 未删除/屏蔽
- 真人来源经过验证
- 允许用于匹配

LLM 只能解释相关性和差异，不能创造 traveler ID，也不能决定内容是否公开。

AI 生成的推演人物必须标记为 `ai_generated`，不能混入真人经历池。

## 6. 安全边界

- 不自动保存心理诊断。
- 不把一次情绪保存成稳定人格。
- 不把第三方敏感信息提炼成用户事实。
- 危机信号只用于当次安全响应，不进入普通长期记忆。
- 日志和 AI 使用回执不记录事实值、查询原文、对话或日记。
- 删除来源后，相关候选、经历记忆和 Embedding 必须按产品语义删除或失效。
- 用户的私密事实和经历不能成为另一个用户的推荐证据。
- 真人验证字段由可信服务管理；客户端不能自我声明验证成功，公开层只暴露 `is_verified`。
- 注销账号通过外键级联删除事实、证据、候选和未来的私有经历记忆。

## 7. 实施顺序

### 已完成：画像事实层

- 删除 `profiles.dims` 和 `profile_dimensions`。
- Web/iOS/Edge 统一读取 `profile_facts`。
- AI 写入改为 proposal → user review。
- 增加 evidence、assessment runs、事实级公开/私人边界和单一 `profile_revision`。
- 拆分私有主页草稿与安全发布表。
- 接入 Chat、Persona、Match、Lab、Simulation、Community 的受控读取。

### 下一步 1：私有经历记忆

- 新建 `memory_items` 与 RLS。
- Chat/日记/实验按稳定来源版本写入。
- 实现混合检索和 Embedding 回退。
- 加入来源删除、编辑和重建测试。

### 下一步 2：公共经历检索

- 为实际社区业务表增加来源、验证、发布和搜索字段。
- 生成公共内容 Embedding。
- `/match` 改为候选召回后再让 LLM 选择。
- 隔离 AI 生成内容与真人经历。

## 8. 升级框架的触发条件

| 真实问题 | 再考虑 |
|---|---|
| 自动提取质量长期不稳定 | Mem0 对照实验 |
| 需要复杂时间和人物关系变化 | Graphiti/Zep |
| 大量长文、多格式文档切分 | LlamaIndex |
| pgvector 实测性能不足 | Qdrant |
| Agent 需要暂停、审批、恢复和回放 | LangGraph checkpoint |

在真实指标证明需要之前，继续使用 Postgres/Supabase 的显式表、RLS、RPC 和可测试的数据流。
