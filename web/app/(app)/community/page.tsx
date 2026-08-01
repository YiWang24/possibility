import { PageShell } from "@/components/shell/PageShell";
import { CommunityView } from "@/features/community/CommunityView";

export const metadata = {
  title: "万花筒社区",
};

export default function CommunityPage() {
  return (
    <PageShell>
      <CommunityView />
    </PageShell>
  );
}
