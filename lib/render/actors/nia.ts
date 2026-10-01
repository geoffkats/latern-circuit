import type { Direction } from "@/lib/sim/types";

/** Nia: triangular walker with a facing point. */
export function drawNia(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  size: number,
  facing: Direction,
): void {
  const cx = x + size / 2;
  const cy = y + size / 2;
  const r = size * 0.32;
  const angles: Record<Direction, number> = {
    north: -Math.PI / 2,
    east: 0,
    south: Math.PI / 2,
    west: Math.PI,
  };
  const tip = angles[facing];
  ctx.fillStyle = "#1b1b1b";
  ctx.beginPath();
  ctx.moveTo(cx + Math.cos(tip) * r, cy + Math.sin(tip) * r);
  ctx.lineTo(
    cx + Math.cos(tip + (2.4 * Math.PI) / 3) * r * 0.85,
    cy + Math.sin(tip + (2.4 * Math.PI) / 3) * r * 0.85,
  );
  ctx.lineTo(
    cx + Math.cos(tip - (2.4 * Math.PI) / 3) * r * 0.85,
    cy + Math.sin(tip - (2.4 * Math.PI) / 3) * r * 0.85,
  );
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = "#ffffff";
  ctx.lineWidth = 2;
  ctx.stroke();
}
