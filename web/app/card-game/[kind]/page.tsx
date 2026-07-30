import { notFound } from "next/navigation";
import { GameView } from "@/features/card-game/GameView";
import { CARD_GAME_KINDS, isCardGameKind } from "@/features/card-game/data";

export function generateStaticParams() {
  return CARD_GAME_KINDS.map((kind) => ({ kind }));
}

export default async function CardGamePage({
  params,
}: {
  params: Promise<{ kind: string }>;
}) {
  const { kind } = await params;
  if (!isCardGameKind(kind)) notFound();
  return <GameView kind={kind} />;
}
