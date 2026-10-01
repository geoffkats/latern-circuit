import { notFound } from "next/navigation";
import { PlayerShell } from "@/components/player/player-shell";
import { listLevelIds, phase1Levels } from "@/lib/levels/load-level";

type PlayPageProps = {
  params: Promise<{ levelId: string }>;
};

export function generateStaticParams() {
  return listLevelIds().map((levelId) => ({ levelId }));
}

export default async function PlayPage({ params }: PlayPageProps) {
  const { levelId } = await params;
  const level = phase1Levels.find((entry) => entry.id === levelId);
  if (!level) notFound();
  return <PlayerShell level={level} />;
}
