"use client";

import { conceptCardFor } from "@/content/concepts";
import { copy } from "@/lib/copy/en";
import { usePlayerStore } from "@/lib/store/player-store";

export function ConceptCard() {
  const level = usePlayerStore((s) => s.level);
  const dismissed = usePlayerStore((s) => s.conceptDismissed);
  const dismissConcept = usePlayerStore((s) => s.dismissConcept);
  if (!level || dismissed) return null;
  const card = conceptCardFor(level.conceptId);
  if (!card) return null;

  return (
    <aside className="rounded-md border border-amber-800/30 bg-amber-50 px-3 py-3 text-sm text-amber-950">
      <h2 className="font-semibold">{card.title}</h2>
      <p className="mt-1 leading-6">{card.body}</p>
      <button
        type="button"
        className="mt-2 rounded-md bg-amber-900 px-2 py-1 text-xs text-white"
        aria-label={copy.conceptDismiss}
        onClick={() => dismissConcept()}
      >
        {copy.conceptDismiss}
      </button>
    </aside>
  );
}
