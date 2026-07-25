# 万花筒后端

后端由 Supabase Postgres/Auth/Storage 和 12 个 Deno Edge Functions 组成：

- `chat`：流式对话，保存消息，并行抽取画像与岔路口信号。
- `match`：从数据库中的旅人资料生成 3 条不重复、结局有差异的匹配。
- `simulate`：生成一般、乐观、警示三种未来情景并落库。
- `analyze-diary`：提取情绪、关键词、画像更新并落库。
- `list-diary`：分页返回当前用户的日记列表。
- `diary-summary`：按月/年聚合日记统计并生成 LLM 洞察与高光（失败降级为统计文案）。
- `save-profile` / `get-profile`：画像维度、卡牌结果、公开主页的读写。
- `list-conversations`：会话列表与历史消息。
- `community`：万花筒抽取、悬赏列表/详情/发布/回应、旅人列表。
- `lab-choices`：人生实验室选择卡生成。
- `persona`：动态数字形象生成与任务查询。

## 本地检查

```bash
npm install
npm test
npm run seed:generate
```

`npm test` 会执行格式检查、lint、全部函数的严格类型检查和公共契约单元测试。

完整数据库验证需要 Docker 能拉取 Supabase 镜像：

```bash
npm run db:start
npm run db:test
```

`db:test` 会重建本地数据库、应用全部 migration/seed，并验证公开内容权限、用户数据隔离、消息归属和 Storage 用户目录隔离。`seed:generate` 会从最新原型重建旅人、详情、服务和悬赏数据。

## 本地函数

```bash
cp supabase/functions/.env.example supabase/.env.local
# 在 supabase/.env.local 中填写 ANTHROPIC_API_KEY
npx supabase functions serve --env-file supabase/.env.local
```

Edge Runtime 会自动注入 `SUPABASE_URL` 和 `SUPABASE_ANON_KEY`。Claude
兼容网关通过 `ANTHROPIC_BASE_URL` 配置。模型可用
`ANTHROPIC_CHAT_MODEL`、`ANTHROPIC_STRUCTURED_MODEL` 和
`ANTHROPIC_DIARY_MODEL` 覆盖。

所有业务函数都要求：

```http
Authorization: Bearer <supabase-user-jwt>
apikey: <supabase-anon-key>
Content-Type: application/json
```

## 部署

线上优先流程（不需要启动本地 Supabase）：

```bash
npx supabase link --project-ref <project-ref>
npx supabase db push
npx supabase secrets set --env-file supabase/.env.local
npx supabase functions deploy chat
npx supabase functions deploy match
npx supabase functions deploy simulate
npx supabase functions deploy analyze-diary
npx supabase functions deploy diary-summary
```

不要把 `supabase/.env.local` 或真实密钥提交到仓库。
