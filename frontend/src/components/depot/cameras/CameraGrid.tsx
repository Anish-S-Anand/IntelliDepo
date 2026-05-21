"use client";

import { useState, useCallback } from "react";
import { VideoFeed } from "./VideoFeed";
import { ModelProvider, useCocoSsd } from "@/hooks/useCocoSsd";
import { Camera, ShieldCheck, Truck, AlertTriangle, Users, Package } from "lucide-react";

interface CameraData {
  id: string;
  name: string;
  stream_url?: string;
  videoFile?: string;
}

// Exactly 6 cameras — no more, no less
// UPDATED: All cameras live with different raw videos (no detection overlays)
const FALLBACK_CAMERAS: CameraData[] = [
  { id: "gate-entry-north", name: "Gate Entry North", videoFile: "Screen Recording 2025-05-22 164244.mp4" },
  { id: "zone-a-overhead", name: "Zone A Overhead", videoFile: "Screen Recording 2025-08-11 173926.mp4" },
  { id: "loading-bay-1-4", name: "Loading Bay 1-4", videoFile: "Screen Recording 2025-07-30 115414.mp4" },
  { id: "zone-c-perimeter", name: "Zone C Perimeter", videoFile: "Recording 2025-07-30 115417.mp4" },
  { id: "gate-exit-south", name: "Gate Exit South", videoFile: "Recording 2025-07-30 120521.mp4" },
  { id: "yard-overview", name: "Yard Overview", videoFile: "Recording 2025-08-11 171805.mp4" },
];

interface DetectionCounts {
  vehicles: number;
  workers: number;
  cementBags: number;
}

function ModelStatus() {
  const { loading, error } = useCocoSsd();
  if (error) {
    return (
      <span className="flex items-center gap-1.5 rounded bg-yellow-500/20 px-2 py-1 text-[10px] text-yellow-400">
        <AlertTriangle size={12} /> Browser AI unavailable — using server detection
      </span>
    );
  }
  if (loading) {
    return (
      <span className="flex items-center gap-1.5 rounded bg-green-500/20 px-2 py-1 text-[10px] text-green-400">
        <ShieldCheck size={12} /> Cameras active
      </span>
    );
  }
  return (
    <span className="flex items-center gap-1.5 rounded bg-green-500/20 px-2 py-1 text-[10px] text-green-400">
      <ShieldCheck size={12} /> Cameras active
    </span>
  );
}

function CameraGridInner() {
  const [cameras] = useState<CameraData[]>(FALLBACK_CAMERAS);
  const [detections, setDetections] = useState<Record<number, DetectionCounts>>({});

  // DISABLED: Don't fetch cameras from backend - use fallback cameras only
  // The backend database has cameras configured with videos that don't exist in backend/tmp
  // We only have 3 videos: LPR_RECOGNITION.mp4, Perimeter_Detection.mp4, Theft Camera .mp4
  // useEffect(() => {
  //   async function fetchCameras() {
  //     try {
  //       const res = await fetch(`${getBackendBase()}/depot/vision/cameras/`);
  //       if (res.ok) {
  //         const data = await res.json();
  //         if (Array.isArray(data) && data.length > 0) {
  //           // Only use cameras with local: stream URLs
  //           const usable = data.filter((c: { stream_url?: string }) =>
  //             c.stream_url?.startsWith("local:")
  //           );
  //
  //           // Deduplicate by stream_url — keep first occurrence of each unique video
  //           const seen = new Set<string>();
  //           const unique = usable.filter((c: { stream_url?: string }) => {
  //             if (!c.stream_url || seen.has(c.stream_url)) return false;
  //             seen.add(c.stream_url);
  //             return true;
  //           });
  //
  //           // Need at least 6 distinct videos to replace fallback
  //           if (unique.length < 6) {
  //             return; // keep FALLBACK_CAMERAS which already have 6 distinct files
  //           }
  //
  //           const limited = unique.slice(0, 6).map((c: { id: string; name: string; stream_url?: string }) => ({
  //             id: c.id,
  //             name: c.name,
  //             stream_url: c.stream_url,
  //             videoFile:
  //               c.name === "Gate Exit South"
  //                 ? GATE_EXIT_SOUTH_VIDEO
  //                 : c.stream_url?.replace(/^local:/, ""),
  //           }));
  //           setCameras(limited);
  //         }
  //       }
  //     } catch {
  //       // Use fallback cameras (already 6 distinct videos)
  //     }
  //   }
  //   fetchCameras();
  // }, []);

  const handleDetectionUpdate = useCallback(
    (cameraIndex: number) =>
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
          <h2 className="text-sm font-bold text-white">IntelliVision</h2>
          <span className="rounded bg-white/10 px-2 py-0.5 text-[10px] text-white/60">
            {activeCameras} feeds
          </span>
        </div>
        <ModelStatus />
      </div>


      {/* Camera grid — exactly 3x2 = 6 cameras */}
      <div className="grid flex-1 grid-cols-3 gap-2">
        {cameras.slice(0, 6).map((cam, i) => {
          const det = detections[i];
          const isOffline = !cam.videoFile; // Camera is offline if no video file
          return (
            <div key={cam.id} className="relative flex flex-col">
              <VideoFeed
                name={cam.name}
                cameraId={cam.id}
                videoFile={cam.videoFile}
                cameraIndex={i}
                offline={isOffline}
                onDetectionUpdate={handleDetectionUpdate(i)}
              />
              {/* Detection overlay badges - only show for online cameras */}
              {!isOffline && (
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
              )}
            </div>
          );
        })}
      </div>
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
