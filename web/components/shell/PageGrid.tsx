/* 主栏 + 侧轨栅格 —— 桌面分栏的统一出口。
   手机/平板单列纵向堆叠（与 iOS 一致），lg 起才拆成两栏：
   主栏承载操作流，侧轨放常驻信息（名片、画像、统计），并 sticky 跟随滚动。
   分栏比例用 fr 而不是固定 px，1440 与 1920 上都不会出现「一栏撑爆、一栏留白」。 */

type RailSide = "start" | "end";

interface PageGridProps {
  children: React.ReactNode;
  /** 侧轨内容；为空时退化成单列，不产生空栅格 */
  rail?: React.ReactNode;
  /** 侧轨落在主栏左侧还是右侧（默认右侧） */
  railSide?: RailSide;
  /** 侧轨是否 sticky 跟随（内容短的轨道才适合，长内容会被裁掉） */
  stickyRail?: boolean;
  className?: string;
}

export function PageGrid({
  children,
  rail,
  railSide = "end",
  stickyRail = true,
  className = "",
}: PageGridProps) {
  if (!rail) {
    return <div className={`flex flex-col ${className}`}>{children}</div>;
  }

  const railFirst = railSide === "start";

  /* DOM 顺序 = 单列时的纵向顺序，不靠 order 兜底 ——
     左轨（名片这类身份信息）在阅读顺序上本就该排主栏前面，
     右轨是补充信息，排主栏后面。两种情况手机上的堆叠顺序都自然成立。 */
  const template = railFirst
    ? "lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] xl:grid-cols-[minmax(300px,22rem)_minmax(0,1fr)]"
    : "lg:grid-cols-[minmax(0,7fr)_minmax(0,5fr)] xl:grid-cols-[minmax(0,1fr)_minmax(300px,22rem)]";

  /* sticky 起点要让开全站 navbar（74px）再留 32px 呼吸，
     否则侧轨滚上去会钻到 navbar 底下。 */
  const railNode = (
    <aside
      className={`flex min-w-0 flex-col ${
        stickyRail ? "lg:sticky lg:top-[calc(74px+2rem)] lg:self-start" : ""
      }`}
    >
      {rail}
    </aside>
  );
  const mainNode = <div className="flex min-w-0 flex-col">{children}</div>;

  return (
    <div
      className={`grid grid-cols-1 gap-6 ${template} lg:items-start lg:gap-8 xl:gap-12 ${className}`}
    >
      {railFirst ? railNode : mainNode}
      {railFirst ? mainNode : railNode}
    </div>
  );
}
