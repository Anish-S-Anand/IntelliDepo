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
  loading: true,
  error: null,
});

export function ModelProvider({ children }: { children: ReactNode }) {
  const [model, setModel] = useState<CocoModel | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        // Dynamic imports so TF doesn't block initial page load
        await import("@tensorflow/tfjs");
        const cocoSsd = await import("@tensorflow-models/coco-ssd");
        const loaded = await cocoSsd.load({ base: "mobilenet_v2" });
        if (!cancelled) {
          setModel(loaded);
          setLoading(false);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Failed to load COCO-SSD");
          setLoading(false);
        }
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, []);

  return <ModelContext.Provider value={{ model, loading, error }}>{children}</ModelContext.Provider>;
}

export function useCocoSsd() {
  return useContext(ModelContext);
}
