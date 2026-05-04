"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { useCocoSsd } from "./useCocoSsd";
import { drawBoxes } from "@/utils/drawBoxes";
import { runLPR } from "@/utils/lpr";

const VEHICLE_CLASSES = ["car", "truck", "bus", "motorcycle", "bicycle"];
const MIN_CONFIDENCE = 0.45;

interface DetectionResult {
  bbox: [number, number, number, number];
  class: string;
  score: number;
}

export function useDetection(
  sourceRef: React.RefObject<HTMLVideoElement | HTMLCanvasElement | null>,
  canvasRef: React.RefObject<HTMLCanvasElement | null>,
  cameraIndex: number,
  enabled: boolean,
  onDetectionUpdate?: (vehicles: DetectionResult[]) => void,
) {
  const { model } = useCocoSsd();
  const [plates, setPlates] = useState<Record<string, string>>({});
  const plateCacheRef = useRef(new Set<string>());
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const detect = useCallback(async () => {
    if (!model || !sourceRef.current || !canvasRef.current) return;

    const source = sourceRef.current;
    // Skip if video hasn't loaded enough data
    if (source instanceof HTMLVideoElement && source.readyState < 2) return;

    try {
      const predictions = await model.detect(source);
      const vehicles = predictions.filter(
        (p) => VEHICLE_CLASSES.includes(p.class) && p.score > MIN_CONFIDENCE,
      ) as DetectionResult[];

      drawBoxes(canvasRef.current, vehicles, plates);

      if (vehicles.length > 0) {
        runLPR(canvasRef.current, vehicles, plateCacheRef.current, setPlates);
      }

      onDetectionUpdate?.(vehicles);
    } catch {
      // Detection frame error — skip
    }
  }, [model, sourceRef, canvasRef, plates, onDetectionUpdate]);

  useEffect(() => {
    if (!enabled || !model) {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      return;
    }

    const offset = cameraIndex * 33;
    intervalRef.current = setInterval(detect, 200 + offset);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [enabled, model, detect, cameraIndex]);

  return { plates };
}
