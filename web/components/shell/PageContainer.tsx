/* 页面容器 —— 全站唯一的内容宽度出口。
   原实现把每一页都锁死在 680px（社区页 1040px），那是 iOS 端的行宽，
   搬到 1440px+ 桌面上就成了浮在黑底里的一根手机窄条。
   这里改成三档语义化宽度令牌，配合 shell-inset 的流体留白按内容密度选择。 */

export type ContainerSize = "measure" | "app" | "board";

const MAX_WIDTH: Record<ContainerSize, string> = {
  /* 阅读流：长文、对话、单步表单。窄是对的，但要比手机宽一档 */
  measure: "max-w-measure",
  /* 应用页：默认档，主栏 + 侧轨的仪表盘式布局 */
  app: "max-w-app",
  /* 看板：社区卡片流等多列网格，桌面铺到 1536px */
  board: "max-w-board",
};

interface PageContainerProps {
  children: React.ReactNode;
  size?: ContainerSize;
}

export function PageContainer({ children, size = "app" }: PageContainerProps) {
  return (
    <div
      className={`shell-inset mx-auto w-full ${MAX_WIDTH[size]} pb-16 pt-8 md:pt-12 xl:pb-24 xl:pt-16`}
    >
      {children}
    </div>
  );
}
