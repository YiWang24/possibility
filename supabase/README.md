# 万花筒 KALEIDO · 后端（Supabase）

Postgres + 匿名 Auth + Storage + Edge Functions(Deno/TS) + Claude。
架构见根目录 `技术设计文档.md` 与 `后端开发架构.md`。

## 目录
```
supabase/
├─ config.toml                 # 项目/函数配置（verify_jwt、匿名登录）
├─ migrations/                 # 0001 schema · 0002 rls · 0003 storage
├─ seed.sql                    # 由 scripts/gen_seed.mjs 从原型 HTML 生成
└─ functions/
   ├─ _shared/                 # anthropic · auth · validate · cors · errors · prompts · schemas · llm
   ├─ chat/                    # 流式对话 + 岔路口信号
   ├─ match/                   # 3 位旅人 + 匹配理由（结构化）
   ├─ simulate/                # 3 种未来（结构化）
   └─ analyze-diary/           # 情绪/关键词（Haiku）
scripts/
├─ gen_seed.mjs                # 原型 HTML → seed.sql（node）
├─ verify_db.sh                # 一次性 Postgres 容器验证 migrations+seed（无需 Supabase CLI）
└─ _verify_shims.sql           # 纯 PG 验证用的 auth/storage stub
```

## 前置
- Supabase CLI · Docker（本地栈）· Deno（Edge 运行时，CLI 自带）
- Anthropic API Key

## 本地开发
```bash
supabase start                              # 起本地 Postgres/Studio/Functions
supabase db reset                           # 应用 migrations/*.sql + seed.sql
supabase secrets set ANTHROPIC_API_KEY=sk-ant-...
cp supabase/functions/.env.example supabase/functions/.env   # 填本地 Key
supabase functions serve chat               # 本地调试流式（逐个 serve）
```

## 生成 / 更新种子
```bash
node scripts/gen_seed.mjs                    # 重生成 supabase/seed.sql
```

## 无 Supabase CLI 时验证数据层（本仓已用它验过）
```bash
bash scripts/verify_db.sh                    # Docker 起 postgres:16，应用 shims+migrations+seed，打印行数与 RLS 策略
```
> ⚠️ `scripts/_verify_shims.sql` 只是纯 PG 验证用的最小 auth/storage stub；真实 Supabase 栈自带这些 schema，勿在生产使用。

## 部署
```bash
supabase db push                             # 线上应用 migrations
supabase functions deploy chat match simulate analyze-diary
supabase secrets set ANTHROPIC_API_KEY=sk-ant-...   # 线上密钥
```

## 契约速查
| Function | 入参 | 出参 |
|---|---|---|
| `POST /chat` | `{topic, message, conversation_id?, history?}` | SSE：`event: token/meta/done`（done 含 `conversation_id` 与岔路口 `signals`） |
| `POST /match` | `{user_state}` | `{matches:[{traveler_id,reason,not_applicable}]}` |
| `POST /simulate` | `{question, choice, years(1-10)}` | `{id, scenarios:{general,optimistic,cautionary}}` |
| `POST /analyze-diary` | `{transcript, audio_path?}` | `{id, emotions[], keywords[], dim_updates[]}` |

所有函数 `verify_jwt=true`；`chat` 流式需客户端用 `URLSession.bytes` 直连（见技术设计文档 §8.3）。
