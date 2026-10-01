"use client";

import { useEffect } from "react";
import { copy } from "@/lib/copy/en";
import {
  playbackDelayMs,
  usePlayerStore,
  type PlayerRunStatus,
} from "@/lib/store/player-store";
import type { SpeedId } from "@/lib/render/playback";

function busy(status: PlayerRunStatus): boolean {
  return status === "loading-python" || status === "running";
}

export function Transport() {
  const runStatus = usePlayerStore((s) => s.runStatus);
  const playing = usePlayerStore((s) => s.playing);
  const speed = usePlayerStore((s) => s.speed);
  const cursor = usePlayerStore((s) => s.cursor);
  const frames = usePlayerStore((s) => s.frames);
  const run = usePlayerStore((s) => s.run);
  const cancel = usePlayerStore((s) => s.cancel);
  const play = usePlayerStore((s) => s.play);
  const pause = usePlayerStore((s) => s.pause);
  const stepForward = usePlayerStore((s) => s.stepForward);
  const stepBack = usePlayerStore((s) => s.stepBack);
  const setSpeed = usePlayerStore((s) => s.setSpeed);
  const tickPlayback = usePlayerStore((s) => s.tickPlayback);

  useEffect(() => {
    if (!playing) return;
    const id = window.setTimeout(() => {
      tickPlayback();
    }, playbackDelayMs(speed));
    return () => window.clearTimeout(id);
  }, [playing, speed, cursor, tickPlayback]);

  const disabled = busy(runStatus);
  const speeds: { id: SpeedId; label: string }[] = [
    { id: "slow", label: copy.speedSlow },
    { id: "normal", label: copy.speedNormal },
    { id: "fast", label: copy.speedFast },
  ];

  return (
    <div className="flex flex-wrap items-center gap-2">
      <button
        type="button"
        className="rounded-md bg-zinc-900 px-3 py-2 text-sm font-medium text-white disabled:opacity-50"
        aria-label={copy.run}
        disabled={disabled}
        onClick={() => void run()}
      >
        {runStatus === "loading-python"
          ? copy.loadingPython
          : runStatus === "running"
            ? copy.running
            : copy.run}
      </button>
      {disabled ? (
        <button
          type="button"
          className="rounded-md border border-zinc-300 px-3 py-2 text-sm"
          aria-label={copy.cancel}
          onClick={() => cancel()}
        >
          {copy.cancel}
        </button>
      ) : null}
      <button
        type="button"
        className="rounded-md border border-zinc-300 px-3 py-2 text-sm disabled:opacity-50"
        aria-label={playing ? copy.pauseTransport : copy.playTransport}
        disabled={disabled || frames.length <= 1}
        onClick={() => (playing ? pause() : play())}
      >
        {playing ? copy.pauseTransport : copy.playTransport}
      </button>
      <button
        type="button"
        className="rounded-md border border-zinc-300 px-3 py-2 text-sm disabled:opacity-50"
        aria-label={copy.stepBack}
        disabled={disabled || cursor <= 0}
        onClick={() => stepBack()}
      >
        {copy.stepBack}
      </button>
      <button
        type="button"
        className="rounded-md border border-zinc-300 px-3 py-2 text-sm disabled:opacity-50"
        aria-label={copy.stepForward}
        disabled={disabled || cursor >= frames.length - 1}
        onClick={() => stepForward()}
      >
        {copy.stepForward}
      </button>
      <div className="ml-auto flex gap-1" role="group" aria-label="Playback speed">
        {speeds.map((entry) => (
          <button
            key={entry.id}
            type="button"
            className={`rounded-md px-2 py-2 text-xs ${
              speed === entry.id
                ? "bg-amber-700 text-white"
                : "border border-zinc-300"
            }`}
            aria-label={entry.label}
            aria-pressed={speed === entry.id}
            disabled={disabled}
            onClick={() => setSpeed(entry.id)}
          >
            {entry.id}
          </button>
        ))}
      </div>
    </div>
  );
}
