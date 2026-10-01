"use client";

import { useEffect, useRef } from "react";
import { drawGrid } from "@/lib/render/draw-grid";
import { usePlayerStore } from "@/lib/store/player-store";

export function Stage() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const frames = usePlayerStore((s) => s.frames);
  const cursor = usePlayerStore((s) => s.cursor);
  const announcement = usePlayerStore((s) => s.announcement);
  const currentError = usePlayerStore((s) => s.currentError);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const state = frames[cursor] ?? frames[0];
    if (!state) {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      return;
    }
    const prev = cursor > 0 ? frames[cursor - 1] : null;
    drawGrid({
      ctx,
      state,
      prev,
      tween: 1,
      widthPx: canvas.width,
      heightPx: canvas.height,
    });
  }, [frames, cursor]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const resize = () => {
      const parent = canvas.parentElement;
      if (!parent) return;
      const rect = parent.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;
      const w = Math.max(280, Math.floor(rect.width));
      const h = Math.max(220, Math.floor(rect.width * 0.72));
      canvas.width = Math.floor(w * dpr);
      canvas.height = Math.floor(h * dpr);
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const state = usePlayerStore.getState().frames[
        usePlayerStore.getState().cursor
      ];
      if (state) {
        drawGrid({
          ctx,
          state,
          widthPx: w,
          heightPx: h,
          tween: 1,
        });
      }
    };
    resize();
    window.addEventListener("resize", resize);
    return () => window.removeEventListener("resize", resize);
  }, []);

  const live = currentError?.sentence
    ? `${announcement} ${currentError.sentence}`
    : announcement;

  return (
    <div className="flex w-full flex-col gap-2">
      <div className="overflow-hidden rounded-md border border-zinc-300 bg-zinc-100">
        <canvas ref={canvasRef} aria-hidden="true" className="block w-full" />
      </div>
      <p className="sr-only" aria-live="polite">
        {live}
      </p>
      {currentError ? (
        <p className="text-sm text-red-800" role="status">
          {currentError.sentence}
          {currentError.line !== null ? ` (line ${currentError.line})` : ""}
        </p>
      ) : null}
    </div>
  );
}
