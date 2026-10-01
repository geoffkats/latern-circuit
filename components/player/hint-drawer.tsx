"use client";

import { copy } from "@/lib/copy/en";
import { usePlayerStore } from "@/lib/store/player-store";

export function HintDrawer() {
  const level = usePlayerStore((s) => s.level);
  const hintsRevealed = usePlayerStore((s) => s.hintsRevealed);
  const revealHint = usePlayerStore((s) => s.revealHint);
  if (!level) return null;

  const revealed = level.hints.slice(0, hintsRevealed);
  const canReveal = hintsRevealed < level.hints.length;

  return (
    <section className="space-y-2" aria-label={copy.hintsTitle}>
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-sm font-semibold">{copy.hintsTitle}</h2>
        <button
          type="button"
          className="rounded-md border border-zinc-300 px-2 py-1 text-xs disabled:opacity-50"
          aria-label={copy.revealHint}
          disabled={!canReveal}
          onClick={() => revealHint()}
        >
          {canReveal ? copy.revealHint : copy.noMoreHints}
        </button>
      </div>
      <ol className="list-decimal space-y-1 pl-5 text-sm text-zinc-700">
        {revealed.map((hint) => (
          <li key={hint}>{hint}</li>
        ))}
      </ol>
    </section>
  );
}
