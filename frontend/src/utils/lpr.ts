import Tesseract from "tesseract.js";

const VEHICLE_CLASSES = ["car", "truck", "bus"];

export async function runLPR(
  canvas: HTMLCanvasElement,
  vehicles: Array<{ bbox: [number, number, number, number]; class: string; score: number }>,
  plateCache: Set<string>,
  setPlates: React.Dispatch<React.SetStateAction<Record<string, string>>>,
) {
  for (const v of vehicles) {
    if (!VEHICLE_CLASSES.includes(v.class)) continue;
    const [x, y, w, h] = v.bbox;
    const key = `${Math.round(x)}_${Math.round(y)}`;

    if (plateCache.has(key)) continue;

    // Crop bottom 30% of vehicle bbox (where plate usually is)
    const cropY = y + h * 0.65;
    const cropH = h * 0.35;
    const offscreen = document.createElement("canvas");
    offscreen.width = w;
    offscreen.height = cropH;
    const offCtx = offscreen.getContext("2d");
    if (!offCtx) continue;
    offCtx.drawImage(canvas, x, cropY, w, cropH, 0, 0, w, cropH);

    try {
      const {
        data: { text },
      } = await Tesseract.recognize(offscreen, "eng");

      const cleaned = text
        .trim()
        .replace(/[^A-Z0-9 ]/g, "")
        .slice(0, 12);
      if (cleaned.length >= 4) {
        setPlates((prev) => ({ ...prev, [key]: cleaned }));
        plateCache.add(key);
        setTimeout(() => plateCache.delete(key), 4000);
      }
    } catch {
      // OCR failed for this crop — skip silently
    }
  }
}
