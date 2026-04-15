"use client";

import { useState, useCallback } from "react";
import { VideoFeed } from "./VideoFeed";
import { ModelProvider, useCocoSsd } from "@/hooks/useCocoSsd";
import { Camera, ShieldCheck, Truck, AlertTriangle } from "lucide-react";

const CAMERAS = [
  {
    name: "Gate Entry North",
    streamUrl: "https://58a9af047d7e8.streamlock.net/live/NJDOT_1.stream/playlist.m3u8",
  },
  {
    name: "Gate Exit South",
    streamUrl: "https://videos3.earthcam.com/fecnetwork/9974.flv/chunklist_w1421640637.m3u8",
  },
  {
    name: "Zone A Overhead",
    streamUrl: "https://www.dot.ca.gov/travel-hq/camera-feed-test/streams/i80_overhead.m3u8",
  },
  {
    name: "Loading Bay 1-4",
    streamUrl: "https://feeds.thdo.tv/stream/TXDOT_1080p.m3u8",
  },
  {
    name: "Zone C Perimeter",
    streamUrl: "https://stream.ayrtontv.com.au/streams/traffic_melb.m3u8",
  },
  {
    name: "Yard Overview",
    streamUrl: "", // Will always fall back to TfL JamCam
  },
];

interface VehicleCounts {
  [cameraIndex: number]: number;
}

function ModelStatus() {
  const { loading, error } = useCocoSsd();
  if (error) {
    return (
      <span className="flex items-center gap-1.5 rounded bg-red-500/20 px-2 py-1 text-[10px] text-red-400">
        <AlertTriangle size={12} /> AI Error: {error}
      </span>
    );
  }
  if (loading) {
    return (
      <span className="flex items-center gap-1.5 rounded bg-blue-500/20 px-2 py-1 text-[10px] text-blue-400">
        <span className="inline-block h-2 w-2 animate-spin rounded-full border border-blue-400 border-t-transparent" />
        Loading COCO-SSD model...
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
  const [vehicleCounts, setVehicleCounts] = useState<VehicleCounts>({});
  const [plateLog, setPlateLog] = useState<Array<{ time: string; camera: string; plate: string }>>([]);

  const handleDetectionUpdate = useCallback(
    (cameraIndex: number, cameraName: string) =>
      (vehicles: Array<{ bbox: [number, number, number, number]; class: string; score: number }>) => {
        setVehicleCounts((prev) => ({ ...prev, [cameraIndex]: vehicles.length }));

        // We don't have direct plate data here, but the detection count is tracked.
        // Plate data flows through the drawBoxes overlay from useDetection.
      },
    [],
  );

  const totalVehicles = Object.values(vehicleCounts).reduce((a, b) => a + b, 0);
  const activeCameras = CAMERAS.length;

  return (
    <div className="flex h-full flex-col gap-3 bg-[#0a0f1a] p-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Camera size={18} className="text-[#3fb950]" />
          <h2 className="text-sm font-semibold text-white">Depot Camera Surveillance</h2>
          <span className="rounded bg-white/10 px-2 py-0.5 text-[10px] text-white/60">
            {activeCameras} feeds
          </span>
        </div>
        <ModelStatus />
      </div>

      {/* Metrics bar */}
      <div className="flex gap-3">
        <div className="flex items-center gap-2 rounded bg-[#111827] px-3 py-1.5">
          <Truck size={14} className="text-[#3fb950]" />
          <div>
            <div className="text-[10px] text-white/50">Total Vehicles</div>
            <div className="text-sm font-bold text-white">{totalVehicles}</div>
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

      {/* Camera grid — 3x2 */}
      <div className="grid flex-1 grid-cols-3 gap-2">
        {CAMERAS.map((cam, i) => (
          <div key={cam.name} className="relative flex flex-col">
            <VideoFeed
              name={cam.name}
              streamUrl={cam.streamUrl}
              cameraIndex={i}
              onDetectionUpdate={handleDetectionUpdate(i, cam.name)}
            />
            {vehicleCounts[i] != null && vehicleCounts[i] > 0 && (
              <div className="absolute right-1 top-1 rounded bg-[#3fb950] px-1.5 py-0.5 text-[9px] font-bold text-black">
                {vehicleCounts[i]} vehicles
              </div>
            )}
          </div>
        ))}
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
