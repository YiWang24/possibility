/* 应用段布局 —— 四个主 Tab 与所有二级页面共用一层外壳。
   route group 不产生 URL 段，/chat、/diary、/traveler/[id] 等路径保持不变，
   但从此都活在同一个持久顶部 navbar 之下，桌面上不会再出现「点进去就没有导航」。

   外壳由 AuthWall 内部渲染，而不是在这里包一层：未登录时要的是一张干净的全屏
   登录页，不该套着一圈点进去全是 401 的主导航。 */
import { AuthWall } from "@/components/auth/AuthWall";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return <AuthWall>{children}</AuthWall>;
}
