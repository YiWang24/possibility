# 万花筒 KALEIDO — 产品 Demo 视频

用 [Remotion](https://remotion.dev) 把一段 iPhone 功能录屏剪成产品 demo。
一份剪辑表 (`src/kaleido/script.ts`) 驱动三个成片，改一处三个版本一起变。

| Composition | 画幅 | 时长 | 用途 |
| --- | --- | --- | --- |
| `KaleidoDemo` | 1920×1080 | ~68s | 官网首页、Deck、Demo Day |
| `KaleidoDemoVertical` | 1080×1920 | ~68s | 竖屏长版 |
| `KaleidoTeaser` | 1080×1920 | ~20s | 小红书 / 抖音获客 |

## 快速开始

```bash
npm i
npm run clips -- /path/to/Feishu20260725-105403.mp4   # 从原始录屏切出素材
npm run dev                                            # 打开 Remotion Studio
```

素材不进 Git（~50MB 派生媒体），所以新克隆后必须先跑 `npm run clips`。

## 渲染

```bash
npm run render                 # 横屏主版 → out/kaleido-demo.mp4
npm run render:vertical        # 竖屏长版
npm run render:teaser          # 竖屏短版
```

## 原始素材

`Feishu20260725-105403.mp4` — iPhone 录屏，1180×2556，58fps，5分57秒，314MB。

三个必须处理的问题，都已在流程里解决：

1. **0:57–2:25 是 88 秒推演 loading**（占全片 25%）。成片里压成 1.5 秒的一个节拍。
   > 顺带一提：如果这是生产环境的真实耗时，那它是个产品问题，不是剪辑问题。
2. **2:26–2:29 误拉出 iOS 控制中心**。该段整体不取用。
3. **音轨全静音**（3150 万采样点全部落在 -91dB）。切片时 `-an` 直接剥掉，成片靠字幕承载信息。

另外每帧顶部都带录屏红点，`theme.ts` 的 `capture.cropTop` 把状态栏裁掉了 108px，
而不是用色块盖住。

## 叙事

录屏本身是功能巡览（探索顺序），不是故事。成片重排了顺序，因为弧线其实已经存在于素材里：

> 5:44 用户问「我是否要从交互设计师转为产品经理?」
> → 2:30 AI 给出三种三年后的可能
> → 2:48 简宁，一个**真的**从交互设计师转成产品经理、用了三年的人

把 5:44 提到开头，片子立刻有了主角和悬念。中间 `turn` 那个纯文字黑场
（「可它没真的走过这条路」）是全片的转折点——AI 的极限，也正是社区存在的理由。

被砍掉的：大五人格 121 题、恋爱偏好、卡牌四象全流程、服务编辑后台。
都是给已注册用户的深度功能，放 demo 里只稀释主线。四象卡牌值得单独做一支。

## 改剪辑

改 `src/kaleido/script.ts` 就行——片段、入点、时长、文案全在那一个数组里：

```ts
{
  id: "futures",
  mode: "showcase",
  clip: "05-result-likely.mp4",
  trim: 0.5,          // 从片段第 0.5 秒进
  seconds: 7,         // 这个场景持续 7 秒
  accent: "violet",
  kicker: "THREE FUTURES",
  lines: ["三种可能", "连代价一起给你"],
}
```

场景组件是纯展示的，不含任何画幅假设——`SceneView` 从 composition 尺寸推导布局，
所以横屏和竖屏不可能剪辑不同步。

## 设计系统

**配色全部从 App 画面采样**（ffmpeg palettegen 跑光球 / 水晶 / 推演结果三帧），
所以视频看起来属于这个产品，而不是套模板。两个强调色带语义，不可混用：

- **紫 `#986EC2`** — 漏斗的 AI 半段（对话 · 推演 · 结果）
- **青 `#4DB0E1`** — 人的半段（同路人 · 社区 · 经验）

两者的切换点就是全片的叙事转折。

**字体是刻意的双搭配**：Inter 承载宽字距英文小标签，Noto Sans CJK Light 承载中文陈述。
这套「小英文标签 + 大中文」不是凭空来的——App 自己就在用
（`LIKELY` / `KALEIDOSCOPE` / `SYNCED LIVE FORM` / `YOUR FOUNDATION`）。

中文字体是**自托管子集**，不走 Google Fonts。原因是实测出来的：Google 把 Noto Sans SC
按 unicode-range 切成约 98 个分片，每次渲染要发 98 个请求，掉一个就整帧失败——
实际让大约三分之一的渲染挂掉。子集化后是一个 66KB 文件、零网络请求，渲染速度也快了一截。

改完文案要重新生成字体子集：

```bash
npm run font     # 需要 fontTools + brotli 和本机装有 Noto Sans CJK
```

万一漏字，`fonts.ts` 的 CSS 字体栈会退到系统 CJK 字体，不会出豆腐块。

**版式**：横屏是不对称分栏（文字一侧、设备一侧，`flip` 控制左右）；
竖屏直接放弃设备边框——9:19.5 的屏幕塞进 9:16 的画面，
要么够大要么留得下字，不可能兼得——改用满幅出血加压暗层。

## 文件结构

```
src/kaleido/
  script.ts              剪辑表 — 改片子从这里改
  theme.ts               采样配色、字号阶、动效常数、裁切参数
  layout.ts              按画幅推导设备框和文字框
  fonts.ts               Inter（Google）+ 自托管中文子集
  DemoVideo.tsx          按剪辑表拼时间轴
  components/
    SceneView.tsx        单场景合成 + 交叉淡入淡出
    DeviceScreen.tsx     录屏裁切与设备框
    Statement.tsx        英文 kicker + 中文标题的逐行入场
    Backdrop.tsx         底色、强调色辉光、暗角
scripts/
  cut-clips.sh           从原始录屏重建素材（素材不进 Git）
  build-font.py          按剪辑表生成中文字体子集（产物进 Git）
public/fonts/
  kaleido-han.woff2      66KB，206 字形
```

## 还没做的

- **配乐**。原片全静音，成片目前也无声。建议配一条 ~68 秒的氛围乐，
  在 `DemoVideo.tsx` 里加 `<Audio src={staticFile("music.mp3")} />` 即可。
- **旁白**。当前靠字幕承载信息，静音可看。若要投资人版，建议补中文旁白并按旁白重新配速。
- **App Store 预览版**。苹果对预览视频有额外规格限制（时长、只能用实机画面），
  需要时从 `KaleidoTeaser` 派生。
