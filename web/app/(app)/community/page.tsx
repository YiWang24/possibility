import { PageContainer } from "@/components/shell/PageContainer";
import { CommunityView } from "@/features/community/CommunityView";

export const metadata = {
  title: "万花筒社区",
};

export default function CommunityPage() {
  return (
    <PageContainer size="board">
      <CommunityView />
    </PageContainer>
  );
}
