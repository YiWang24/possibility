# 卡牌游戏平台

卡牌内容由后端版本化发布，Web 与 iOS 只实现固定的
`trade_down_v1` 规则引擎。新增游戏、卡牌、情境、文案或调整数量时不需要修改
客户端代码；只有新增玩法机制或升级数据协议时才需要发版。

## 数据边界

| 表 | 用途 | 客户端权限 |
| --- | --- | --- |
| `card_games` | 游戏稳定 key、状态和大厅顺序 | 只读已公开游戏 |
| `card_game_catalog_versions` | 完整目录 JSON、版本、hash、引擎与分析版本 | 只读 published/archived |
| `card_game_sessions` | 当前权威状态、固定牌库版本和随机 seed | 用户只读自己的 |
| `card_game_actions` | 有序动作日志和可选的交换理由 | 用户只读自己的 |
| `card_game_runs` | 不可变历史结果、展示快照和 AI 快照 | 用户只读自己的 |
| `card_game_results` | 旧客户端需要的“每类最新结果”投影 | 迁移期兼容 |

客户端不能直接写上述 v2 表。`card-game-session` 在服务端复放并校验动作，
再调用 service-role-only RPC 原子写入动作、状态和结果。完成一局时还会更新
`profile_facts`；旧客户端继续通过 `card_game_results` 工作。

## 客户端全流程

1. 大厅 GET `card-game-catalog`，读取当前发布版本 manifest。
2. 客户端用 `game_key + version + content_hash` 缓存完整目录。
3. 新局固定目录版本和随机 seed；断网动作先进入当前用户专属的本地队列。
4. `start` 幂等创建会话，`sync` 按连续 sequence 批量提交动作。
5. 服务端根据目录和 seed 重放状态机，不接受客户端上传最终结果。
6. `complete` 再次复放完整动作，生成 `card_game_runs`、AI 快照、旧版投影和
   画像事实，并在一个数据库事务内完成。
7. AI 请求只读取每种游戏最近一次结构化快照；不把交换理由原文放进通用
   AI 上下文，并始终附带“不是稳定人格或心理诊断”的限制。

已发布版本可长期缓存且内容不可修改。进行中的会话始终使用其固定版本，即使
后台已发布新版，也不会在一局中途换牌或换规则。

## Catalog v1

目录 JSON 包含：

- `game`：稳定 key、标题、介绍、画像维度和内容提示。
- `rules`：初选数、最终数、每轮交换数、候选情境数、压力范围与变化。
- `display`：颜色、图标、规则文案和每个压力等级文案。
- `groups/cards`：稳定 key、显示内容，以及供结果计算使用的 AI signals。
- `stages/scenarios`：以交换次数激活的阶段、情境主题和严重度。
- `analysis`：信号权重、截断范围和决策模式阈值。

发布前的共享校验器会检查稳定 key、唯一性、引用关系、卡牌数量可整除、所有
压力文案、每阶段候选数、合法画像维度和 AI 信号范围。它是有意收敛的协议，
不是任意规则 DSL。

## 发布新游戏或版本

1. 准备符合 `CardGameCatalog` 的 JSON，并用
   `validateCardGameCatalog` 校验。
2. 新游戏先插入 `card_games`；已有游戏沿用原 `game_key`。
3. 以递增 `version` 向 `card_game_catalog_versions` 插入 `draft`。
4. 用 service role 调用：

   ```sql
   select public.publish_card_game_catalog_v1('game_key', 2);
   ```

发布 RPC 会锁定游戏、计算规范 JSON 的 SHA-256、归档旧 current 版本并原子
发布新版本。数据库触发器禁止修改或删除已发布内容。

当前内置四套 v1 目录由 `scripts/build-card-game-seed.ts` 生成；该脚本也会运行
完整目录校验。后续版本应直接维护目录数据，不再复制进 Web 或 iOS 源码。

## 兼容与隐私

- Web `localStorage` 与 iOS `UserDefaults` 的进度、完成标记和同步队列都按
  `user_id` 隔离；升级时旧版无作用域缓存只迁移一次。
- 网络不可用时优先读固定版本缓存；内置四套游戏仍有 v1 应急内容。
- 交换理由最多 500 字，只存在私有动作历史和旧结果兼容数据中。
- `ai_snapshot` 只保存最终牌、行为指标、聚合信号、证据引用和限制，不复制
  用户原话。
