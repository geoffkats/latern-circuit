import type { SkinId, WorldState } from "@/lib/sim/types";
import { drawNia } from "./actors/nia";
import { drawPebble } from "./actors/pebble";
import { drawCinderDunes } from "./skins/cinder-dunes";
import { drawKeelStation } from "./skins/keel-station";
import { drawMossCanopy } from "./skins/moss-canopy";

export type DrawGridOptions = {
  ctx: CanvasRenderingContext2D;
  state: WorldState;
  widthPx: number;
  heightPx: number;
  /** Tween 0–1 from previous actor cell toward current (move only). */
  tween?: number;
  prev?: WorldState | null;
};

function drawFloor(
  ctx: CanvasRenderingContext2D,
  skin: SkinId,
  x: number,
  y: number,
  size: number,
  cellX: number,
  cellY: number,
): void {
  switch (skin) {
    case "moss-canopy":
      drawMossCanopy(ctx, x, y, size, cellX, cellY);
      break;
    case "keel-station":
      drawKeelStation(ctx, x, y, size, cellX, cellY);
      break;
    case "cinder-dunes":
      drawCinderDunes(ctx, x, y, size, cellX, cellY);
      break;
    default:
      drawMossCanopy(ctx, x, y, size, cellX, cellY);
  }
}

function drawBlocked(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  size: number,
): void {
  ctx.fillStyle = "#2a2a2a";
  ctx.fillRect(x, y, size, size);
  ctx.strokeStyle = "#f5f5f5";
  ctx.lineWidth = Math.max(2, size * 0.06);
  ctx.beginPath();
  ctx.moveTo(x + size * 0.2, y + size * 0.2);
  ctx.lineTo(x + size * 0.8, y + size * 0.8);
  ctx.moveTo(x + size * 0.8, y + size * 0.2);
  ctx.lineTo(x + size * 0.2, y + size * 0.8);
  ctx.stroke();
}

function drawGoal(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  size: number,
): void {
  const cx = x + size / 2;
  const cy = y + size / 2;
  const r = size * 0.28;
  ctx.fillStyle = "#111111";
  ctx.beginPath();
  for (let i = 0; i < 4; i += 1) {
    const angle = (Math.PI / 2) * i - Math.PI / 2;
    const px = cx + Math.cos(angle) * r;
    const py = cy + Math.sin(angle) * r;
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = "#ffffff";
  ctx.lineWidth = 2;
  ctx.stroke();
}

function drawHazard(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  size: number,
): void {
  ctx.fillStyle = "#111111";
  ctx.beginPath();
  ctx.moveTo(x + size * 0.5, y + size * 0.18);
  ctx.lineTo(x + size * 0.82, y + size * 0.78);
  ctx.lineTo(x + size * 0.18, y + size * 0.78);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(x + size * 0.46, y + size * 0.38, size * 0.08, size * 0.22);
  ctx.beginPath();
  ctx.arc(x + size * 0.5, y + size * 0.68, size * 0.045, 0, Math.PI * 2);
  ctx.fill();
}

function drawItem(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  size: number,
  kind: string,
  stackIndex: number,
): void {
  const inset = size * 0.22 - stackIndex * size * 0.04;
  const left = x + inset;
  const top = y + inset;
  const box = size - inset * 2;
  if (kind.includes("crate")) {
    ctx.fillStyle = "#111111";
    ctx.fillRect(left, top, box, box);
    ctx.strokeStyle = "#ffffff";
    ctx.lineWidth = 2;
    ctx.strokeRect(left, top, box, box);
    ctx.beginPath();
    ctx.moveTo(left, top);
    ctx.lineTo(left + box, top + box);
    ctx.stroke();
  } else {
    ctx.fillStyle = "#111111";
    ctx.beginPath();
    ctx.arc(x + size / 2, y + size / 2, box / 2, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "#ffffff";
    ctx.setLineDash([4, 3]);
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.setLineDash([]);
  }
}

/**
 * Draws one WorldState. Origin is bottom-left in world space; canvas y grows down,
 * so row 0 is drawn at the bottom.
 */
export function drawGrid(options: DrawGridOptions): void {
  const { ctx, state, widthPx, heightPx } = options;
  const tween = options.tween ?? 1;
  const prev = options.prev ?? null;
  ctx.clearRect(0, 0, widthPx, heightPx);

  const pad = 8;
  const cell = Math.min(
    (widthPx - pad * 2) / state.width,
    (heightPx - pad * 2) / state.height,
  );
  const gridW = cell * state.width;
  const gridH = cell * state.height;
  const originX = (widthPx - gridW) / 2;
  const originY = (heightPx - gridH) / 2;

  for (const tile of state.cells) {
    const x = originX + tile.x * cell;
    const y = originY + (state.height - 1 - tile.y) * cell;
    drawFloor(ctx, state.skin, x, y, cell, tile.x, tile.y);
    if (tile.blocked) drawBlocked(ctx, x, y, cell);
    if (tile.goal) drawGoal(ctx, x, y, cell);
    if (tile.hazard) drawHazard(ctx, x, y, cell);
    tile.items.forEach((kind, index) => {
      drawItem(ctx, x, y, cell, kind, index);
    });
  }

  let actorX = state.actor.x;
  let actorY = state.actor.y;
  if (prev && tween < 1) {
    actorX = prev.actor.x + (state.actor.x - prev.actor.x) * tween;
    actorY = prev.actor.y + (state.actor.y - prev.actor.y) * tween;
  }
  const drawX = originX + actorX * cell;
  const drawY = originY + (state.height - 1 - actorY) * cell;

  if (state.mode === "robot") {
    drawPebble(ctx, drawX, drawY, cell, state.actor.facing);
  } else {
    drawNia(ctx, drawX, drawY, cell, state.actor.facing);
  }
}
