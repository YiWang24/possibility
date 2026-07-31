import { notFound } from "next/navigation";
import { GameView } from "@/features/card-game/GameView";
import { isCardGameKind } from "@/features/card-game/data";

export default async function CardGamePage({
  params,
}: {
  params: Promise<{ kind: string }>;
}) {
  const { kind } = await params;
  if (!isCardGameKind(kind)) notFound();
  return <GameView kind={kind} />;
}
