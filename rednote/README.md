# rednote 小工具 · 第一批

把万花筒里**不依赖服务端**的三块内容，拆成三个可独立上架的小红书小工具。

小工具是离线 H5：打包成 `.zip` 由容器（PC 模拟器 / 真机 WebView）加载，**纯本地、不联网**。
所以这一批只收了原产品里零网络请求的部分——AI 对话、语音日记、人生实验室、社区与账号体系都依赖后端，做不进来。

## 三个工具

| 目录 | 产物 | 是什么 | 内容量 |
| --- | --- | --- | --- |
| `holland/` | `dist/holland.zip` | 霍兰德职业兴趣测评，RIASEC 六维 + 双字母代码解读 | 30 题 |
| `strength/` | `dist/strength.zip` | 优势线索探索，从情境反推 5 类优势信号 | 15 题 |
| `cards/` | `dist/cards.zip` | 取舍卡牌，婚姻 / 家庭 / 人际三套牌合一 | 3 × (18 张 + 12 情境) |

三个工具都以**保存图片 / 发布笔记**收尾，是它们唯一的对外出口。

### 为什么卡牌是一个工具而不是三个

三套牌的玩法、状态机、样式完全相同，只有数据不同。合成一个包省下两份运行时和两次审核，
用户在入口页选场景即可；代价是三套牌共用一个 localStorage 命名空间（已按 `kind` 分键，互不覆盖）。

## 构建

```bash
./build.sh              # 打包全部三个
./build.sh cards        # 只打包一个
```

产物在 `dist/<tool>.zip`，可直接上传。脚本会校验 `index.html` 位于 zip 根目录、体积不超上限。

## 测试

```bash
./build.sh && node smoke.js
```

`smoke.js` 用最小 DOM 垫片在 node 里真跑一遍：卡牌从选牌到自然收敛出 3 张、两个测评答满全部题目、
断点续玩、以及三个工具的分享链路（`writeTempFile` → `saveImageToPhotosAlbum` / `postNote` 的字段与长度上限）。
容器里没有构建期，运行期错误只有真跑一遍才会暴露。

## 目录结构

```
rednote/
├── shared/                    # 三个工具共用，打包时复制进各自的 assets/
│   ├── base.css               # 设计系统（深色 editorial）
│   ├── bridge.js              # window.xhs.miniTool.* 封装
│   ├── ui.js                  # 屏幕切换 / toast / DOM 构建 / 分享按钮
│   ├── share-card.js          # Canvas 1080×1440 结果卡
│   ├── assessment-*.js/css    # 两个测评工具共用的引擎与视图
│   └── assessment-index.html  # 两个测评工具共用的外壳（标题在打包时替换）
├── holland/assets/            # 只有 data.js（题库）+ main.js（解读与分享文案）
├── strength/assets/
├── cards/                     # 自带 index.html，玩法与测评不同
│   └── assets/                # cards.css / data.js / engine.js / view.js
├── build.sh
└── smoke.js
```

`shared/` 不会被直接引用——`build.sh` 在组装 `dist/<tool>/assets/` 时复制进去，
保证每个 zip 自包含（容器不允许跨包引用，也没有 CDN）。

## 容器约束（改代码前必读）

这些不是风格偏好，是踩了会白跑一次审核的硬约束：

- **CSP 不含 `unsafe-inline`**：脚本必须是外链经典脚本。不能有内联 `<script>`、`onclick=`、
  `type="module"`、`import`/`export`、`eval`、`new Function`。
- **零网络**：没有 `fetch` / `XMLHttpRequest` / WebSocket，所有资源打进包里。代码里不该出现任何 `http(s)://`。
- **JSBridge 只有 4 个 API**：`postNote`、`saveImageToPhotosAlbum`、`openRedPage`、`writeTempFile`。
  未列出的字段不要传。`writeTempFile` 只吃完整 `data:uri`，裸 base64 会失败。
- **被禁能力**：定位、剪贴板、蓝牙 / USB、各类传感器、Worker、全屏、`window.open`、`window.prompt` 等。
- **打包方式**：必须 `cd dist/<tool> && zip -r ... .` 打包目录**内容**。打包目录本身会多出一层，容器找不到入口。
- **安全区**：用 `var(--safe-area-inset-*, env(safe-area-inset-*, 0px))` 组合——
  PC 模拟器注入 CSS 变量，真机走 `env()`，只写一种会在另一端塌掉。

改完跑一遍扫描：

```bash
grep -rnE "https?://|fetch\(|XMLHttpRequest|type=\"module\"|onclick=" --include='*.js' --include='*.html' .
```

## 已知限制

**五个维度拼成一张自我画像的体验，在小工具形态下不存在。** 工具之间不能互相跳转，
localStorage 也按包隔离，所以三个工具各自独立、结果无法汇总。回流主 App 只能靠 `openRedPage`
或用户发出去的笔记——这是形态本身的代价，不是实现没做完。

其余：

- 测评结果与卡牌进度存在 localStorage，用户清缓存即丢失，没有云端备份。
- 分享卡字体用系统字体栈（`PingFang SC` / `Songti SC`），未打包字体文件以控制体积；
  不同机型渲染会有细微差异。
