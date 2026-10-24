// Canvas drawing helpers shared by local input handling and remote
// stroke rendering. Points are stored as {x, y} fractions (0..1) of the
// canvas's current size, so drawings stay consistent across any canvas
// dimensions / device pixel ratios.

export function getRelativePoint(canvas, clientX, clientY) {
  const rect = canvas.getBoundingClientRect();
  return {
    x: (clientX - rect.left) / rect.width,
    y: (clientY - rect.top) / rect.height,
  };
}

export function drawSegment(ctx, canvas, from, to, { color = "#000", size = 4 } = {}) {
  ctx.strokeStyle = color;
  ctx.lineWidth = size;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";

  ctx.beginPath();
  ctx.moveTo(from.x * canvas.width, from.y * canvas.height);
  ctx.lineTo(to.x * canvas.width, to.y * canvas.height);
  ctx.stroke();
}

export function clearCanvas(ctx, canvas) {
  ctx.fillStyle = "#fff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
}
