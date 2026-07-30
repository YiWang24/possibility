import { notFound } from "next/navigation";
import { BountyDetail } from "@/features/community/BountyDetail";

export default async function BountyPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const bountyId = Number.parseInt(id, 10);
  if (!Number.isInteger(bountyId) || bountyId < 1) notFound();
  return <BountyDetail bountyId={bountyId} />;
}
