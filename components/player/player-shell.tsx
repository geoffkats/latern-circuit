"use client";

import Link from "next/link";
import { useEffect } from "react";
import { PythonEditor } from "@/components/editor/python-editor";
import { ConceptCard } from "@/components/player/concept-card";
import { HintDrawer } from "@/components/player/hint-drawer";
import { ResultBanner } from "@/components/player/result-banner";
import { Stage } from "@/components/player/stage";
import { StoryBar } from "@/components/player/story-bar";
import { Transport } from "@/components/player/transport";
import { copy } from "@/lib/copy/en";
import type { Phase1Level } from "@/lib/levels/schema";
import { usePlayerStore } from "@/lib/store/player-store";

const FONT_SCALE = [0.9, 1, 1.15] as const;

type PlayerShellProps = {
  level: Phase1Level;
};

export function PlayerShell({ level }: PlayerShellProps) {
  const initLevel = usePlayerStore((s) => s.initLevel);
  const code = usePlayerStore((s) => s.code);
  const setCode = usePlayerStore((s) => s.setCode);
  const currentError = usePlayerStore((s) => s.currentError);
  const runStatus = usePlayerStore((s) => s.runStatus);
  const fontStep = usePlayerStore((s) => s.fontStep);
  const setFontStep = usePlayerStore((s) => s.setFontStep);

  useEffect(() => {
    initLevel(level);
  }, [level, initLevel]);

  const scale = FONT_SCALE[fontStep];
  const busy = runStatus === "loading-python" || runStatus === "running";

  return (
    <div
      className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-4 px-4 py-4"
      style={{ ["--lc-font-scale" as string]: String(scale) }}
    >
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs font-medium tracking-wide text-amber-800">
            {copy.productName}
          </p>
          <h1
            className="font-semibold tracking-tight"
            style={{ fontSize: "calc(1.4rem * var(--lc-font-scale))" }}
          >
            {level.title}
          </h1>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            className="rounded border border-zinc-300 px-2 py-1 text-xs"
            aria-label={copy.fontSmall}
            onClick={() => setFontStep(0)}
          >
            A−
          </button>
          <button
            type="button"
            className="rounded border border-zinc-300 px-2 py-1 text-xs"
            aria-label={copy.fontMedium}
            onClick={() => setFontStep(1)}
          >
            A
          </button>
          <button
            type="button"
            className="rounded border border-zinc-300 px-2 py-1 text-xs"
            aria-label={copy.fontLarge}
            onClick={() => setFontStep(2)}
          >
            A+
          </button>
          <Link
            href="/"
            className="rounded border border-zinc-300 px-2 py-1 text-xs"
          >
            {copy.backToLevels}
          </Link>
        </div>
      </header>

      <ConceptCard />

      <div className="grid gap-4 md:grid-cols-2">
        <div className="flex flex-col gap-3">
          <StoryBar />
          <Stage />
          <Transport />
          <ResultBanner />
          <HintDrawer />
        </div>
        <div className="flex min-h-[280px] flex-col gap-2 md:min-h-[420px]">
          <h2
            className="font-medium text-zinc-800"
            style={{ fontSize: "calc(0.95rem * var(--lc-font-scale))" }}
          >
            Python
          </h2>
          <div className="min-h-[240px] flex-1">
            <PythonEditor
              level={level}
              code={code}
              onChange={setCode}
              error={currentError}
              readOnly={busy}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
