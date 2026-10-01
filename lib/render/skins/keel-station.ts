/** Keel station floor: cool metal plates with rivet dots. */
export function drawKeelStation(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  size: number,
  cellX: number,
  cellY: number,
): void {
  const shade = (cellX + cellY) % 2 === 0 ? "#4a5b6c" : "#3e4d5c";
  ctx.fillStyle = shade;
  ctx.fillRect(x, y, size, size);
  ctx.strokeStyle = "rgba(255,255,255,0.25)";
  ctx.lineWidth = 1;
  ctx.strokeRect(x + 2, y + 2, size - 4, size - 4);
  ctx.fillStyle = "rgba(255,255,255,0.35)";
  const r = Math.max(1.5, size * 0.04);
  for (const [px, py] of [
    [0.2, 0.2],
    [0.8, 0.2],
    [0.2, 0.8],
    [0.8, 0.8],
  ] as const) {
    ctx.beginPath();
    ctx.arc(x + size * px, y + size * py, r, 0, Math.PI * 2);
    ctx.fill();
  }
}
