# Possibility · Web Mock（手机版 Web 页面）

灵光赛道演示用的**纯静态、纯 mock** 手机版 Web 应用,由高保真原型 `万花筒-认识自己-原型.html` 改造而来,**完美复刻手机端效果**:

- 手机浏览器打开 → 全屏原生 App 观感。
- 桌面浏览器打开 → 居中一个手机宽度的竖列(移动页面在大屏上的预览),背景极光全幅铺满。
- 无后端、无构建步骤、无依赖:单个自包含的 `index.html`,任何静态托管都能直接跑。

## 包含的页面 / 流程(全部接通)

- **4 个主 Tab**:认识自己(Home)· 人生实验室(Lab)· 万花筒社区(Community)· 我的主页(Me)
- **Push 页**:探索对话 / 探索总结 / 语音日记详情 / 悬赏详情 / 推演结果 / 用户主页 / 编辑主页
- **浮层与游戏**:画像工作室测评 · 处境扫描 · 统一测评引擎 · 万花筒抽取 · 人生 / 婚姻 / 家庭卡牌游戏 · 动态画像维度浮层 · 推演加载 · Toast

## 本地预览

```bash
cd web
python3 -m http.server 5173
# 打开 http://localhost:5173  (手机效果:开浏览器 DevTools 设备模拟,选 iPhone)
```

## 部署(任选其一)

单文件静态站,把 `web/` 作为发布根目录即可:

| 平台 | 操作 |
| --- | --- |
| **Vercel** | 新建项目 → Root Directory 设为 `web` → Framework Preset 选 `Other` → Deploy |
| **Netlify** | `Publish directory` 设为 `web`,无 build 命令 |
| **GitHub Pages** | 把 `web/` 内容推到 `gh-pages` 分支,或 Pages 源目录指向 `/web` |
| **Cloudflare Pages** | Build output directory 设为 `web`,无 build 命令 |

> 也可以直接 `python3 -m http.server` 或双击 `index.html`(`file://`)本地演示。

## 说明

- 这是**演示 mock**:数据全部为内置假数据,交互为前端本地状态,不发任何网络请求。
- 为最大化部署健壮性与保真度,`index.html` 有意保持**单文件自包含**(源自高保真原型),未做模块化拆分。
