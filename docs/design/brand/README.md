# Possibility · 品牌标记

产品名统一为 **Possibility**（不再带副名）。这里放它的 IP 标记与对外露出的成品图。
`万花筒` 之后只作为**功能名**使用（万花筒社区 / 万花筒抽人动画），不再是产品名的一部分。

## 主标记

| 文件 | 用途 |
|---|---|
| [`possibility-mark.svg`](possibility-mark.svg) | 唯一母版，改动只改这里 |
| `possibility-mark-1024.png` | App / 商店尺寸 |
| `possibility-mark-512.png` | 通用大图 |
| `possibility-mark-256.png` | README 头图（当前引用的就是这张） |
| `possibility-mark-32.png` | 最小可读性验收：32×32 下仍要认得出耳朵与口鼻 |
| [`possibility-social-preview.png`](possibility-social-preview.png) | GitHub 仓库社交预览图（1280×640），另存 `.svg` 源 |

社交预览图要在 GitHub 仓库 **Settings → General → Social preview → Upload an image** 手动上传，
这一项不走 git，仓库里存的是待上传的成品。

### 造型与配色

「光芽小兽」——蓝身是 *AI 接住迷茫*，暖杏口鼻是 *真人经验的那点温度*，两只钝圆耳表示「在听」。

| 角色 | 色值 | 来源 |
|---|---|---|
| 主体 | `#5E96FF` | `Theme.brand.blue` / `--color-brand` |
| 第二色块（口鼻） | `#FFB067` | `Theme.brand.apricot` / `--color-apricot` |
| 底色（并复用为眼睛与嘴） | `#0F1426` | 贴近 `--color-stage` `#05070D`，抬亮一档以便在 GitHub 浅色主题下不糊成一块黑 |

全图只有这三个语义色，没有描边、没有渐变、没有投影——所以缩到 32×32 也不会烂掉。

## 六个候选

标记按 [`ip-as-logo`](https://github.com/s1dashu/ip-as-logo-skill) 的规则做：一条连续轮廓、
4–7 个大色块、两个 IP 色 + 一个底色、只用钝圆收尾、主体占画面 75–85% 并从下缘裁切、32×32 可读。
三个方向 × 两套配色 = 六张独立候选，全部保留在 [`candidates/`](candidates/)，
`B1` 被选为主标记。

| 编号 | 方向 | 与产品的连接 | 轮廓 | 配色 |
|---|---|---|---|---|
| A1 / A2 | 光球小灵 | AI 对话承接迷茫——沿用 iOS 的光球签名动画 | 一颗大圆球 + 内部升起的暖光 | 蓝+杏 / 杏+深蓝 |
| **B1** / B2 | **光芽小兽** | 迷茫被接住之后长出来的那点可能性 | 大圆头 + 两只钝圆耳 + 暖色口鼻 | **蓝+杏** / 紫+杏 |
| C1 / C2 | 指路小鸟 | 岔路口的中立向导：指路但不替你决定 | 蛋形身体 + 两片圆翅 + 宽钝喙 | 蓝+橙 / 品红+杏 |

## 出图

PNG 全部由 SVG 母版生成，不要手改：

```bash
docs/design/brand/render.sh
```

脚本沿用 `docs/marketing/posters/render.sh` 的路子——不装依赖，直接调本机 Chrome 截图；
Chrome 不在默认路径时用 `CHROME=/path/to/chrome ./render.sh` 指过去。

换主标记时把对应候选的 SVG 覆盖到 `possibility-mark.svg`，再跑一次 `render.sh` 即可，README 不用改。
