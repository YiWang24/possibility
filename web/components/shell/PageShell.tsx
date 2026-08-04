/* 页面外壳 —— 全站唯一的宽度与分栏出口，取代 PageContainer + PageGrid。

   为什么合并成一个组件：原来宽度由 PageContainer 决定、分栏由 PageGrid 决定，
   两者可以自由组合出四档宽度 × 两种栏式，结果是每页各挑一套，
   桌面上出现 4 条互不对齐的内容左边界。这里只留一个外框（max-w-shell），
   页面之间的差异全部靠「有没有轨」「轨在哪边」表达，中轴线因此唯一。

   header 跨满内容宽而不是只跨主栏 —— 页面标题对齐外框，
   分栏只发生在标题之下，层级才立得住。 */

type RailSide = "start" | "end";

interface PageShellProps {
  children: React.ReactNode;
  /** 通栏页头，位于分栏之上；对齐外框中轴而非主栏 */
  header?: React.ReactNode;
  /** 侧轨内容；为空时退化成单列，不产生空栅格 */
  rail?: React.ReactNode;
  /** 侧轨落在主栏左侧还是右侧（默认右侧） */
  railSide?: RailSide;
  /** 侧轨是否 sticky 跟随。内容长于一屏的轨要关掉，否则底部会被裁掉 */
  stickyRail?: boolean;
  /** 手机端是否也展示侧轨；详情页的画像伴随轨只属于桌面布局 */
  railOnMobile?: boolean;
  /** 页头是否在手机端可见；详情页可改用自己的 iOS 风格返回栏 */
  headerOnMobile?: boolean;
  /** 手机详情页使用 20px 内容边距，并紧贴自己的返回栏 */
  compactMobile?: boolean;
  className?: string;
}

export function PageShell({
  children,
  header,
  rail,
  railSide = "end",
  stickyRail = true,
  railOnMobile = true,
  headerOnMobile = true,
  compactMobile = false,
  className = "",
}: PageShellProps) {
  const rootClassName = compactMobile
    ? "shell-gutter mx-auto w-full max-w-shell pb-[calc(env(safe-area-inset-bottom)+40px)] pt-0 max-md:px-5 md:pb-16 md:pt-12 xl:pb-24 xl:pt-14"
    : "shell-gutter mx-auto w-full max-w-shell pb-16 pt-[calc(env(safe-area-inset-top)+20px)] md:pt-12 xl:pb-24 xl:pt-14";
  const splitClassName = header
    ? `${headerOnMobile ? "mt-6" : "md:mt-6"} lg:mt-10 ${className}`
    : className;

  return (
    <div className={rootClassName}>
      {header ? (
        <div className={headerOnMobile ? undefined : "hidden md:block"}>{header}</div>
      ) : null}
      <PageSplit
        rail={rail}
        railSide={railSide}
        stickyRail={stickyRail}
        railOnMobile={railOnMobile}
        className={splitClassName}
      >
        {children}
      </PageSplit>
    </div>
  );
}

/* 主栏 + 侧轨栅格。手机/平板单列纵向堆叠（与 iOS 一致），lg 起才拆两栏。
   分栏用 minmax 而不是固定 px：轨有下限（太窄画像缩略图就糊了）也有上限
   （太宽会把主栏挤到读不下去），主栏吃掉剩下的全部。 */
function PageSplit({
  children,
  rail,
  railSide,
  stickyRail,
  railOnMobile,
  className = "",
}: {
  children: React.ReactNode;
  rail?: React.ReactNode;
  railSide: RailSide;
  stickyRail: boolean;
  railOnMobile: boolean;
  className?: string;
}) {
  if (!rail) {
    return <div className={`flex flex-col ${className}`}>{children}</div>;
  }

  const railFirst = railSide === "start";

  /* DOM 顺序 = 单列时的纵向顺序，不靠 order 兜底 ——
     左轨（名片这类身份信息）在阅读顺序上本就该排主栏前面，
     右轨是补充信息，排主栏后面。两种情况手机上的堆叠顺序都自然成立。 */
  const template = railFirst
    ? "lg:grid-cols-[minmax(280px,var(--rail))_minmax(0,1fr)]"
    : "lg:grid-cols-[minmax(0,1fr)_minmax(280px,var(--rail))]";

  /* sticky 起点让开顶栏再留 32px 呼吸，否则轨滚上去会钻到顶栏底下 */
  const railNode = (
    <aside
      className={`${railOnMobile ? "flex" : "hidden lg:flex"} min-w-0 flex-col ${
        stickyRail ? "lg:sticky lg:top-[calc(var(--nav-h)+2rem)] lg:self-start" : ""
      }`}
    >
      {rail}
    </aside>
  );
  const mainNode = <div className="flex min-w-0 flex-col">{children}</div>;

  return (
    <div
      className={`grid grid-cols-1 gap-6 ${template} lg:items-start lg:gap-8 xl:gap-10 ${className}`}
    >
      {railFirst ? railNode : mainNode}
      {railFirst ? mainNode : railNode}
    </div>
  );
}
