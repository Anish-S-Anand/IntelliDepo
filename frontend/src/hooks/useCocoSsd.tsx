"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import type * as CocoSsdModule from "@tensorflow-models/coco-ssd";

type CocoModel = CocoSsdModule.ObjectDetection;

interface ModelContextValue {
  model: CocoModel | null;
  loading: boolean;
  error: string | null;
}

const ModelContext = createContext<ModelContextValue>({
  model: null,
  loading: false, // default false — don't block UI while loading
  error: null,
});

export function ModelProvider({ children }: { children: ReactNode }) {
  const [model, setModel] = useState<CocoModel | null>(null);
  const [loading, setLoading] = useState(false); // silent load — no spinner blocking UI
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      try {
        // Race TF load against a 20s timeout — TF is large and slow in dev
        const loadWithTimeout = Promise.race([
          (async () => {
            await import("@tensorflow/tfjs");
            const cocoSsd = await import("@tensorflow-models/coco-ssd");
            return cocoSsd.load({ base: "mobilenet_v2" });
          })(),
          new Promise<never>((_, reject) =>
            setTimeout(() => reject(new Error("TF load timeout — using backend detection only")), 20000)
          ),
        ]);

        const loaded = await loadWithTimeout;
        if (!cancelled) {
          setModel(loaded as CocoModel);
          setLoading(false);
        }
      } catch (err) {
        if (!cancelled) {
          // Don't surface timeout as a visible error — backend YOLO handles detection
          const msg = err instanceof Error ? err.message : "Failed to load COCO-SSD";
          const isTimeout = msg.includes("timeout") || msg.includes("Loading chunk");
          setError(isTimeout ? null : msg); // suppress timeout errors from UI
          setLoading(false);
        }
      }
    }

    // Delay TF load by 3s so it doesn't compete with camera feed startup
    const timer = setTimeout(() => void load(), 3000);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, []);

  return <ModelContext.Provider value={{ model, loading, error }}>{children}</ModelContext.Provider>;
}

export function useCocoSsd() {
  return useContext(ModelContext);
}
