import { notFound } from "next/navigation";
import { ProfileView } from "@/features/profile/ProfileView";

export default async function TravelerPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const travelerId = Number.parseInt(id, 10);
  if (!Number.isInteger(travelerId) || travelerId < 1) notFound();
  return <ProfileView travelerId={travelerId} />;
}
