import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { ImageResponse } from "next/og";
import { BRAND_STAGE, SITE_DESCRIPTION, SITE_NAME } from "@/lib/site";

export const alt = `${SITE_NAME} —— ${SITE_DESCRIPTION}`;
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

// 构建期生成一张静态 PNG，运行时不再渲染。
export const dynamic = "force-static";

/**
 * 字体在构建机上读取。Vercel 的 Root Directory 设成 `web` 或仓库根都可能，
 * 两个位置都试一遍；都拿不到就抛错让构建红掉，而不是产出一张豆腐块图。
 */
async function loadFont(file: string): Promise<Buffer> {
  const candidates = [
    join(process.cwd(), "assets/fonts", file),
    join(process.cwd(), "web/assets/fonts", file),
  ];

  for (const path of candidates) {
    try {
      return await readFile(path);
    } catch {
      // 换下一个候选路径
    }
  }

  throw new Error(`OG 字体缺失：${file}（已尝试 ${candidates.join("、")}）`);
}

const AURORA = "linear-gradient(120deg, #5e96ff 0%, #8f7bff 38%, #e35cc1 72%, #ff7a4d 100%)";

export default async function OpengraphImage() {
  const [regular, bold] = await Promise.all([
    loadFont("NotoSansSC-400-subset.ttf"),
    loadFont("NotoSansSC-700-subset.ttf"),
  ]);

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: "72px 80px",
          background: BRAND_STAGE,
          position: "relative",
          fontFamily: "Noto Sans SC",
        }}
      >
        {/* 右下角的极光辉光：把重心压到对角，避免居中式模板感 */}
        <div
          style={{
            position: "absolute",
            right: -260,
            bottom: -320,
            width: 900,
            height: 900,
            borderRadius: "50%",
            background:
              "radial-gradient(circle, rgba(143,123,255,0.42) 0%, rgba(227,92,193,0.20) 42%, rgba(5,7,13,0) 70%)",
          }}
        />
        {/* 左上冷调辉光，和右下暖调形成温度对比 */}
        <div
          style={{
            position: "absolute",
            left: -200,
            top: -280,
            width: 700,
            height: 700,
            borderRadius: "50%",
            background:
              "radial-gradient(circle, rgba(94,150,255,0.28) 0%, rgba(5,7,13,0) 68%)",
          }}
        />

        {/* 眉标 */}
        <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
          <div
            style={{
              width: 40,
              height: 40,
              borderRadius: 12,
              background: AURORA,
              display: "flex",
            }}
          />
          <div style={{ display: "flex", fontSize: 30, color: "#98a0b3", letterSpacing: 1 }}>
            {SITE_NAME}
          </div>
        </div>

        {/* 主标题：尺度对比 + 渐变承接第二行，形成层级 */}
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <div style={{ display: "flex", fontSize: 84, color: "#f2f4f9", lineHeight: 1.18 }}>
            认识你自己，
          </div>
          <div
            style={{
              display: "flex",
              fontSize: 104,
              fontWeight: 700,
              lineHeight: 1.14,
              backgroundImage: AURORA,
              backgroundClip: "text",
              color: "transparent",
            }}
          >
            推演你的人生可能性
          </div>
        </div>

        {/* 页脚：细发丝线 + 域名 */}
        <div style={{ display: "flex", alignItems: "center", gap: 24 }}>
          <div style={{ display: "flex", width: 96, height: 3, background: AURORA }} />
          <div style={{ display: "flex", fontSize: 30, color: "#5a6172", letterSpacing: 2 }}>
            maybeio.com
          </div>
        </div>
      </div>
    ),
    {
      ...size,
      fonts: [
        { name: "Noto Sans SC", data: regular, weight: 400, style: "normal" },
        { name: "Noto Sans SC", data: bold, weight: 700, style: "normal" },
      ],
    },
  );
}
