# 语音日记接入灵光真实能力 · 设计

日期：2026-08-06
范围：把语音日记的「录音 → 转写 → 提取关键词」闭环从 mock 换成灵光真实接口。
不在本次范围：月度/年度总结（继续使用现有演示数据）。

---

## 一、现状

语音日记目前全部是 mock，没有任何 `lingguang.*` 调用：

| 位置 | 现状 |
|---|---|
| `DiaryCard` 录音按钮 | 假录音：1 秒 timer + CSS 波形，不访问麦克风 |
| 完成后的情绪关键词 | 硬编码「平静 / 工作节奏 / 一点疲惫 / 对未来好奇」 |
| 一周圆点 | 硬编码 2026-07-17~23 |
| `DIARY_ENTRIES` | 30 条静态 7 月种子数据 |
| `DIARY_RECORDED_ENTRY` | 定义了但从未被引用，是死代码 |
| 月度/年度总结 | 全部硬编码常量（本次不动） |

## 二、可用能力与约束

- `lingguang.asr.start/stop/abort` — 实时语音转文字。`onText` 每次推送**从开始到当前的完整文本**，直接覆盖 UI，不可累加。
- `lingguang.ai.chat({ messages, responseFormat })` — 非流式 LLM，`responseFormat` 支持 `json_schema`，结构化结果从 `result.data` 读取。
- **关键约束**：ASR 只输出文字，**不录制也不保存音频文件**。因此没有音频回放；`duration` 由本地对会话计时得出。本次不额外接音频录制 API。
- `global.d.ts` 只声明了 legacy `callLLM` / `ai.llmStream`，**缺 `ai.chat` / `ai.streamChat` 类型**，需要自行补充声明。
- ASR 要求宿主 `min_client_version` 1.0.52，低版本上 `lingguang.asr` 不存在，必须降级而非崩溃。

## 三、方案选择

采用**转写与分析两段式**：录音过程实时转写并显示，点「完成」后再做一次 LLM 结构化抽取。

两段各自可独立失败与重试。最重要的性质是：**ASR 成功而 LLM 失败时，转写原文照常落盘**，只是关键词留空并提供重试入口——用户说过的话在任何情况下都不会丢。

已否决的替代方案：
- *边说边流式分析*：完成即出结果，但多次消耗 LLM 额度，且半截文本抽出的关键词会来回跳变。
- *关键词延后到打开详情再生成*：录音闭环最快，但首页卡片「今天的情绪关键词」是核心展示位，延后即空着，产品体验倒退。

## 四、模块划分

镜像 `src/screens/me/` 的既有分层（`myProfileStorage.ts` 持久化 + `myProfileStore.ts` zustand 跨组件同步），放在 `src/screens/home/diary/`：

| 文件 | 职责 | 依赖 |
|---|---|---|
| `diaryAsr.ts` | 包一层 `lingguang.asr` 生命周期：能力探测、start/stop/abort、错误码映射成可操作的中文提示 | `window.lingguang.asr` |
| `diaryAnalyze.ts` | 调 `ai.chat`，用 `json_schema` 约束返回 `{title, emotion, emoji, keywords}`，并对响应做防御性解析 | `window.lingguang.ai.chat` |
| `diaryStorage.ts` | localStorage 持久化 + schema 归一化 + 与种子数据合并 | 无 |
| `diaryStore.ts` | zustand：entries、录音态、实时转写文本、分析态 | 上面三者 |
| `lingguang-ai.d.ts` | 补 `ai.chat` / `ai.streamChat` 类型声明 | 无 |

`DiaryCard.tsx` / `DiaryDay.tsx` 保持薄，只读 store 渲染。

选择 zustand 而非组件内 state 的原因：`DiaryCard`（首页）与 `DiaryPush`/`DiaryDay`（push 页）是树中的兄弟节点，录完必须双向同步。这与 `myProfileStore.ts` 注释里写明的动机完全一致。

## 五、数据流

```
按下「记录今日」
  → 能力探测：lingguang.asr 不可用 → 降级为手动输入
  → asr.start({ lang:'zh-CN', interim:true, continuous:true })
  → onText 推完整文本 → 覆盖显示（用户实时看到转写）
  → 本地计时得出 duration
点「完成」
  → asr.stop() → 取最终文本
  → 文本为空 → 提示「没听清，再说一次」，不落盘
  → ai.chat(json_schema) → { title, emotion, emoji, keywords }
      ├─ 成功 → 合并成 DiaryEntry 落盘 → 首页卡片与详情页同步刷新
      └─ 失败 → 仍落盘转写原文，关键词区显示「重新分析」
```

## 六、存储与数据合并

真实日记按**真实日期**存入 localStorage（应用的 `index.html` 声明了 `data-localstorage-bridge="kv-v1"`，localStorage 已被宿主桥接）。沿用 `myProfileStorage.ts` 的 throw-safe 读写与归一化写法：每次读取都假设数据可能来自旧版本，可能缺字段、类型不一致或结构已变。

读取时与 30 条 7 月种子数据合并，**同一天以真实记录优先**。首页一周圆点改为按真实日期渲染，有记录的天填充其 emoji。

## 七、错误处理

ASR 的 7 种错误码分别映射为可操作提示：

| 错误码 | 处理 |
|---|---|
| `not-allowed` | 提示授予麦克风权限 |
| `audio-capture` | 提示设备被占用或不可用 |
| `no-speech` | 提示没听清，可再说一次 |
| `network` | 提示网络问题，可重试 |
| `engine` / `unknown` | 通用失败提示，可重试 |
| `aborted` | 静默处理（用户主动中止或系统打断） |

宿主版本过低导致 `lingguang.asr` 不存在时，直接进入手动输入降级路径，不抛错、不崩页。单条脏持久化数据同样不得导致页面崩溃。

## 八、验收

- 真机预览中按下录音可看到实时转写文字随说话更新。
- 完成后 1–3 秒内出现标题、情绪与关键词，并同步到首页卡片和日记详情页。
- 断网或 LLM 失败时，转写原文仍然保存，关键词区可重试。
- 拒绝麦克风权限时给出明确提示，不崩页。
- 7 月演示数据仍在，真实记录按真实日期叠加，同一天以真实记录优先。
- `npm run check` 通过。

## 九、测试

仓库装了 vitest 但完全没有接线（无配置、无脚本、无测试文件）。本次补最小配置，仅覆盖不依赖宿主的纯逻辑：

- `diaryStorage` 的归一化：缺字段、类型不一致、结构变更、单条脏数据不崩。
- `diaryAnalyze` 的响应解析：`data` 缺失、字段类型错误、关键词非数组等。

`npm run check` 的定义**不改动**，避免变更项目既有门禁；测试通过独立的 `npm run test` 运行。ASR 与 LLM 本身依赖宿主环境，靠真机预览验证。
