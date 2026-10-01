"use client";

import { copy } from "@/lib/copy/en";
import { usePlayerStore } from "@/lib/store/player-store";

export function StoryBar() {
  const level = usePlayerStore((s) => s.level);
  if (!level) return null;
  return (
    <section className="space-y-1" aria-label={copy.storyIntro}>
      <h2 className="text-sm font-semibold tracking-wide text-amber-800">
        {level.title}
      </h2>
      <p className="text-sm leading-6 text-zinc-700">{level.story.intro}</p>
    </section>
  );
}
