import type { Direction } from "@/lib/sim/types";

/** Pebble: round robot body with a facing notch. */
export function drawPebble(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  size: number,
  facing: Direction,
): void {
  const cx = x + size / 2;
  const cy = y + size / 2;
  const r = size * 0.3;
  ctx.fillStyle = "#1b1b1b";
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = "#ffffff";
  ctx.lineWidth = 2;
  ctx.stroke();

  const angles: Record<Direction, number> = {
    north: -Math.PI / 2,
    east: 0,
    south: Math.PI / 2,
    west: Math.PI,
  };
  const a = angles[facing];
  ctx.fillStyle = "#ffffff";
  ctx.beginPath();
  ctx.arc(
    cx + Math.cos(a) * r * 0.45,
    cy + Math.sin(a) * r * 0.45,
    r * 0.22,
    0,
    Math.PI * 2,
  );
  ctx.fill();
}
