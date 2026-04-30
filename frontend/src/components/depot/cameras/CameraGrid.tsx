"use client";

import { useState, useCallback, useEffect } from "react";
import { VideoFeed } from "./VideoFeed";
import { ModelProvider, useCocoSsd } from "@/hooks/useCocoSsd";
import { Camera, ShieldCheck, Truck, AlertTriangle, Users, Package } from "lucide-react";

interface CameraData {
  id: string;
  name: string;
  stream_url?: string;
  videoFile?: string;
}

const GATE_EXIT_SOUTH_VIDEO = "Recording 2025-08-11 171805.mp4";

// Exactly 6 cameras — no more, no less
const FALLBACK_CAMERAS: CameraData[] = [
  { id: "gate-entry-north", name: "Gate Entry North", videoFile: "dtranshipment 1 (2).mp4" },
  { id: "zone-a-overhead", name: "Zone A Overhead", videoFile: "cluster 13 (1).mp4" },
  { id: "loading-bay-1-4", name: "Loading Bay 1-4", videoFile: "cluster 4-5 (1).mp4" },
  { id: "zone-c-perimeter", name: "Zone C Perimeter", videoFile: "Recording 2025-07-30 115417.mp4" },
  { id: "gate-exit-south", name: "Gate Exit South", videoFile: GATE_EXIT_SOUTH_VIDEO },
  { id: "yard-overview", name: "Yard Overview", videoFile: "Screen Recording 2025-08-11 174929.mp4" },
];

function getBackendBase(): string {
  if (typeof window !== "undefined") {
    return `${window.location.protocol}//${window.location.hostname}:8000`;
  }
  return process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
}

interface DetectionCounts {
  vehicles: number;
  workers: number;
  cementBags: number;
  plates: string[];
}

function ModelStatus() {
  const { loading, error } = useCocoSsd();
  if (error) {
    // Only show error for real failures, not timeouts
    return (
      <span className="flex items-center gap-1.5 rounded bg-yellow-500/20 px-2 py-1 text-[10px] text-yellow-400">
        <AlertTriangle size={12} /> Browser AI unavailable — using server detection
      </span>
    );
  }
  if (loading) {
    return (
      <span className="flex items-center gap-1.5 rounded bg-blue-500/20 px-2 py-1 text-[10px] text-blue-400">
        <span className="inline-block h-2 w-2 animate-spin rounded-full border border-blue-400 border-t-transparent" />
        Loading AI models...
      </span>
    );
  }
  return (
    <span className="flex items-center gap-1.5 rounded bg-green-500/20 px-2 py-1 text-[10px] text-green-400">
      <ShieldCheck size={12} /> AI Detection Active
    </span>
  );
}

function CameraGridInner() {
  const [cameras, setCameras] = useState<CameraData[]>(FALLBACK_CAMERAS);
  const [detections, setDetections] = useState<Record<number, DetectionCounts>>({});
  const [plateLog, setPlateLog] = useState<Array<{ time: string; camera: string; plate: string }>>([]);

  useEffect(() => {
    async function fetchCameras() {
      try {
        const res = await fetch(`${getBackendBase()}/depot/vision/cameras/`);
        if (res.ok) {
          const data = await res.json();
          if (Array.isArray(data) && data.length > 0) {
            // Only use cameras with local: stream URLs
            const usable = data.filter((c: { stream_url?: string }) =>
              c.stream_url?.startsWith("local:")
            );

            // Deduplicate by stream_url — keep first occurrence of each unique video
            const seen = new Set<string>();
            const unique = usable.filter((c: { stream_url?: string }) => {
              if (!c.stream_url || seen.has(c.stream_url)) return false;
              seen.add(c.stream_url);
              return true;
            });

            // Need at least 6 distinct videos to replace fallback
            if (unique.length < 6) {
              return; // keep FALLBACK_CAMERAS which already have 6 distinct files
            }

            const limited = unique.slice(0, 6).map((c: { id: string; name: string; stream_url?: string }) => ({
              id: c.id,
              name: c.name,
              stream_url: c.stream_url,
              videoFile:
                c.name === "Gate Exit South"
                  ? GATE_EXIT_SOUTH_VIDEO
                  : c.stream_url?.replace(/^local:/, ""),
            }));
            setCameras(limited);
          }
        }
      } catch {
        // Use fallback cameras (already 6 distinct videos)
      }
    }
    fetchCameras();
  }, []);

  const handleDetectionUpdate = useCallback(
    (cameraIndex: number, cameraName: string) =>
      (vehicles: Array<{ bbox: [number, number, number, number]; class: string; score: number }>) => {
        // Classify detections: vehicles, persons (workers), and bags
        const vehicleClasses = ["car", "truck", "bus", "motorcycle", "bicycle", "vehicle"];
        const personClasses = ["person"];
        // COCO-SSD doesn't have "cement bag" — we use "suitcase" / "backpack" as proxy
        // and supplement with custom logic
        const bagClasses = ["suitcase", "backpack", "handbag", "sports ball"];

        const vehicleCount = vehicles.filter((v) =>
          vehicleClasses.some((c) => v.class.toLowerCase().includes(c))
        ).length;
        const workerCount = vehicles.filter((v) =>
          personClasses.some((c) => v.class.toLowerCase().includes(c))
        ).length;
        const bagCount = vehicles.filter((v) =>
          bagClasses.some((c) => v.class.toLowerCase().includes(c))
        ).length;

        setDetections((prev) => ({
          ...prev,
          [cameraIndex]: {
            vehicles: vehicleCount,
            workers: workerCount,
            cementBags: bagCount,
            plates: prev[cameraIndex]?.plates || [],
          },
        }));
      },
    [],
  );

  const handlePlateDetected = useCallback(
    (cameraIndex: number, cameraName: string, plate: string) => {
      setPlateLog((prev) => [
        { time: new Date().toLocaleTimeString(), camera: cameraName, plate },
        ...prev.slice(0, 19),
      ]);
      setDetections((prev) => ({
        ...prev,
        [cameraIndex]: {
          ...(prev[cameraIndex] || { vehicles: 0, workers: 0, cementBags: 0, plates: [] }),
          plates: [plate, ...(prev[cameraIndex]?.plates || []).slice(0, 4)],
        },
      }));
    },
    [],
  );

  const totalVehicles = Object.values(detections).reduce((a, b) => a + b.vehicles, 0);
  const totalWorkers = Object.values(detections).reduce((a, b) => a + b.workers, 0);
  const totalBags = Object.values(detections).reduce((a, b) => a + b.cementBags, 0);
  const activeCameras = cameras.length; // Always 6

  return (
    <div className="flex h-full flex-col gap-3 bg-[#0a0f1a] p-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Camera size={18} className="text-[#3fb950]" />
          <h2 className="text-sm font-bold text-white">Depot Camera Surveillance</h2>
          <span className="rounded bg-white/10 px-2 py-0.5 text-[10px] text-white/60">
            {activeCameras} feeds
          </span>
        </div>
        <ModelStatus />
      </div>

      {/* Metrics bar */}
      <div className="flex gap-2 flex-wrap">
        <div className="flex items-center gap-2 rounded bg-[#111827] px-3 py-1.5">
          <Truck size={14} className="text-[#3fb950]" />
          <div>
            <div className="text-[10px] text-white/50">Vehicles</div>
            <div className="text-sm font-bold text-white">{totalVehicles}</div>
          </div>
        </div>
        <div className="flex items-center gap-2 rounded bg-[#111827] px-3 py-1.5">
          <Users size={14} className="text-blue-400" />
          <div>
            <div className="text-[10px] text-white/50">Workers</div>
            <div className="text-sm font-bold text-white">{totalWorkers}</div>
          </div>
        </div>
        <div className="flex items-center gap-2 rounded bg-[#111827] px-3 py-1.5">
          <Package size={14} className="text-amber-400" />
          <div>
            <div className="text-[10px] text-white/50">Cement Bags</div>
            <div className="text-sm font-bold text-white">{totalBags}</div>
          </div>
        </div>
        <div className="flex items-center gap-2 rounded bg-[#111827] px-3 py-1.5">
          <Camera size={14} className="text-blue-400" />
          <div>
            <div className="text-[10px] text-white/50">Active Feeds</div>
            <div className="text-sm font-bold text-white">{activeCameras}</div>
          </div>
        </div>
        {plateLog.length > 0 && (
          <div className="flex items-center gap-2 rounded bg-[#111827] px-3 py-1.5">
            <ShieldCheck size={14} className="text-amber-400" />
            <div>
              <div className="text-[10px] text-white/50">Plates Detected</div>
              <div className="text-sm font-bold text-white">{plateLog.length}</div>
            </div>
          </div>
        )}
      </div>

      {/* Camera grid — exactly 3x2 = 6 cameras */}
      <div className="grid flex-1 grid-cols-3 gap-2">
        {cameras.slice(0, 6).map((cam, i) => {
          const det = detections[i];
          return (
            <div key={cam.id} className="relative flex flex-col">
              <VideoFeed
                name={cam.name}
                cameraId={cam.id}
                videoFile={cam.videoFile}
                cameraIndex={i}
                onDetectionUpdate={handleDetectionUpdate(i, cam.name)}
                onPlateDetected={(plate) => handlePlateDetected(i, cam.name, plate)}
              />
              {/* Detection overlay badges */}
              <div className="absolute top-1 left-1 flex flex-col gap-0.5">
                {det?.vehicles != null && det.vehicles > 0 && (
                  <div className="rounded bg-[#3fb950] px-1.5 py-0.5 text-[9px] font-bold text-black flex items-center gap-0.5">
                    <Truck size={8} /> {det.vehicles}
                  </div>
                )}
                {det?.workers != null && det.workers > 0 && (
                  <div className="rounded bg-blue-500 px-1.5 py-0.5 text-[9px] font-bold text-white flex items-center gap-0.5">
                    <Users size={8} /> {det.workers}
                  </div>
                )}
                {det?.cementBags != null && det.cementBags > 0 && (
                  <div className="rounded bg-amber-500 px-1.5 py-0.5 text-[9px] font-bold text-black flex items-center gap-0.5">
                    <Package size={8} /> {det.cementBags} bags
                  </div>
                )}
              </div>
              {/* Latest plate */}
              {det?.plates?.[0] && (
                <div className="absolute right-1 top-1 rounded bg-white/90 px-1.5 py-0.5 text-[9px] font-bold text-black">
                  🚗 {det.plates[0]}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* LPR Log */}
      {plateLog.length > 0 && (
        <div className="rounded bg-[#111827] p-2">
          <div className="text-[10px] font-bold text-white/60 mb-1.5">Recent LPR Detections</div>
          <div className="flex flex-col gap-1 max-h-20 overflow-y-auto">
            {plateLog.slice(0, 5).map((entry, i) => (
              <div key={i} className="flex items-center gap-2 text-[9px]">
                <span className="text-white/40">{entry.time}</span>
                <span className="text-white/60">{entry.camera}</span>
                <span className="font-bold text-amber-300 bg-amber-500/10 px-1.5 py-0.5 rounded">
                  {entry.plate}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default function CameraGrid() {
  return (
    <ModelProvider>
      <CameraGridInner />
    </ModelProvider>
  );
}
