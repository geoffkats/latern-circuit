/** Cinder dunes floor: warm sand with dotted ripples. */
export function drawCinderDunes(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  size: number,
  cellX: number,
  cellY: number,
): void {
  const shade = (cellX + cellY) % 2 === 0 ? "#c4a574" : "#b89560";
  ctx.fillStyle = shade;
  ctx.fillRect(x, y, size, size);
  ctx.fillStyle = "rgba(60,40,20,0.35)";
  for (let row = 0; row < 4; row += 1) {
    for (let col = 0; col < 5; col += 1) {
      const ox = x + size * ((col + 0.5) / 5);
      const oy = y + size * ((row + 0.35) / 4);
      ctx.beginPath();
      ctx.arc(ox, oy, Math.max(1, size * 0.02), 0, Math.PI * 2);
      ctx.fill();
    }
  }
}
