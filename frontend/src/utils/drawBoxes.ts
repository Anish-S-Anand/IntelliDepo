export function drawBoxes(
  canvas: HTMLCanvasElement,
  predictions: Array<{ bbox: [number, number, number, number]; class: string; score: number }>,
  plates: Record<string, string> = {},
) {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  predictions.forEach((pred) => {
    const [x, y, w, h] = pred.bbox;
    const conf = (pred.score * 100).toFixed(0);

    // Main bounding box
    ctx.strokeStyle = "#3fb950";
    ctx.lineWidth = 1.5;
    ctx.setLineDash([5, 3]);
    ctx.strokeRect(x, y, w, h);
    ctx.setLineDash([]);

    // Semi-transparent fill
    ctx.fillStyle = "rgba(63, 185, 80, 0.06)";
    ctx.fillRect(x, y, w, h);

    // Corner brackets
    const blen = 10;
    ctx.strokeStyle = "#3fb950";
    ctx.lineWidth = 2;
    ctx.setLineDash([]);
    // TL
    ctx.beginPath();
    ctx.moveTo(x, y + blen);
    ctx.lineTo(x, y);
    ctx.lineTo(x + blen, y);
    ctx.stroke();
    // TR
    ctx.beginPath();
    ctx.moveTo(x + w - blen, y);
    ctx.lineTo(x + w, y);
    ctx.lineTo(x + w, y + blen);
    ctx.stroke();
    // BL
    ctx.beginPath();
    ctx.moveTo(x, y + h - blen);
    ctx.lineTo(x, y + h);
    ctx.lineTo(x + blen, y + h);
    ctx.stroke();
    // BR
    ctx.beginPath();
    ctx.moveTo(x + w - blen, y + h);
    ctx.lineTo(x + w, y + h);
    ctx.lineTo(x + w, y + h - blen);
    ctx.stroke();

    // Label pill above box
    const label = `${pred.class.toUpperCase()}  ${conf}%`;
    ctx.font = "bold 10px monospace";
    const tw = ctx.measureText(label).width;
    ctx.fillStyle = "#3fb950";
    ctx.fillRect(x - 1, y - 18, tw + 10, 15);
    ctx.fillStyle = "#0d1117";
    ctx.fillText(label, x + 4, y - 7);

    // LPR plate overlay
    const plateKey = `${Math.round(x)}_${Math.round(y)}`;
    if (plates[plateKey]) {
      const plate = plates[plateKey];
      ctx.fillStyle = "rgba(0,0,0,0.85)";
      ctx.fillRect(x, y + h + 4, 90, 17);
      ctx.strokeStyle = "#58a6ff";
      ctx.lineWidth = 1;
      ctx.strokeRect(x, y + h + 4, 90, 17);
      ctx.fillStyle = "#58a6ff";
      ctx.font = "bold 9px monospace";
      ctx.fillText(plate, x + 4, y + h + 15);
    }
  });
}
