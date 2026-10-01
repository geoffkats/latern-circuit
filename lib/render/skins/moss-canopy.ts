/** Moss canopy floor: soft green with leaf-hatch pattern. */
export function drawMossCanopy(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  size: number,
  cellX: number,
  cellY: number,
): void {
  const shade = (cellX + cellY) % 2 === 0 ? "#3f6b4a" : "#355c40";
  ctx.fillStyle = shade;
  ctx.fillRect(x, y, size, size);
  ctx.strokeStyle = "rgba(255,255,255,0.18)";
  ctx.lineWidth = 1;
  for (let i = 1; i <= 3; i += 1) {
    const yy = y + (size * i) / 4;
    ctx.beginPath();
    ctx.moveTo(x + size * 0.15, yy);
    ctx.quadraticCurveTo(x + size * 0.5, yy - size * 0.08, x + size * 0.85, yy);
    ctx.stroke();
  }
}
