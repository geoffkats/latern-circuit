"use client";

import { copy } from "@/lib/copy/en";
import { usePlayerStore } from "@/lib/store/player-store";

export function ResultBanner() {
  const stars = usePlayerStore((s) => s.stars);
  const bonusTechnique = usePlayerStore((s) => s.bonusTechnique);
  const runStatus = usePlayerStore((s) => s.runStatus);
  const level = usePlayerStore((s) => s.level);
  const currentError = usePlayerStore((s) => s.currentError);

  if (runStatus !== "completed" && stars === 0 && !currentError) return null;
  if (!level) return null;

  const won = stars > 0;

  return (
    <section
      className={`rounded-md border px-3 py-2 text-sm ${
        won
          ? "border-amber-700/40 bg-amber-50 text-amber-950"
          : "border-zinc-300 bg-zinc-50 text-zinc-800"
      }`}
      aria-label={copy.starsLabel}
    >
      <p className="font-medium">{won ? copy.resultWon : copy.resultLost}</p>
      <p>
        {copy.starsLabel}: {"★".repeat(stars)}
        {"☆".repeat(Math.max(0, 3 - stars))}
      </p>
      {bonusTechnique ? <p>{copy.bonusTechnique}</p> : null}
      {!won && currentError ? <p>{currentError.sentence}</p> : null}
      {!won && !currentError ? <p>{level.story.blocked}</p> : null}
    </section>
  );
}
