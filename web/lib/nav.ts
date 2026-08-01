/* 全站导航结构的单一真源 —— 顶栏、面包屑、专注模式判定共用一份。

   原来这份映射只活在 AppShell 里，于是每个详情页各自造了一条
   「圆形返回按钮 + 标题 + 全宽 border」的横条来交代自己在哪。
   那是 iOS 的 idiom：app 没有浏览器后退键、也没有常驻导航，所以必须自带返回。
   web 两样都有，返回按钮能给的信息量反而比面包屑少 ——
   它只能退一步，且不告诉你身在第几层。 */

export interface TabDef {
  key: string;
  href: string;
  label: string;
}

export const TABS: TabDef[] = [
  { key: "home", href: "/", label: "认识你自己" },
  { key: "lab", href: "/lab", label: "人生实验室" },
  { key: "community", href: "/community", label: "万花筒社区" },
  { key: "me", href: "/me", label: "我的主页" },
];

export const PRIMARY_ROUTES = new Set(TABS.map((tab) => tab.href));

/** 每个一级分区下挂哪些路由（顺序无关，只用于高亮与面包屑归属） */
export const SECTION_ROUTES: Record<string, string[]> = {
  home: ["/", "/chat", "/diary", "/assessment", "/card-game", "/studio"],
  lab: ["/lab"],
  community: ["/community", "/bounty", "/traveler"],
  me: ["/me"],
};

/* 专注模式路由 —— 有明确开始与结束的任务流：测评、卡牌游戏局中。
   进入后收起全站导航，右上角只留退出。理由与 Typeform / Stripe Checkout 一致：
   它是一个「模式」而不是一个「页面」，顶着一条导航既削弱专注，
   也正是「第二 navbar」观感的来源。
   注意只匹配带参数的子路由：/assessment/bigfive 是任务，/card-game 是浏览型目录。 */
const FOCUS_PATTERNS = [/^\/assessment\/[^/]+/, /^\/card-game\/[^/]+/];

export function isFocusRoute(pathname: string): boolean {
  return FOCUS_PATTERNS.some((re) => re.test(pathname));
}

export function matchesRoute(pathname: string, route: string): boolean {
  return route === "/"
    ? pathname === "/"
    : pathname === route || pathname.startsWith(`${route}/`);
}

export function isActiveSection(pathname: string, key: string): boolean {
  return SECTION_ROUTES[key]?.some((route) => matchesRoute(pathname, route)) ?? false;
}

/** 当前路由所属的一级分区；面包屑用它当上级入口 */
export function sectionOf(pathname: string): TabDef | null {
  const tab = TABS.find((t) => isActiveSection(pathname, t.key));
  /* 一级页面本身没有上级，返回 null 让调用方省掉面包屑 */
  if (!tab || tab.href === pathname) return null;
  return tab;
}
